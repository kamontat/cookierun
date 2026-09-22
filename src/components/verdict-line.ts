import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { base } from "./theme";

/**
 * Declared here rather than imported from the combi route: components never
 * import from routes. `AutoVerdict` in the route's describe.ts is structurally
 * assignable to this, so the route passes its value straight in.
 */
export type Verdict = {
	readonly semi: boolean;
	/** What forces manual work each run. Empty when the combi is full auto. */
	readonly reasons: readonly string[];
};

/**
 * Whether the code in front of you plays itself, and what stops it. A judgment
 * about the build rather than a reading of it, which is why it sits down the
 * page with the warnings while `<summary-line>` rides in the sticky panel.
 */
export class VerdictLine extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			.verdict {
				margin: 0;
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.85rem;
			}

			strong {
				color: var(--cr-accent);
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}
		`,
	];

	@property({ attribute: false })
	verdict: Verdict | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.setAttribute("aria-live", "polite");
	}

	#verdictLine() {
		if (this.verdict === null) return nothing;

		const { semi, reasons } = this.verdict;
		const tail = semi
			? `${reasons.join(", ")} ${
					reasons.length === 1 ? "needs" : "need"
				} manual work each run.`
			: "nothing needs manual work each run.";

		return html`<p class="verdict"
			><strong>${semi ? "Semi-auto" : "Full auto"}</strong> — ${tail}</p
		>`;
	}

	override render() {
		return this.#verdictLine();
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"verdict-line": VerdictLine;
	}
}

if (!customElements.get("verdict-line")) {
	customElements.define("verdict-line", VerdictLine);
}
