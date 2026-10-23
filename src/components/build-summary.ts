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
 * forces manual work each run. The title is also the board's fold: the badge
 * and the sentence stay on show either way, since folded they are what is left
 * to read the build by.
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
				font-size: 0.75rem;
				font-weight: 500;
			}

			/* The heading is the fold's handle. It keeps the heading's quiet look
			   rather than the site's button look: it is a title first. */
			h2 button {
				display: inline-flex;
				align-items: center;
				gap: var(--cr-space-2);
				border: 0;
				background: none;
				padding: 0;
				color: var(--cr-muted);
				font: inherit;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
				cursor: pointer;
			}

			h2 button:hover {
				color: var(--cr-text);
			}

			h2 button:focus-visible {
				outline: var(--cr-border) solid var(--cr-accent);
				outline-offset: 2px;
			}

			/* Drawn rather than typed, so the heading's text stays its name. */
			.chevron {
				width: 0.45em;
				height: 0.45em;
				border-right: 2px solid currentColor;
				border-bottom: 2px solid currentColor;
				transform: translateY(-0.15em) rotate(45deg);
				transition: transform 120ms ease;
			}

			:host([collapsed]) .chevron {
				transform: rotate(-45deg);
			}

			:host([collapsed]) header {
				border-bottom-color: transparent;
			}

			@media (prefers-reduced-motion: reduce) {
				.chevron {
					transition: none;
				}
			}

			@media (pointer: coarse) {
				h2 button {
					min-height: var(--cr-tap);
				}
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

	/**
	 * Whether the board under this header is folded away. The element only
	 * draws the handle and says which way it points; hiding the board is the
	 * page's, since the board is not inside this element. Reflected so the
	 * chevron can turn on it, and so the page's own styles can read it.
	 */
	@property({ type: Boolean, reflect: true })
	collapsed = false;

	/**
	 * A click turns the fold and says so with `toggle`, the event a native
	 * `<details>` fires. Not `input`: folding the board changes no value, and
	 * this element sits inside the form whose `input` re-renders the build.
	 * Setting `collapsed` from outside dispatches nothing.
	 */
	#toggle(): void {
		this.collapsed = !this.collapsed;
		this.dispatchEvent(new Event("toggle"));
	}

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
				<h2>
					<button
						type="button"
						aria-expanded=${String(!this.collapsed)}
						@click=${this.#toggle}
					><span class="chevron" aria-hidden="true"></span>Your build</button>
				</h2>
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
