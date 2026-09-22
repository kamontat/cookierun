import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { glyphFor, tileStyles } from "./entry-tile";
import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

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
			.chip {
				display: inline-flex;
				flex: 0 1 auto;
				gap: var(--cr-space-1);
				align-items: center;
				max-width: 100%;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				padding: 0 var(--cr-space-1);
			}

			.chip .art,
			.chip .art img {
				width: 1.4rem;
				height: 1.4rem;
			}

			.chip .name {
				overflow: hidden;
				font-size: 0.8rem;
				text-overflow: ellipsis;
				white-space: nowrap;
			}

			/* A hit area that still reads as a quiet × until you go for it. */
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
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	/** Reflected for the same reason `<entry-tile>`'s is: so the page can widen
	 * an open control whose `details[open]` it cannot see across the boundary. */
	@property({ type: Boolean, reflect: true })
	open = false;

	@state()
	private chosen: ReadonlySet<string> = new Set();

	@state()
	private filter = "";

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

	/**
	 * Closes on a click that lands outside, the same rule `<entry-tile>` follows
	 * and for the same reason: six open grids is a page you have to tidy up
	 * after. `pointerdown` fires before focus moves, so the grid is gone by the
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
		// `options` and the picks are two separate writes, so a list replaced
		// under a slot would otherwise keep a dropped value in the set —
		// invisible while it has no cell, and back the moment a later list
		// contains it again.
		const kept = [...this.chosen].filter((value) => this.#has(value));
		if (kept.length !== this.chosen.size) this.chosen = new Set(kept);
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

	/**
	 * Drops one pick from the closed line, where someone can see what they are
	 * removing. Focus lands on whichever remove button takes the gone one's
	 * place, or on the summary when the slot has emptied — the chip it was on
	 * has stopped existing either way.
	 */
	async #drop(value: string): Promise<void> {
		const at = this.selected.indexOf(value);
		const next = new Set(this.chosen);
		next.delete(value);
		this.chosen = next;
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;

		const buttons = [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(
				"summary button.remove",
			) ?? []),
		];
		(
			buttons[Math.min(at, buttons.length - 1)] ??
			this.shadowRoot?.querySelector("summary")
		)?.focus();
	}

	/** Focus follows the toggled cell into its replacement, as in `<entry-tile>`. */
	async #toggle(value: string): Promise<void> {
		const next = new Set(this.chosen);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		this.chosen = next;
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

	override render() {
		const labels = new Map(
			this.options.map(([value, label]) => [value, label]),
		);
		const images = new Map(
			this.options.map(([value, , image]) => [value, image]),
		);
		const chosen = this.selected;

		const needle = this.filter.trim().toLowerCase();
		const matching =
			needle === ""
				? this.options
				: this.options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		const shown = matching.slice(0, LIMIT);
		// The tab stop is the first pick, so tabbing in lands on what the slot
		// already holds; with nothing picked that is the first cell.
		const tabbableValue =
			shown.find(([value]) => this.chosen.has(value))?.[0] ?? shown[0]?.[0];

		return html`<details
			?open=${this.open}
			@toggle=${(event: Event) => {
				this.open = (event.target as HTMLDetailsElement).open;
			}}
		>
			<summary>
				<span class="label">${this.legend}</span>
				<span class=${chosen.length === 0 ? "pick empty" : "pick"}>
					${
						chosen.length === 0
							? NONE
							: chosen.map((value, index) => {
									const name = labels.get(value) ?? value;
									return html`${
										index === 0 ? "" : html`<span class="or">or</span>`
									}<span class="chip"
											>${this.#art(name, images.get(value) ?? null)}<span
												class="name"
												>${name}</span
											><button
												type="button"
												class="remove"
												aria-label=${`Remove ${name}`}
												@click=${(event: MouseEvent) => {
													// Inside the summary, so a click would otherwise
													// open the list — the opposite of tidying a slot.
													event.preventDefault();
													event.stopPropagation();
													void this.#drop(value);
												}}
												>×</button
											></span
										>`;
								})
					}
				</span>
			</summary>
			<div class="body">
				<input
					type="search"
					autocomplete="off"
					placeholder="Type to filter"
					aria-label=${`Filter ${this.legend}`}
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
							aria-checked=${String(this.chosen.has(value))}
							aria-selected=${String(this.chosen.has(value))}
							@click=${() => {
								void this.#toggle(value);
							}}
						>
							${this.#art(label, image)}<span class="name">${label}</span>
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
			</div>
		</details>`;
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
