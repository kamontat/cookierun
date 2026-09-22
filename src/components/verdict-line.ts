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

const SEPARATOR = " · ";

/**
 * What the code in front of you actually says, in two lines: the build as
 * prose, and whether it plays itself. It sits under the code because those two
 * answers are why anyone reads a code at all — the controls below only say how
 * to change it.
 */
export class VerdictLine extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			.summary {
				margin: 0;
				color: var(--cr-text);
				font-size: 0.95rem;
				line-height: 1.5;
			}

			.verdict {
				margin: var(--cr-space-1) 0 0;
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

	/** One entry per field worth saying out loud, in reading order. */
	@property({ attribute: false })
	summary: readonly string[] = [];

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
		return html`${
			this.summary.length === 0
				? nothing
				: html`<p class="summary">${this.summary.join(SEPARATOR)}</p>`
		}${this.#verdictLine()}`;
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
