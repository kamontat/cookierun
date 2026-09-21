import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { entryStyles } from "./entry-picker";
import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

/**
 * One treasure slot, holding the entries that slot will accept — a build that
 * says "this, or that" writes both here.
 *
 * Like `<entry-picker>` it lives inside a closed `<details>`, and for the same
 * reason: three open lists over the same thousand-entry catalog is a wall, and
 * the summary already says what the slot holds.
 *
 * `selected` filters this element's own `options` rather than reading the order
 * chips were added in, the same rule `<check-group>` follows and for the same
 * reason: a slot's alternatives are written in id order, so click order would
 * produce a different code for the same slot.
 *
 * It declares its own `Option` type rather than sharing `<entry-picker>`'s. A
 * shared type between two components is the first step towards a component that
 * cannot be read on its own.
 */
export class EntrySet extends LitElement {
	static override styles = [
		base,
		controls,
		entryStyles,
		css`
			.picked {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-1);
				margin-bottom: var(--cr-space-2);
			}

			.chip {
				display: inline-flex;
				align-items: center;
				gap: var(--cr-space-1);
				margin: 0;
				width: auto;
				padding: 0.125rem var(--cr-space-2);
				font-size: 0.8125rem;
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private chosen: ReadonlySet<string> = new Set();

	@state()
	private filter = "";

	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.chosen.has(value));
	}

	set selected(values: readonly string[]) {
		const known = new Set(this.options.map(([value]) => value));
		this.chosen = new Set(values.filter((value) => known.has(value)));
	}

	override willUpdate(): void {
		// An options list that no longer contains a pick drops it, the same rule
		// the setter applies.
		const known = new Set(this.options.map(([value]) => value));
		if ([...this.chosen].every((value) => known.has(value))) return;
		this.chosen = new Set([...this.chosen].filter((value) => known.has(value)));
	}

	#rows(): HTMLButtonElement[] {
		return [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(".entry") ?? []),
		];
	}

	#search(): HTMLInputElement | null {
		return this.shadowRoot?.querySelector("input") ?? null;
	}

	/**
	 * Focus follows the row or chip that was clicked into its replacement; when
	 * the click removed the thing it landed on, the search input — the one
	 * element that survives every render — takes it instead.
	 */
	async #changed(focusValue: string | null): Promise<void> {
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;
		const row =
			focusValue === null
				? undefined
				: this.#rows().find((candidate) => candidate.value === focusValue);
		(row ?? this.#search())?.focus();
	}

	/**
	 * One tab stop for the whole list, arrows inside it: 50 rows in each of three
	 * slots would otherwise be 150 stops in the loadout alone. Enter and Space
	 * need no handling — these rows are buttons.
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

	#add(value: string): void {
		this.chosen = new Set([...this.chosen, value]);
		void this.#changed(value);
	}

	#remove(value: string): void {
		const next = new Set(this.chosen);
		next.delete(value);
		this.chosen = next;
		void this.#changed(null);
	}

	override render() {
		const labels = new Map(
			this.options.map(([value, label]) => [value, label]),
		);
		const chosen = this.selected;

		const needle = this.filter.trim().toLowerCase();
		const matching =
			needle === ""
				? this.options
				: this.options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		// The tab stop is the first pick, so tabbing in lands on what the slot
		// already holds; with nothing picked that is the first row.
		const shown = matching.slice(0, LIMIT);
		const tabbableValue =
			shown.find(([value]) => this.chosen.has(value))?.[0] ?? shown[0]?.[0];

		return html`<details>
			<summary>
				<span class="name">${this.legend}</span>
				<span class="pick"
					>${
						chosen.length === 0
							? NONE
							: // The same "this or that" the code reads as, so a closed slot
								// says exactly what the reader panel would say about it.
								chosen.map((value) => labels.get(value) ?? value).join(" or ")
					}</span
				>
			</summary>
			<div class="picked">
				${chosen.map(
					(value) => html`<button
						type="button"
						class="chip"
						.value=${value}
						title=${`Remove ${labels.get(value) ?? value}`}
						@click=${() => {
							this.#remove(value);
						}}
					>
						${labels.get(value) ?? value} ×
					</button>`,
				)}
			</div>
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
				${shown.map(
					([value, label, image]) => html`<button
						type="button"
						class="entry"
						.value=${value}
						role="option"
						tabindex=${value === tabbableValue ? 0 : -1}
						aria-selected=${String(this.chosen.has(value))}
						@click=${() => {
							this.#add(value);
						}}
					>
						${
							image === null
								? ""
								: html`<img src=${image} alt="" loading="lazy" />`
						}${label}
					</button>`,
				)}
			</div>
			<small class="more"
				>${
					matching.length > LIMIT
						? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
						: ""
				}</small
			>
		</details>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-set": EntrySet;
	}
}

if (!customElements.get("entry-set")) {
	customElements.define("entry-set", EntrySet);
}
