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
 * The board's header — the title, the auto badge, and the sentence naming what
 * forces manual work each run.
 */
export class BuildSummary extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			header {
				display: flex;
				flex-wrap: wrap;
				align-items: baseline;
				justify-content: space-between;
				gap: var(--cr-space-2);
				border-bottom: 1px solid var(--cr-line);
				padding-bottom: var(--cr-space-2);
			}

			h2 {
				margin: 0;
				color: var(--cr-muted);
				font-size: 0.75rem;
				font-weight: 500;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			.badge {
				border: var(--cr-border) solid var(--cr-accent);
				border-radius: var(--cr-radius);
				padding: 0 var(--cr-space-2);
				color: var(--cr-accent);
				font-family: var(--cr-mono);
				font-size: 0.75rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			.verdict {
				margin: var(--cr-space-2) 0 0;
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
			}
		`,
	];

	/** Null for the hand-played types, where auto vs semi-auto means nothing. */
	@property({ attribute: false })
	verdict: Verdict | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.setAttribute("aria-live", "polite");
	}

	#verdict() {
		if (this.verdict === null) return nothing;

		const { semi, reasons } = this.verdict;
		const line = semi
			? `${reasons.join(", ")} ${
					reasons.length === 1 ? "needs" : "need"
				} manual work each run.`
			: "Nothing needs manual work each run.";

		return html`<p class="verdict">${line}</p>`;
	}

	override render() {
		return html`<header>
				<h2>Your build</h2>
				${
					this.verdict === null
						? nothing
						: html`<span class="badge"
							>${this.verdict.semi ? "Semi-auto" : "Full auto"}</span
							>`
				}
			</header>
			${this.#verdict()}`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"build-summary": BuildSummary;
	}
}

if (!customElements.get("build-summary")) {
	customElements.define("build-summary", BuildSummary);
}
