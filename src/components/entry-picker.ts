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

/**
 * The look both entry controls share. Shared because they are the same control
 * with one pick and with several; each keeps its own logic and its own
 * `Option` type.
 */
export const entryStyles = css`
	:host {
		display: block;
		margin-bottom: var(--cr-space-1);
	}

	summary {
		display: flex;
		flex-wrap: wrap;
		gap: var(--cr-space-1) var(--cr-space-2);
		align-items: center;
		justify-content: space-between;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		padding: var(--cr-space-1) var(--cr-space-2);
		cursor: pointer;
	}

	.name {
		font-family: var(--cr-mono);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
	}

	/* What the control holds, said on the closed line — the question a closed
	   control has to answer without being opened. */
	.pick {
		display: inline-flex;
		gap: var(--cr-space-1);
		align-items: center;
		color: var(--cr-muted);
		font-size: 0.875rem;
	}

	summary img {
		width: 1.5rem;
		height: 1.5rem;
		object-fit: contain;
	}

	details[open] summary {
		margin-bottom: var(--cr-space-1);
	}

	input[type="search"] {
		margin-bottom: var(--cr-space-1);
	}

	.entries {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		max-height: 12rem;
		overflow-y: auto;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		padding: var(--cr-space-1);
	}

	.entry {
		display: flex;
		align-items: center;
		gap: var(--cr-space-2);
		width: 100%;
		margin: 0;
		border: none;
		border-left: var(--cr-border) solid transparent;
		border-radius: 0;
		background: none;
		box-shadow: none;
		padding: var(--cr-space-1) var(--cr-space-2);
		color: inherit;
		font-family: var(--cr-font);
		text-align: left;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.875rem;
	}

	.entry:active {
		transform: none;
	}

	/* Tint and a marker, the same "you are here" the sidebar uses, and the same
	   light tint: an entry name has to stay readable over it. */
	.entry[aria-selected="true"] {
		border-left-color: var(--cr-accent);
		background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
		font-weight: 600;
	}

	.entry img {
		width: 1.75rem;
		height: 1.75rem;
		object-fit: contain;
	}

	.more {
		color: var(--cr-muted);
		font-size: 0.8rem;
	}
`;

/**
 * A type-to-filter list that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * It lives inside a closed `<details>`: a page with six of these open at once
 * is a wall of scrolling lists, and the summary already says what is picked,
 * which is what a closed control has to answer.
 *
 * Only the first `LIMIT` matches are rendered, because three of these plus
 * three `<entry-set>`s over the same catalog would otherwise put tens of
 * thousands of rows in one page. The selected row is always rendered, even when
 * the filter excludes it, so the control never appears to have lost the pick.
 */
export class EntryPicker extends LitElement {
	static override styles = [base, controls, entryStyles];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

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

	override willUpdate(): void {
		// An options list that no longer contains the pick drops it, rather than
		// leaving the summary naming an entry the list cannot show.
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

	#rows(): HTMLButtonElement[] {
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
	 * One tab stop for the whole list, arrows inside it: 50 rows in each of six
	 * controls would otherwise be 300 stops between the loadout and the rest of
	 * the page. Enter and Space need no handling — these rows are buttons.
	 */
	#walk(event: KeyboardEvent): void {
		const rows = this.#rows();
		const at = rows.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const to = {
			ArrowDown: at + 1,
			ArrowUp: at - 1,
			Home: 0,
			End: rows.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		// Clamped rather than wrapped: an arrow that jumps from the last row to
		// the first reads as a lost keypress.
		rows[Math.min(Math.max(to, 0), rows.length - 1)]?.focus();
	}

	/**
	 * Lit reuses the row nodes it can, so a pick usually leaves focus where it
	 * was. When the filter has hidden the row that was clicked there is nothing
	 * to return to, so the search input — the one element that survives every
	 * render — takes it instead.
	 */
	async #pick(value: string): Promise<void> {
		this.picked = value === "" ? null : value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;
		(
			this.#rows().find((row) => row.value === value) ?? this.#search()
		)?.focus();
	}

	#row(value: string, text: string, image: string | null, tabbable: boolean) {
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
			${
				image === null ? "" : html`<img src=${image} alt="" loading="lazy" />`
			}${text}
		</button>`;
	}

	override render() {
		const { shown, total } = this.#matches();
		// The tab stop is the pick, so tabbing in lands on what the control
		// currently says; with nothing picked that is the None row at the top.
		const tabbableValue = this.picked ?? "";
		const picked = this.#pickedOption();

		return html`<details>
			<summary>
				<span class="name">${this.label}</span>
				<span class="pick">
					${
						picked === undefined
							? NONE
							: html`${
									picked[2] === null
										? ""
										: html`<img src=${picked[2]} alt="" loading="lazy" />`
								}${picked[1]}`
					}
				</span>
			</summary>
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
				${this.#row("", NONE, null, tabbableValue === "")}
				${shown.map(([value, label, image]) =>
					this.#row(value, label, image, value === tabbableValue),
				)}
			</div>
			<small class="more"
				>${
					total > LIMIT
						? `Showing ${LIMIT} of ${total}. Type to narrow the list.`
						: ""
				}</small
			>
		</details>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-picker": EntryPicker;
	}
}

if (!customElements.get("entry-picker")) {
	customElements.define("entry-picker", EntryPicker);
}
