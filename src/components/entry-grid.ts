import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";
import { glyphFor, tileStyles } from "./tile";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const NONE = "None";

/**
 * An inline, single-pick grid for a catalog small enough to show whole on the
 * tab itself rather than behind a dialog: a dozen episodes, or a catalog of
 * cookies or pets behind a filter box, is not the wall of scrolling a
 * thousand-entry treasure list would be, which is why `<entry-tiles>` keeps
 * its dialog and this one does not. Cells borrow its grid look (`tileStyles`,
 * imported rather than copied) — art, then name, the picked cell wearing the
 * accent border — so a picker that is sometimes a dialog and sometimes inline
 * still reads as one visual language.
 *
 * Selection follows the roving-tabindex rule the catalog dialogs already use:
 * one tab stop for the whole grid, arrows inside it, Home and End at the ends,
 * clamped rather than wrapped. The walk only moves focus — a cell is a real
 * `<button>`, so Enter or Space already activates whichever one is focused,
 * and a value changes only on that activation (a click, in every test here),
 * never from the arrow keys alone.
 */
export class EntryGrid extends LitElement {
	static override styles = [
		base,
		controls,
		tileStyles,
		css`
			:host {
				display: block;
			}

			/*
			 * Declared again here, after tileStyles, rather than relied on from
			 * tileStyles' own .entries: that one also carries the open dialog's
			 * sheet-scrolling rules (overflow-y, flex-basis, min-height), which
			 * answer a question this inline grid does not have — there is no
			 * dialog sheet capping its height. grid-auto-rows: max-content keeps
			 * the WebKit bug tileStyles documents from reaching here too: WebKit
			 * sizes an auto row of buttons in a shrunken grid to the buttons'
			 * min-height, which under a coarse pointer is the tap size, and every
			 * name then spills into the row below its picture.
			 */
			.entries {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
				grid-auto-rows: max-content;
				gap: var(--cr-space-1);
			}
		`,
	];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	/**
	 * Whether the list already carries its own "none" — the episode's is `any`,
	 * the random boost's is this grid's own empty pick. A second None cell above
	 * a list that already has one would be a second answer to the same question.
	 */
	@property({ type: Boolean })
	required = false;

	/**
	 * Whether to draw the filter box. A property rather than an attribute, like
	 * `required`, because the route decides it and a markup attribute is
	 * invisible to the route's own test harness.
	 */
	@property({ type: Boolean })
	searchable = false;

	@state()
	private picked: string | null = null;

	@state()
	private filter = "";

	/** Null whenever the current `options` do not carry this value. */
	get value(): string | null {
		return this.picked !== null && this.#has(this.picked) ? this.picked : null;
	}

	set value(value: string | null) {
		this.picked = value;
	}

	#has(value: string): boolean {
		return this.options.some(([candidate]) => candidate === value);
	}

	#matches(): readonly Option[] {
		const needle = this.filter.trim().toLowerCase();
		if (needle === "") return this.options;
		return this.options.filter(([, label]) =>
			label.toLowerCase().includes(needle),
		);
	}

	/**
	 * The None cell (when not `required`) followed by whatever the filter
	 * leaves of `options`. The None cell is exempt from the filter, the same
	 * rule every catalog picker on the page follows — it is not one of the
	 * entries being searched.
	 */
	#cellsFor(): readonly Option[] {
		const shown = this.#matches();
		return this.required ? shown : [["", NONE, null] as Option, ...shown];
	}

	#cells(): HTMLButtonElement[] {
		return [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(
				"button.entry",
			) ?? []),
		];
	}

	/**
	 * Linear and clamped in every direction, the same walk every catalog grid on
	 * the page uses: how many cells sit on a row is a layout answer this element
	 * would have to measure, and a walk that guesses wrong is worse than one
	 * that is simply consistent.
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
		cells[Math.min(Math.max(to, 0), cells.length - 1)]?.focus();
	}

	#pick(value: string): void {
		this.picked = value === "" ? null : value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
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
			aria-selected=${String(this.value === (value === "" ? null : value))}
			@click=${() => {
				this.#pick(value);
			}}
		>
			${this.#art(label, image)}<span class="name">${label}</span>
		</button>`;
	}

	override render() {
		const cells = this.#cellsFor();
		const value = this.value;
		const matchIndex = cells.findIndex(
			([candidate]) => candidate === (value ?? ""),
		);
		// Nothing currently rendered matches the value — nothing picked yet on a
		// required grid, or the filter has carried the pick out of view — so the
		// first cell carries the one tab stop the grid must never be without.
		const tabbableIndex = matchIndex === -1 ? 0 : matchIndex;

		return html`
			${
				this.searchable
					? html`<input
							type="search"
							autocomplete="off"
							placeholder="Type to filter"
							aria-label=${`Filter ${this.label}`}
							.value=${this.filter}
							@input=${(event: Event) => {
								event.stopPropagation();
								this.filter = (event.target as HTMLInputElement).value;
							}}
						/>`
					: nothing
			}
			<div
				class="entries"
				role="listbox"
				aria-label=${this.label}
				@keydown=${(event: KeyboardEvent) => {
					this.#walk(event);
				}}
			>
				${cells.map((option, at) => this.#cell(option, at === tabbableIndex))}
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-grid": EntryGrid;
	}
}

if (!customElements.get("entry-grid")) {
	customElements.define("entry-grid", EntryGrid);
}
