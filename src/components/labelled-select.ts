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
	 * Reads `#chosen` directly rather than the rendered `<select>` - the route
	 * sets `options` and `value` synchronously, before this element's first
	 * Lit render has run (Lit defers rendering to a microtask), so a getter
	 * that reached into `shadowRoot` would see no `<select>` yet.
	 *
	 * Falls back to the first option whenever `#chosen` names no option of
	 * this one's: nothing has been chosen, the chosen value belongs to an
	 * `options` list that has since been replaced, or `""` was chosen and
	 * `""` is not itself an option. That is what a native, untouched
	 * `<select>` reads as too, and it is what `render` below actually marks
	 * `.selected` - so this can never report a value the DOM disagrees with.
	 */
	get value(): string {
		return this.options.some(([value]) => value === this.#chosen)
			? this.#chosen
			: (this.options[0]?.[0] ?? "");
	}

	set value(value: string) {
		this.#chosen = value;
		this.requestUpdate();
	}

	/**
	 * A native form control's `input` event is `bubbles: true, composed: true`
	 * - it already escapes the shadow root on its own, before this handler (or
	 * this element's own re-dispatch) ever runs, carrying whatever `#chosen`
	 * still said a moment ago. Stopping it here and re-dispatching from the
	 * host, rather than waiting for the following (non-composed) `change`,
	 * keeps the page from seeing that stale double.
	 *
	 * `requestUpdate` here, not only in `set value`, is what keeps `render`'s
	 * `.selected` bindings honest afterward: a real pick changes the browser's
	 * own selectedness directly, outside Lit's rendering, so without this
	 * Lit's dirty-check would still think its last commit (from before the
	 * pick) matches `this.value` and skip reasserting `.selected` the next
	 * time `value` is written - leaving the picked option showing.
	 */
	#changed(event: Event): void {
		event.stopPropagation();
		this.#chosen = (event.target as HTMLSelectElement).value;
		this.requestUpdate();
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		// `.selected` is an IDL property assignment, not a `selected` content
		// attribute. That matters twice over: Lit commits an element's own
		// property bindings before it renders that element's children, so a
		// `.value=${this.#chosen}` binding on the `<select>` itself would run
		// before its `<option>`s existed and be silently dropped; and per the
		// HTML spec's "pick an option" algorithm, once a user has picked an
		// option by hand it is marked dirty, and a dirty option's `selected`
		// *attribute* stops moving it - only the `.selected` *property* setter
		// still does, unconditionally, on every option, insertion order and
		// dirtiness alike.
		return html`
			<label for=${this.#id}>${this.label}</label>
			<select
				id=${this.#id}
				@input=${(event: Event) => {
					this.#changed(event);
				}}
			>
				${this.options.map(
					([value, text]) =>
						html`<option value=${value} .selected=${value === this.value}>${text}</option>`,
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
