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

	button.tile {
		display: flex;
		gap: var(--cr-space-3);
		align-items: center;
		width: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
		box-shadow: none;
		padding: var(--cr-space-2);
		color: inherit;
		font-family: var(--cr-font);
		font-size: 0.9rem;
		text-align: left;
		text-transform: none;
		letter-spacing: normal;
	}

	button.tile:active {
		transform: none;
	}

	/* A slot nobody has filled still has to invite a click, not just read
	   quieter than a filled one — the dashed frame is what says "empty" at a
	   glance, alongside the muted "None" text. */
	button.tile.empty {
		border-style: dashed;
		border-color: var(--cr-muted);
	}

	dialog {
		width: min(52rem, 94vw);
		max-height: 85vh;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
		padding: 0;
		color: var(--cr-text);
	}

	dialog::backdrop {
		background: var(--cr-backdrop);
	}

	/* A flex column rather than a row template counted for four children:
	   <entry-tile>'s sheet has four (header, input, .entries, .more) but
	   <entry-tiles>'s has six whenever the kind row renders (header, .kinds,
	   input, .entries, footer, .more). A template keyed to a row count breaks
	   the moment either count changes; flex only needs .entries to claim the
	   leftover space, whatever else is around it. The max-height lives on the
	   dialog itself, not here — see the dialog rule above. */
	.sheet {
		display: flex;
		flex-direction: column;
		gap: var(--cr-space-2);
		padding: var(--cr-space-3);
	}

	.sheet header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--cr-space-2);
	}

	.sheet h2 {
		margin: 0;
		font-family: var(--cr-mono);
		font-size: 1rem;
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

	/* A grid of faces, not a list of names: the whole reason these catalogs
	   carry pictures is that a cookie is quicker to recognise than to read.
	   flex: 1 1 auto and min-height: 0 are what let this row claim the sheet's
	   leftover space and scroll in it, whatever else the sheet holds. */
	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: var(--cr-space-1);
		overflow-y: auto;
		flex: 1 1 auto;
		min-height: 0;
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
`;

/**
 * A type-to-filter grid that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * The grid opens in a modal dialog rather than inline: six open grids at once
 * is a wall of scrolling, and the tile already shows what is picked, which is
 * what a closed control has to answer.
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

	@state()
	private picked: string | null = null;

	@state()
	private filter = "";

	/**
	 * Whether the press that is about to produce a click began on the dialog
	 * itself, latched on pointerdown. A click fires on the nearest common
	 * ancestor of the mousedown and mouseup targets, so selecting text in the
	 * search box and releasing past the sheet's edge would otherwise target
	 * the dialog too and close it — this is what tells that drag apart from a
	 * real press-and-release on the backdrop.
	 */
	#pressedBackdrop = false;

	get value(): string | null {
		return this.picked;
	}

	set value(value: string | null) {
		this.picked = value !== null && this.#has(value) ? value : null;
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

	#dialog(): HTMLDialogElement | null {
		return this.shadowRoot?.querySelector("dialog") ?? null;
	}

	#tile(): HTMLButtonElement | null {
		return this.shadowRoot?.querySelector("button.tile") ?? null;
	}

	/**
	 * A modal rather than an inline list: the grid wants the width of the page,
	 * and six inline grids was a page you had to tidy up after. The platform
	 * takes care of the backdrop, the focus trap and Escape.
	 */
	async #openPicker(): Promise<void> {
		this.filter = "";
		await this.updateComplete;
		this.#dialog()?.showModal();
		this.#search()?.focus();
	}

	#closePicker(): void {
		this.#dialog()?.close();
		this.#tile()?.focus();
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
	 * A click is the commit: one pick, one value, and the dialog has nothing
	 * left to ask. Focus goes back to the tile, which is where it came from.
	 */
	#pick(value: string): void {
		this.picked = value === "" ? null : value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
		this.#closePicker();
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
				this.#pick(value);
			}}
		>
			${this.#art(label, image)}<span class="name">${label}</span>
		</button>`;
	}

	override render() {
		const { shown, total } = this.#matches();
		const tabbableValue = this.picked ?? "";
		const picked = this.#pickedOption();

		return html`<button
				type="button"
				class=${picked === undefined ? "tile empty" : "tile"}
				@click=${() => {
					void this.#openPicker();
				}}
			>
				<span class="label">${this.label}</span>
				<span class=${picked === undefined ? "pick empty" : "pick"}>
					${
						picked === undefined
							? NONE
							: html`${this.#art(picked[1], picked[2])}${picked[1]}`
					}
				</span>
			</button>
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
					// target the dialog too. Requiring the press to have started there
					// as well is what tells the two apart.
					if (this.#pressedBackdrop && event.target === this.#dialog()) {
						this.#dialog()?.close();
					}
				}}
			>
				<div class="sheet">
					<header>
						<h2>${this.label}</h2>
						<button
							type="button"
							class="close"
							@click=${() => {
								this.#closePicker();
							}}
						>
							Close
						</button>
					</header>
					<input
						type="search"
						autocomplete="off"
						placeholder="Type to filter"
						aria-label=${`Filter ${this.label}`}
						.value=${this.filter}
						@input=${(event: Event) => {
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
			</dialog>`;
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
