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

export class AutoVerdictElement extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
				margin-top: var(--cr-space-3);
				font-family: var(--cr-mono);
				font-size: 0.9rem;
			}

			strong {
				color: var(--cr-accent);
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}
		`,
	];

	// `Element` already declares a readonly `prefix` (its XML namespace
	// prefix), so this reactive property has to say it is deliberately
	// shadowing that, not extending it.
	@property({ type: String })
	override prefix = "";

	@property({ attribute: false })
	verdict: Verdict | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.setAttribute("aria-live", "polite");
	}

	override render() {
		if (this.verdict === null) return nothing;

		const { semi, reasons } = this.verdict;
		const tail = semi
			? ` - ${reasons.join(", ")} ${
					reasons.length === 1 ? "needs" : "need"
				} manual work each run.`
			: " - nothing needs manual work each run.";

		// The separating space belongs to the prefix, not to the verdict, or an
		// element without one opens with a stray space before "Full auto".
		return html`${this.prefix === "" ? nothing : `${this.prefix} `}<strong
				>${semi ? "Semi-auto" : "Full auto"}</strong
			>${tail}`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"auto-verdict": AutoVerdictElement;
	}
}

if (!customElements.get("auto-verdict")) {
	customElements.define("auto-verdict", AutoVerdictElement);
}
