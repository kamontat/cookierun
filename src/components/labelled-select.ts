import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [value: string, label: string];

let sequence = 0;

/**
 * A label and a select, built from `[value, label]` pairs handed in as a
 * property. The pairs come from the caller's canonical list, so the option
 * order is the caller's order.
 */
export class LabelledSelect extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			select {
				margin-top: var(--cr-space-1);
			}
		`,
	];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	#generated: string | null = null;

	#chosen = "";

	// A native, untouched `<select>` reads as its first option's value, not
	// empty. The route relies on exactly that at import time - it reads
	// `.value` synchronously to seed its default code, before this element (or
	// any Lit element) has completed a render - so "nobody has chosen
	// anything" has to fall back to the first option rather than to "".
	#explicit = false;

	/**
	 * Derived from the host id where there is one, so the generated id reads as
	 * belonging to this control rather than to a counter. Computed on first
	 * render rather than at construction: an element created by
	 * `document.createElement` has no id yet, and the tests set one afterwards.
	 */
	get #id(): string {
		if (this.id !== "") return `${this.id}-select`;
		this.#generated ??= `select-${++sequence}`;
		return this.#generated;
	}

	/**
	 * Reads and writes `#chosen` directly rather than the rendered `<select>`.
	 * The route sets `options` and `value` synchronously, before this element's
	 * first Lit render has run (Lit defers rendering to a microtask), so a
	 * getter that reached into `shadowRoot` would see no `<select>` yet and
	 * report the wrong thing. Keeping the source of truth in this field also
	 * sidesteps the option-vs-value render race below.
	 */
	get value(): string {
		if (this.#explicit) return this.#chosen;
		return this.options[0]?.[0] ?? this.#chosen;
	}

	set value(value: string) {
		this.#chosen = value;
		this.#explicit = true;
		this.requestUpdate();
	}

	/**
	 * `change` is not composed, so it dies at the shadow boundary. The page
	 * listens for `input` on the form, so the element says it itself.
	 */
	#changed(event: Event): void {
		event.stopPropagation();
		this.#chosen = (event.target as HTMLSelectElement).value;
		this.#explicit = true;
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		// `?selected` is set on each `<option>` as it is created, rather than
		// `.value` on the `<select>` after the fact. Lit commits an element's own
		// attribute/property bindings before it renders that element's children,
		// so a `.value=${this.#chosen}` binding here would run while the
		// `<select>` still had no `<option>`s - and the browser does not revisit
		// that assignment once they arrive, so it silently keeps whichever option
		// lands first instead of the one asked for.
		return html`
			<label for=${this.#id}>${this.label}</label>
			<select
				id=${this.#id}
				@change=${(event: Event) => {
					this.#changed(event);
				}}
			>
				${this.options.map(
					([value, text]) =>
						html`<option value=${value} ?selected=${value === this.value}>${text}</option>`,
				)}
			</select>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"labelled-select": LabelledSelect;
	}
}

if (!customElements.get("labelled-select")) {
	customElements.define("labelled-select", LabelledSelect);
}
