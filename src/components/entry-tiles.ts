import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";
import { live } from "lit/directives/live.js";

import { glyphFor, tileStyles } from "./entry-tile";
import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
	kind?: string | null,
];

/** An upgrade level, or a range of them: +0 to +9, `min` never above `max`. */
export type Level = readonly [min: number, max: number];

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const UNUPGRADED: Level = [0, 0];

const LIMIT = 50;

const NONE = "None";

/**
 * What a kind is drawn as. An evolved entry and the blessed one beside it wear
 * the same picture and all but a prefix of the same name, so the badge and the
 * colour a slot borrows from it are the only things telling the two cells
 * apart — and the name is what a screen reader gets instead of the colour.
 *
 * An option carrying no kind, or one this table does not know, is drawn the way
 * every option was before kinds existed: no badge and no claim.
 */
const KINDS: Record<string, { badge: string; name: string }> = {
	base: { badge: "N", name: "Base" },
	evolved: { badge: "E", name: "Evolved" },
	blessed: { badge: "B", name: "Blessed" },
};

function kindOf(option: Option): string | undefined {
	const kind = option[3];
	return kind != null && Object.hasOwn(KINDS, kind) ? kind : undefined;
}

/** The filter row's own value for "do not narrow by kind at all". */
const ANY_KIND = "all";

/**
 * One treasure slot: the same filtered grid as `<entry-tile>`, holding any
 * number of picks rather than one. Several picks in a slot are alternatives —
 * the code says "this or that" — so the closed line says it that way too.
 */
export class EntryTiles extends LitElement {
	static override styles = [
		base,
		controls,
		tileStyles,
		css`
			/* The word between two alternatives, quieter than either of them. */
			.or {
				flex: 0 0 auto;
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			/* One pick, small enough that four of them wrap across a line rather
			   than stacking into a column of portraits. */
			/* The slot is its name and its list, not one button holding both: a
			   remove button inside the button that opens the picker is not
			   markup, and dropping one alternative is the thing this list is
			   read for. */
			.slot {
				display: flex;
				flex-direction: column;
				gap: var(--cr-space-2);
			}

			.picks {
				display: flex;
				flex-direction: column;
				gap: var(--cr-space-1);
				margin: 0;
				padding: 0;
				list-style: none;
			}

			/* One per line: two treasures side by side were two half-names, and a
			   slot holds alternatives worth reading in full. */
			.chip {
				display: flex;
				gap: var(--cr-space-1);
				align-items: center;
				width: 100%;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				padding: 0 var(--cr-space-1);
			}

			.chip .name {
				flex: 1 1 auto;
			}

			/* Two narrow selects: a level is one character, and the name beside
			   them is what the row is read for. */
			.levels {
				display: inline-flex;
				flex: 0 0 auto;
				gap: 0.15rem;
				align-items: center;
			}

			.levels select {
				padding: 0 var(--cr-space-1);
				font-family: var(--cr-mono);
				font-size: 0.75rem;
			}

			.levels .to {
				color: var(--cr-muted);
				font-size: 0.75rem;
			}

			/* What the tile says when it is closed: how much the slot holds, since
			   the names are right underneath it. */
			.hint {
				color: var(--cr-muted);
				font-size: 0.8rem;
			}

			.chip .art,
			.chip .art img {
				width: 2rem;
				height: 2rem;
			}

			.chip .name {
				overflow: hidden;
				font-size: 0.8rem;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			/* Which of the three colours this cell or chip borrows. Local
			   plumbing, not a site token: every value it takes is defined in
			   tokens.css and read from there. A base form points at --cr-muted,
			   because tinting the common case tints most of the grid. */
			[data-kind="base"] {
				--kind: var(--cr-muted);
			}

			[data-kind="evolved"] {
				--kind: var(--cr-evolved);
			}

			[data-kind="blessed"] {
				--kind: var(--cr-blessed);
			}

			/* The badge hangs off the corner of the frame it labels. */
			.art {
				position: relative;
			}

			.badge {
				position: absolute;
				top: -0.2rem;
				right: -0.2rem;
				min-width: 1rem;
				border: var(--cr-border) solid var(--cr-surface);
				border-radius: var(--cr-radius);
				background: var(--kind, var(--cr-muted));
				padding: 0 0.1rem;
				color: var(--cr-bg);
				font-family: var(--cr-mono);
				font-size: 0.6rem;
				font-weight: 700;
				line-height: 1.2;
				text-align: center;
			}

			/* A ring on the art rather than on the cell: the cell's own border
			   carries the picked state, and two meanings on one edge is one
			   meaning lost. */
			.entry[data-kind] .art {
				border-radius: var(--cr-radius);
				box-shadow: inset 0 0 0 var(--cr-border) var(--kind);
			}

			/* The closed line has no room for a frame, so the chip's own edge
			   answers the question - border and a thicker bar down its start. */
			.remove {
				flex: 0 0 auto;
				border: none;
				border-radius: var(--cr-radius);
				background: none;
				box-shadow: none;
				padding: 0 var(--cr-space-1);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.95rem;
				line-height: 1;
				letter-spacing: normal;
			}

			.remove:hover,
			.remove:focus-visible {
				color: var(--cr-danger);
			}

			.remove:active {
				transform: none;
			}

			/* Smaller than the hit area the shared chunk gives every other button:
			   at the full 44px four alternatives stack into a column taller than
			   the group beside them. Square, so it is as easy to hit across as
			   down. */
			@media (pointer: coarse) {
				.remove {
					min-width: 2.25rem;
					min-height: 2.25rem;
				}
			}

			.chip[data-kind] {
				border-color: var(--kind);
				box-shadow: inset 0.25rem 0 0 var(--kind);
			}

			/* Narrowing the grid to one kind, and the colour key for the badges
			   at the same time: each button wears the swatch it filters to. */
			.kinds {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-1);
				margin-bottom: var(--cr-space-2);
			}

			.kinds button {
				display: inline-flex;
				gap: var(--cr-space-1);
				align-items: center;
				padding: var(--cr-space-1) var(--cr-space-2);
				font-size: 0.65rem;
			}

			.kinds button[data-kind]:not([data-kind="all"])::before {
				display: inline-block;
				border-radius: var(--cr-radius);
				background: var(--kind);
				width: 0.55rem;
				height: 0.55rem;
				content: "";
			}

			.kinds button[aria-pressed="true"] {
				border-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
				font-weight: 600;
			}

			footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--cr-space-2);
			}

			footer .picked {
				color: var(--cr-muted);
				font-size: 0.78rem;
			}

			footer .buttons {
				display: flex;
				gap: var(--cr-space-2);
			}

			footer button.done {
				border-color: var(--cr-accent);
				background: var(--cr-accent);
				color: var(--cr-bg);
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private chosen: ReadonlySet<string> = new Set();

	/**
	 * What the dialog is showing, which is not yet what the slot holds. A slot is
	 * a set: applying half of one on the way out would leave a code nobody built,
	 * so the draft is committed by Done and thrown away by everything else.
	 */
	@state()
	private draft: ReadonlySet<string> = new Set();

	/**
	 * Each pick's level. Only picks that have left +0 have an entry, and an
	 * entry leaves with its pick: a treasure dropped and picked again starts
	 * over rather than coming back at a level nobody set this time.
	 */
	@state()
	private leveled: ReadonlyMap<string, Level> = new Map();

	@state()
	private filter = "";

	/**
	 * Which kind the grid is narrowed to, or `ANY_KIND` for all of them. It
	 * narrows what is shown and nothing else: a pick it hides is still held, and
	 * moving it is no more a change of value than typing in the search box is.
	 */
	@state()
	private kind: string = ANY_KIND;

	/**
	 * Whether the press that is about to produce a click began on the dialog
	 * itself, latched on pointerdown. A click fires on the nearest common
	 * ancestor of the mousedown and mouseup targets, so selecting text in the
	 * search box and releasing past the sheet's edge would otherwise target
	 * the dialog too and discard the whole draft — this is what tells that
	 * drag apart from a real press-and-release on the backdrop.
	 */
	#pressedBackdrop = false;

	/**
	 * Filters the element's own `options`, so the answer comes back in id order.
	 * A slot's alternatives are written in that order, so click order would
	 * produce a different code for the same slot.
	 */
	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.chosen.has(value));
	}

	set selected(values: readonly string[]) {
		this.chosen = new Set(values.filter((value) => this.#has(value)));
	}

	/** One entry per pick, in pick order; a pick never levelled reads +0. */
	get levels(): Readonly<Record<string, Level>> {
		return Object.fromEntries(
			this.selected.map((value) => [
				value,
				this.leveled.get(value) ?? UNUPGRADED,
			]),
		);
	}

	set levels(levels: Readonly<Record<string, Level>>) {
		this.leveled = new Map(
			Object.entries(levels).filter(([value]) => this.chosen.has(value)),
		);
	}

	override willUpdate(): void {
		// `options` and the picks are two separate writes, so a list replaced
		// under a slot would otherwise keep a dropped value in the set —
		// invisible while it has no cell, and back the moment a later list
		// contains it again.
		const kept = [...this.chosen].filter((value) => this.#has(value));
		if (kept.length !== this.chosen.size) this.chosen = new Set(kept);
		this.#prune();
	}

	/** Levels travel with their picks, so a pick that leaves takes its level. */
	#prune(): void {
		const kept = [...this.leveled].filter(([value]) => this.chosen.has(value));
		if (kept.length !== this.leveled.size) this.leveled = new Map(kept);
	}

	/**
	 * The two selects cannot disagree: moving one past the other drags the other
	 * along, so the slot never holds a range the code would refuse to read.
	 *
	 * Both the select's native `input` and its `change` run through here, since
	 * a select's `input` can arrive ahead of `change` (an arrow-key move fires
	 * `input` in some browsers before the `change` that follows it) and the
	 * component's own state has to track the control rather than lag a step
	 * behind it. The no-op guard is what keeps that pair — or a `change` that
	 * confirms what `input` already applied — from producing a second host
	 * event for the one change a person made.
	 */
	#setLevel(value: string, end: "min" | "max", to: number): void {
		const [min, max] = this.leveled.get(value) ?? UNUPGRADED;
		const next: Level =
			end === "min" ? [to, Math.max(max, to)] : [Math.min(min, to), to];
		if (next[0] === min && next[1] === max) return;
		this.leveled = new Map(this.leveled).set(value, next);
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	#has(value: string): boolean {
		return this.options.some(([candidate]) => candidate === value);
	}

	#cells(): HTMLButtonElement[] {
		return [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(
				"button.entry",
			) ?? []),
		];
	}

	#search(): HTMLInputElement | null {
		return this.shadowRoot?.querySelector("input") ?? null;
	}

	#dialog(): HTMLDialogElement | null {
		return this.shadowRoot?.querySelector("dialog") ?? null;
	}

	#tile(): HTMLButtonElement | null {
		return this.shadowRoot?.querySelector("button.tile") ?? null;
	}

	async #openPicker(): Promise<void> {
		this.draft = new Set(this.chosen);
		this.filter = "";
		// Forces every pick back into view of the grid, the same reason
		// <entry-tile> inserts a filter-excluded pick rather than losing it: a
		// dialog that reopens still narrowed to last visit's kind leaves the
		// footer's count with no picked cell on screen to match it.
		this.kind = ANY_KIND;
		await this.updateComplete;
		this.#dialog()?.showModal();
		this.#search()?.focus();
	}

	#commit(): void {
		this.chosen = new Set(this.draft);
		this.#prune();
		this.dispatchEvent(new Event("input", { bubbles: true }));
		this.#dialog()?.close();
	}

	/** One tab stop for the grid, arrows inside it, clamped at both ends. */
	#walk(event: KeyboardEvent): void {
		const cells = this.#cells();
		const at = cells.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const to = {
			ArrowRight: at + 1,
			ArrowDown: at + 1,
			ArrowLeft: at - 1,
			ArrowUp: at - 1,
			Home: 0,
			End: cells.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		cells[Math.min(Math.max(to, 0), cells.length - 1)]?.focus();
	}

	/** Focus follows the toggled cell into its replacement; once a filter has
	 * hidden it, the search box takes focus instead. */
	async #toggle(value: string): Promise<void> {
		const next = new Set(this.draft);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		this.draft = next;
		await this.updateComplete;
		(
			this.#cells().find((cell) => cell.value === value) ?? this.#search()
		)?.focus();
	}

	/**
	 * Drops one alternative from the slot's own list, where you can see what you
	 * are removing — the dialog's grid answers "which treasures exist", and this
	 * answers "which of them is this slot holding". It commits straight away
	 * rather than through a draft: there is nothing here to cancel, and a list
	 * you have to confirm a deletion in is a list you cannot tidy at a glance.
	 *
	 * Focus lands on whichever remove button takes the gone one's place, or on
	 * the slot's own button once the list has emptied — the row focus was on has
	 * stopped existing either way.
	 */
	async #drop(value: string): Promise<void> {
		const at = this.selected.indexOf(value);
		const next = new Set(this.chosen);
		next.delete(value);
		this.chosen = next;
		this.#prune();
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;

		const buttons = [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(
				".picks button.remove",
			) ?? []),
		];
		(buttons[Math.min(at, buttons.length - 1)] ?? this.#tile())?.focus();
	}

	#art(label: string, image: string | null, kind?: string) {
		return html`<span class="art"
			>${
				image === null
					? html`<span class="glyph" aria-hidden="true">${glyphFor(label)}</span>`
					: html`<img src=${image} alt="" loading="lazy" />`
			}${
				kind === undefined
					? nothing
					: html`<span class="badge" aria-hidden="true"
							>${KINDS[kind]?.badge}</span
						>`
			}</span
		>`;
	}

	#levelSelect(value: string, name: string, end: "min" | "max", at: number) {
		// The select's own input and change are composed: left alone they would
		// leave the shadow root as a second, unexplained change. The host's input
		// is the one that says the slot moved. Both native events are routed
		// through the same handler — #setLevel's own no-op guard, not a listener
		// choice here, is what keeps a browser that fires both for one change
		// from producing two host events.
		const choose = (event: Event): void => {
			event.stopPropagation();
			this.#setLevel(
				value,
				end,
				Number((event.target as HTMLSelectElement).value),
			);
		};
		return html`<select
			class=${`level level-${end}`}
			aria-label=${`${name} ${end === "min" ? "lowest" : "highest"} level`}
			.value=${live(String(at))}
			@input=${choose}
			@change=${choose}
		>
			${LEVELS.map(
				(level) =>
					html`<option value=${level} ?selected=${level === at}>+${level}</option>`,
			)}
		</select>`;
	}

	override render() {
		const labels = new Map(
			this.options.map(([value, label]) => [value, label]),
		);
		const images = new Map(
			this.options.map(([value, , image]) => [value, image]),
		);
		const kinds = new Map(
			this.options.map((option) => [option[0], kindOf(option)]),
		);
		const chosen = this.selected;

		// In the table's own order rather than the list's, so the row reads the
		// same whichever slot it sits in.
		const offered = Object.keys(KINDS).filter((kind) =>
			this.options.some((option) => kindOf(option) === kind),
		);
		const narrowing = offered.includes(this.kind) ? this.kind : ANY_KIND;

		const needle = this.filter.trim().toLowerCase();
		const matching = this.options.filter(
			(option) =>
				(narrowing === ANY_KIND || kindOf(option) === narrowing) &&
				(needle === "" || option[1].toLowerCase().includes(needle)),
		);

		const shown = matching.slice(0, LIMIT);
		// The tab stop is whatever the draft already holds, so tabbing in lands on
		// what the dialog is showing; with nothing drafted that is the first cell.
		const tabbableValue =
			shown.find(([value]) => this.draft.has(value))?.[0] ?? shown[0]?.[0];

		return html`<div class=${chosen.length === 0 ? "slot empty" : "slot"}>
				<button
					type="button"
					class=${chosen.length === 0 ? "tile empty" : "tile"}
					@click=${() => {
						void this.#openPicker();
					}}
				>
					<span class="label">${this.legend}</span>
					<span class="hint"
						>${
							chosen.length === 0
								? NONE
								: `${chosen.length} ${chosen.length === 1 ? "treasure" : "alternatives"}`
						}</span
					>
				</button>
				${
					chosen.length === 0
						? nothing
						: html`<ul class="picks">
							${chosen.map((value) => {
								const name = labels.get(value) ?? value;
								const [min, max] = this.leveled.get(value) ?? UNUPGRADED;
								return html`<li
									class="chip"
									data-value=${value}
									data-kind=${ifDefined(kinds.get(value))}
									>${this.#art(name, images.get(value) ?? null)}<span class="name"
										>${name}</span
									><span class="levels"
										>${this.#levelSelect(value, name, "min", min)}<span
											class="to"
											aria-hidden="true"
											>–</span
										>${this.#levelSelect(value, name, "max", max)}</span
									><button
										type="button"
										class="remove"
										aria-label=${`Remove ${name}`}
										@click=${() => {
											void this.#drop(value);
										}}
										>×</button
									></li
								>`;
							})}
						</ul>`
				}
			</div>
			<dialog
				@pointerdown=${(event: Event) => {
					this.#pressedBackdrop = event.target === this.#dialog();
				}}
				@close=${() => {
					this.#tile()?.focus();
				}}
				@click=${(event: Event) => {
					// A native dialog does not light-dismiss: nothing closes it on a
					// backdrop click unless this does. The target is the dialog itself
					// only when the click lands outside .sheet, so a click inside the
					// sheet passes through untouched — but a click also fires on the
					// nearest common ancestor of the press and release targets, so a
					// drag that starts inside .sheet and releases past its edge would
					// target the dialog too and discard the whole draft. Requiring the
					// press to have started there as well is what tells the two apart.
					if (this.#pressedBackdrop && event.target === this.#dialog()) {
						this.#dialog()?.close();
					}
				}}
			>
				<div class="sheet">
					<header>
						<h2>${this.legend}</h2>
						<button
							type="button"
							class="close"
							@click=${() => {
								this.#dialog()?.close();
							}}
						>
							Close
						</button>
					</header>
					${
						offered.length === 0
							? nothing
							: html`<div
									class="kinds"
									role="group"
									aria-label=${`Filter ${this.legend} by kind`}
								>
									${[ANY_KIND, ...offered].map(
										(kind) => html`<button
											type="button"
											data-kind=${kind}
											aria-pressed=${String(kind === narrowing)}
											@click=${() => {
												this.kind = kind;
											}}
										>
											${kind === ANY_KIND ? "All" : KINDS[kind]?.name}
										</button>`,
									)}
								</div>`
					}
					<input
						type="search"
						autocomplete="off"
						placeholder="Type to filter"
						aria-label=${`Filter ${this.legend}`}
						.value=${this.filter}
						@input=${(event: Event) => {
							event.stopPropagation();
							this.filter = (event.target as HTMLInputElement).value;
						}}
					/>
					<div
						class="entries"
						role="listbox"
						aria-multiselectable="true"
						aria-label=${this.legend}
						@keydown=${(event: KeyboardEvent) => {
							this.#walk(event);
						}}
					>
						${shown.map((option) => {
							const [value, label, image] = option;
							const kind = kindOf(option);
							return html`<button
								type="button"
								class="entry"
								.value=${value}
								role="option"
								data-kind=${ifDefined(kind)}
								tabindex=${value === tabbableValue ? 0 : -1}
								aria-checked=${String(this.draft.has(value))}
								aria-selected=${String(this.draft.has(value))}
								aria-label=${kind === undefined ? label : `${label}, ${KINDS[kind]?.name}`}
								@click=${() => {
									void this.#toggle(value);
								}}
							>
								${this.#art(label, image, kind)}<span class="name">${label}</span>
							</button>`;
						})}
					</div>
					<footer>
						<span class="picked"
							>${this.draft.size} picked — alternatives for one slot</span
						>
						<span class="buttons">
							<button
								type="button"
								class="clear"
								@click=${() => {
									this.draft = new Set();
								}}
							>
								Clear
							</button>
							<button
								type="button"
								class="done"
								@click=${() => {
									this.#commit();
								}}
							>
								Done
							</button>
						</span>
					</footer>
					<small class="more"
						>${
							matching.length > LIMIT
								? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
								: ""
						}</small
					>
				</div>
			</dialog>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-tiles": EntryTiles;
	}
}

if (!customElements.get("entry-tiles")) {
	customElements.define("entry-tiles", EntryTiles);
}
