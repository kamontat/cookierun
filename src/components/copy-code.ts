import { css, html, LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";

import { base, controls } from "./theme";

/**
 * What one character of the code means. The element only groups and displays
 * these; what a character means is the page's business, not the element's.
 */
export type CharHint = {
	char: string;
	hint: string;
	/** Characters sharing a group are drawn, and labelled, as one run. */
	group: string;
};

/**
 * The code the page exists to produce, plus a button that copies it and a
 * status line for the copy. Setting `value` clears the status, because a stale
 * "Copied." beside a code that has since changed is a lie — and drops the hints
 * for the same reason, since against a newer code they would label the wrong
 * characters.
 */
export class CopyCode extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			output {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-3);
				align-items: center;
			}

			/* Wrapping, not scrolling: a hint bubble inside an \`overflow\` box is
			   clipped by it, and a long full code has group boundaries to wrap at. */
			code {
				flex: 0 1 auto;
				min-width: 0;
				overflow-wrap: anywhere;
				color: var(--cr-accent-2);
				font-family: var(--cr-mono);
				font-size: clamp(1.5rem, 5vw, 2.25rem);
				font-weight: 600;
				letter-spacing: 0.22em;
				user-select: all;
			}

			/* One span per field of the code. The gap is what makes the fields read
			   as fields rather than as ten loose characters. */
			code span {
				position: relative;
				white-space: nowrap;
				border-bottom: 1px dotted currentColor;
				cursor: help;
			}

			code span + span {
				margin-left: 0.12em;
			}

			code span:hover,
			code span:focus-visible {
				color: var(--cr-accent);
			}

			/* The bubble the framework used to draw. It opens below the code on
			   purpose: the code sits at the top of a sticky panel, so a bubble
			   above it would open off the top of the window. */
			code span[data-placement="bottom"]::after {
				content: attr(data-tooltip);
				position: absolute;
				top: calc(100% + var(--cr-space-1));
				left: 50%;
				transform: translateX(-50%);
				z-index: 2;
				width: max-content;
				max-width: 16rem;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				box-shadow: var(--cr-block);
				padding: var(--cr-space-1) var(--cr-space-2);
				color: var(--cr-text);
				font-family: var(--cr-font);
				font-size: 0.8rem;
				font-weight: 400;
				letter-spacing: normal;
				white-space: normal;
				opacity: 0;
				pointer-events: none;
			}

			code span:hover::after,
			code span:focus-visible::after {
				opacity: 1;
			}

			.status {
				min-height: 1.4rem;
				margin: var(--cr-space-2) 0 0;
				color: var(--cr-muted);
				font-size: 0.9rem;
			}

			.status.error {
				color: var(--cr-danger);
			}
		`,
	];

	@property({ type: String, reflect: true })
	value = "";

	@state()
	private hintList: readonly CharHint[] = [];

	@state()
	private status = "";

	@state()
	private failed = false;

	/** The code the current hints were computed against. */
	#hintsFor = "";

	get hints(): readonly CharHint[] {
		return this.hintList;
	}

	/**
	 * One hint per character. Anything else is dropped whole: a hint list that
	 * does not line up with the code labels the wrong characters, which is worse
	 * than labelling none of them.
	 */
	set hints(hints: readonly CharHint[]) {
		this.#hintsFor = this.value;
		this.hintList = hints.length === this.value.length ? hints : [];
	}

	/**
	 * A new code invalidates both the hints and the status, whichever route set
	 * it — the attribute from the markup, or the property from the page.
	 *
	 * The hints are dropped by comparing what they were computed against rather
	 * than by the fact that `value` changed, because the page sets both in one
	 * tick: `codeOutput.value = code` then `codeOutput.hints = hintsFor(code)`.
	 * Both land before this runs, so clearing on `changed.has("value")` alone
	 * would throw away hints that describe the code exactly.
	 */
	protected override willUpdate(changed: PropertyValues<this>): void {
		if (!changed.has("value")) return;
		if (this.#hintsFor !== this.value) this.hintList = [];
		this.status = "";
		this.failed = false;
	}

	async #copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.value);
			this.status = "Copied.";
			this.failed = false;
		} catch {
			this.status =
				"The browser blocked the clipboard. Select the code and copy it by hand.";
			this.failed = true;
		}
	}

	/** Characters sharing a group are one run, drawn and labelled together. */
	#runs(): CharHint[][] {
		const runs: CharHint[][] = [];
		for (const hint of this.hintList) {
			const last = runs[runs.length - 1];
			if (last !== undefined && last[0]?.group === hint.group) last.push(hint);
			else runs.push([hint]);
		}
		return runs;
	}

	override render() {
		return html`
			<output aria-live="polite">
				<code
					>${
						this.hintList.length === 0
							? this.value
							: this.#runs().map(
									(run) => html`<span
									data-tooltip=${run[0]?.hint ?? ""}
									data-placement="bottom"
									data-group=${run[0]?.group ?? ""}
									>${run.map(({ char }) => char).join("")}</span
								>`,
								)
					}</code
				>
				<button
					type="button"
					@click=${() => {
						void this.#copy();
					}}
				>
					Copy
				</button>
			</output>
			<p
				class=${classMap({ status: true, error: this.failed })}
				role="status"
				>${this.status}</p
			>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"copy-code": CopyCode;
	}
}

if (!customElements.get("copy-code")) {
	customElements.define("copy-code", CopyCode);
}
