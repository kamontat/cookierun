import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { base } from "./theme";

const SEPARATOR = " · ";

/**
 * What the code in front of you says, in words. It belongs beside the code
 * rather than below it — the two are one answer — which is why it is its own
 * element and not a second line of `<verdict-line>`: the verdict is a judgment
 * about the build, and it stays down the page with the warnings rather than
 * taking height off a phone's sticky panel.
 */
export class SummaryLine extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			p {
				margin: 0;
				color: var(--cr-text);
				font-size: 0.9rem;
				line-height: 1.45;
			}
		`,
	];

	/** One entry per field worth saying out loud, in reading order. */
	@property({ attribute: false })
	fields: readonly string[] = [];

	override connectedCallback(): void {
		super.connectedCallback();
		this.setAttribute("aria-live", "polite");
	}

	override render() {
		// Nothing at all rather than an empty paragraph: this sits in the sticky
		// panel, where an empty line still costs its height.
		if (this.fields.length === 0) return nothing;
		return html`<p>${this.fields.join(SEPARATOR)}</p>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"summary-line": SummaryLine;
	}
}

if (!customElements.get("summary-line")) {
	customElements.define("summary-line", SummaryLine);
}
