import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

/** The initials an entry falls back to when the catalog has no picture. */
export function glyphFor(label: string): string {
	return label
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

/**
 * The look both catalog controls share. Shared because they are the same
 * control with one pick and with several; each keeps its own logic and its own
 * `Option` type.
 */
export const tileStyles = css`
	:host {
		display: block;
	}

	details {
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
	}

	summary {
		display: flex;
		gap: var(--cr-space-3);
		align-items: center;
		padding: var(--cr-space-2);
		cursor: pointer;
	}

	.label {
		color: var(--cr-muted);
		font-family: var(--cr-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
	}

	/* What the control holds, said on the closed line — the question a closed
	   control has to answer without being opened. */
	.pick {
		display: flex;
		flex: 1 1 auto;
		flex-wrap: wrap;
		gap: var(--cr-space-1) var(--cr-space-2);
		align-items: center;
		min-width: 0;
		font-size: 0.9rem;
	}

	.pick.empty {
		color: var(--cr-muted);
	}

	.art {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: 3rem;
		height: 3rem;
	}

	/* The image carries the frame's measurements itself rather than a
	   percentage of them. The frame is a grid area, so a percentage on the
	   image — height and max-height alike — has nothing definite to resolve
	   against, and the portrait falls back to its own height, overflowing onto
	   the name below it. The two lengths must stay in step. */
	.art img {
		width: 3rem;
		height: 3rem;
		object-fit: contain;
	}

	.glyph {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-bg);
		color: var(--cr-muted);
		font-family: var(--cr-mono);
		font-size: 0.85rem;
	}

	.body {
		border-top: var(--cr-border) solid var(--cr-line);
		padding: var(--cr-space-2);
	}

	input[type="search"] {
		margin-bottom: var(--cr-space-2);
	}

	/* A grid of faces, not a list of names: the whole reason these catalogs
	   carry pictures is that a cookie is quicker to recognise than to read. */
	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: var(--cr-space-1);
		max-height: 18rem;
		overflow-y: auto;
	}

	.entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cr-space-1);
		border: var(--cr-border) solid transparent;
		border-radius: var(--cr-radius);
		background: none;
		box-shadow: none;
		padding: var(--cr-space-1);
		color: inherit;
		font-family: var(--cr-font);
		font-size: 0.7rem;
		line-height: 1.2;
		text-align: center;
		text-transform: none;
		letter-spacing: normal;
	}

	.entry:active {
		transform: none;
	}

	/* Smaller in the grid than on the closed line, frame and image together. */
	.entry .art,
	.entry .art img {
		width: 2.75rem;
		height: 2.75rem;
	}

	.entry[aria-selected="true"],
	.entry[aria-checked="true"] {
		border-color: var(--cr-accent);
		background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
		font-weight: 600;
	}

	.more {
		display: block;
		margin-top: var(--cr-space-1);
		color: var(--cr-muted);
		font-size: 0.75rem;
	}

	/* The summary is what opens the control, and it is not a button, so the
	   shared chunk's hit area never reaches it. Its own contents come to 41px
	   unaided - close enough to read as deliberate, far enough to miss. */
	@media (pointer: coarse) {
		summary {
			min-height: var(--cr-tap);
		}
	}
`;

/**
 * A type-to-filter grid that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * It lives inside a closed `<details>`: six open grids at once is a wall of
 * scrolling, and the summary already shows what is picked, which is what a
 * closed control has to answer.
 *
 * Only the first `LIMIT` matches are rendered, because three of these plus
 * three treasure slots over the same catalog would otherwise put tens of
 * thousands of cells in one page. The picked entry is always rendered, even
 * when the filter excludes it, so the control never appears to have lost it.
 */
export class EntryTile extends LitElement {
	static override styles = [base, controls, tileStyles];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	/**
	 * Reflected so the page can widen an open control: the grid inside wants
	 * more room than the closed line needs, and `details[open]` is behind a
	 * shadow boundary no page selector can reach across.
	 */
	@property({ type: Boolean, reflect: true })
	open = false;

	@state()
	private picked: string | null = null;

	@state()
	private filter = "";

	get value(): string | null {
		return this.picked;
	}

	set value(value: string | null) {
		this.picked = value !== null && this.#has(value) ? value : null;
	}

	/**
	 * A list left open once you have gone elsewhere is a list you have to come
	 * back and close, and the page holds six of them. `pointerdown` rather than
	 * `click`: it fires before focus moves, so the list is already gone by the
	 * time whatever was clicked takes over.
	 */
	#closeOnOutside = (event: Event): void => {
		if (!this.open) return;
		if (event.composedPath().includes(this)) return;
		this.open = false;
	};

	override connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("pointerdown", this.#closeOnOutside);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("pointerdown", this.#closeOnOutside);
	}

	override willUpdate(): void {
		// An options list that no longer contains the pick drops it, rather than
		// leaving the tile naming an entry the grid cannot show.
		if (this.picked !== null && !this.#has(this.picked)) this.picked = null;
	}

	#has(value: string): boolean {
		return this.options.some(([candidate]) => candidate === value);
	}

	#pickedOption(): Option | undefined {
		return this.options.find(([value]) => value === this.picked);
	}

	#matches(): { shown: readonly Option[]; total: number } {
		const needle = this.filter.trim().toLowerCase();
		const matching =
			needle === ""
				? this.options
				: this.options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		const capped = matching.slice(0, LIMIT);
		const total = matching.length;
		if (this.picked === null) return { shown: capped, total };
		if (capped.some(([value]) => value === this.picked)) {
			return { shown: capped, total };
		}

		const picked = this.#pickedOption();
		return {
			shown: picked === undefined ? capped : [picked, ...capped],
			total,
		};
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

	/**
	 * One tab stop for the whole grid, arrows inside it: 50 cells in each of six
	 * controls would otherwise be 300 stops between the loadout and the rest of
	 * the page.
	 *
	 * The walk is linear in every direction. How many cells sit on a row is a
	 * layout answer the element would have to measure to know, and a walk that
	 * guesses wrong is worse than one that is simply consistent.
	 */
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
		// Clamped rather than wrapped: an arrow that jumps from the last cell to
		// the first reads as a lost keypress.
		cells[Math.min(Math.max(to, 0), cells.length - 1)]?.focus();
	}

	/**
	 * Lit reuses the cells it can, so a pick usually leaves focus where it was.
	 * The one case with nothing to return to: `options` is reassigned — by a
	 * listener reacting to the `input` dispatched below — dropping the value
	 * just picked. The search box, the one element that survives every render,
	 * takes focus instead.
	 */
	async #pick(value: string): Promise<void> {
		this.picked = value === "" ? null : value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;
		(
			this.#cells().find((cell) => cell.value === value) ?? this.#search()
		)?.focus();
	}

	#art(label: string, image: string | null) {
		return html`<span class="art"
			>${
				image === null
					? html`<span class="glyph" aria-hidden="true">${glyphFor(label)}</span>`
					: html`<img src=${image} alt="" loading="lazy" />`
			}</span
		>`;
	}

	#cell(option: Option, tabbable: boolean) {
		const [value, label, image] = option;
		return html`<button
			type="button"
			class="entry"
			.value=${value}
			role="option"
			tabindex=${tabbable ? 0 : -1}
			aria-selected=${String((this.picked ?? "") === value)}
			@click=${() => {
				void this.#pick(value);
			}}
		>
			${this.#art(label, image)}<span class="name">${label}</span>
		</button>`;
	}

	override render() {
		const { shown, total } = this.#matches();
		// The tab stop is the pick, so tabbing in lands on what the control
		// currently says; with nothing picked that is the None cell.
		const tabbableValue = this.picked ?? "";
		const picked = this.#pickedOption();

		return html`<details
			?open=${this.open}
			@toggle=${(event: Event) => {
				this.open = (event.target as HTMLDetailsElement).open;
			}}
		>
			<summary>
				<span class="label">${this.label}</span>
				<span class=${picked === undefined ? "pick empty" : "pick"}>
					${
						picked === undefined
							? NONE
							: html`${this.#art(picked[1], picked[2])}${picked[1]}`
					}
				</span>
			</summary>
			<div class="body">
				<input
					type="search"
					autocomplete="off"
					placeholder="Type to filter"
					aria-label=${`Filter ${this.label}`}
					.value=${this.filter}
					@input=${(event: Event) => {
						// Filtering is not a change of value, so it must not read as one.
						event.stopPropagation();
						this.filter = (event.target as HTMLInputElement).value;
					}}
				/>
				<div
					class="entries"
					role="listbox"
					aria-label=${this.label}
					@keydown=${(event: KeyboardEvent) => {
						this.#walk(event);
					}}
				>
					${this.#cell(["", NONE, null], tabbableValue === "")}
					${shown.map((option) => this.#cell(option, option[0] === tabbableValue))}
				</div>
				<small class="more"
					>${
						total > LIMIT
							? `Showing ${LIMIT} of ${total}. Type to narrow the list.`
							: ""
					}</small
				>
			</div>
		</details>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-tile": EntryTile;
	}
}

if (!customElements.get("entry-tile")) {
	customElements.define("entry-tile", EntryTile);
}
