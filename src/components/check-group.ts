import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [value: string, label: string];

/**
 * A fieldset of checkboxes built from `[value, label]` pairs.
 *
 * `selected` filters this element's own `options` rather than reading the
 * order boxes were ticked in, which is what keeps boosts in slot order and
 * cookie powers in bit order. That ordering is part of the combi wire format,
 * not a preference.
 *
 * The ticked set lives here rather than in the DOM: Lit owns the DOM now, so
 * reading `input:checked` back would be reading its output rather than this
 * element's state.
 */
export class CheckGroup extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			fieldset {
				margin: 0;
				border: 0;
				border-top: var(--cr-border) solid var(--cr-line);
				padding: var(--cr-space-2) 0 0;
			}

			legend {
				padding-right: var(--cr-space-1);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
				font-weight: 600;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			/* Seven cookie powers in one column made the builder twice the height
			   of everything beside it. */
			.checks {
				display: grid;
				gap: var(--cr-space-1) var(--cr-space-4);
				grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
			}

			.checks label {
				display: flex;
				gap: var(--cr-space-2);
				align-items: center;
				color: var(--cr-text);
				font-family: var(--cr-font);
				font-size: 0.9rem;
				text-transform: none;
				letter-spacing: normal;
			}

			.checks input {
				width: auto;
				accent-color: var(--cr-accent);
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private chosen: ReadonlySet<string> = new Set();

	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.chosen.has(value));
	}

	set selected(values: readonly string[]) {
		const known = new Set(this.options.map(([value]) => value));
		this.chosen = new Set(values.filter((value) => known.has(value)));
	}

	/**
	 * `change` is not composed, so it dies at the shadow boundary. The page
	 * listens for `input` on the form, so the element says it itself.
	 */
	#toggle(value: string, checked: boolean): void {
		const next = new Set(this.chosen);
		if (checked) next.add(value);
		else next.delete(value);
		this.chosen = next;
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		return html`<fieldset>
			<legend>${this.legend}</legend>
			<div class="checks">
				${this.options.map(
					([value, text]) => html`<label>
						<input
							type="checkbox"
							.value=${value}
							.checked=${this.chosen.has(value)}
							@change=${(event: Event) => {
								event.stopPropagation();
								this.#toggle(value, (event.target as HTMLInputElement).checked);
							}}
						/>${text}
					</label>`,
				)}
			</div>
		</fieldset>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"check-group": CheckGroup;
	}
}

if (!customElements.get("check-group")) {
	customElements.define("check-group", CheckGroup);
}
