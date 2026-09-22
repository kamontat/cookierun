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
 * The code, and the only place a code is entered. It shows the current code as
 * one run per field — each run says what it means and jumps to the control that
 * owns it — and swaps to a plain text field when someone wants to type or paste
 * a code instead of building one.
 *
 * It decodes nothing. The draft goes to the page as it is typed, and the page
 * hands back a `value`, a `message`, and whether that message is an error. That
 * split is what lets one element serve both directions of the page: building a
 * code and reading one are the same screen.
 */
export class CodeBar extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			.bar {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-2) var(--cr-space-3);
				align-items: center;
				justify-content: space-between;
			}

			/* Wrapping, not scrolling: a hint bubble inside an \`overflow\` box is
			   clipped by it, and a long full code has group boundaries to wrap at.
			   The size is held down to what a full code — three times the length of
			   a bare name — can still fit on a line or two. */
			code {
				display: flex;
				flex: 1 1 18rem;
				flex-wrap: wrap;
				align-items: baseline;
				min-width: 0;
				color: var(--cr-accent-2);
				font-family: var(--cr-mono);
				font-size: clamp(1.15rem, 3.2vw, 1.75rem);
				font-weight: 600;
				letter-spacing: 0.1em;
			}

			/* One button per field of the code. The gap is what makes the fields
			   read as fields rather than as ten loose characters. */
			code button {
				position: relative;
				margin: 0 0.06em;
				border: none;
				border-bottom: 2px dotted currentColor;
				border-radius: 0;
				background: none;
				box-shadow: none;
				padding: 0 0.06em;
				color: inherit;
				font: inherit;
				letter-spacing: inherit;
				text-transform: none;
				cursor: pointer;
			}

			code button:hover,
			code button:focus-visible {
				border-bottom-color: var(--cr-accent);
				color: var(--cr-accent);
			}

			code button:active {
				transform: none;
			}

			/* The bubble opens below the code on purpose: the bar sits at the top
			   of a sticky panel, so one above it would open off the window. */
			code button::after {
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

			code button:hover::after,
			code button:focus-visible::after {
				opacity: 1;
			}

			.plain {
				overflow-wrap: anywhere;
				user-select: all;
			}

			input {
				flex: 1 1 18rem;
				background: var(--cr-bg);
				padding: var(--cr-space-2) var(--cr-space-3);
				color: var(--cr-accent-2);
				font-family: var(--cr-mono);
				font-size: clamp(1rem, 3vw, 1.5rem);
				font-weight: 600;
				letter-spacing: 0.1em;
				text-transform: uppercase;
			}

			input::placeholder {
				color: var(--cr-muted);
				font-weight: 400;
				letter-spacing: normal;
				text-transform: none;
			}

			.buttons {
				display: flex;
				flex: 0 0 auto;
				gap: var(--cr-space-2);
			}

			.buttons button {
				font-size: 0.75rem;
			}

			.message {
				min-height: 1.4rem;
				margin: var(--cr-space-2) 0 0;
				color: var(--cr-muted);
				font-size: 0.9rem;
			}

			.message.error {
				color: var(--cr-danger);
			}
		`,
	];

	@property({ type: String, reflect: true })
	value = "";

	/** The page's line under the code: a character count, or a decode error. */
	@property({ type: String })
	message = "";

	@property({ type: Boolean })
	invalid = false;

	@property({ type: String })
	placeholder = "";

	/** Public so the page can open the editor — a paste lands here too. */
	@property({ type: Boolean })
	editing = false;

	@state()
	private hintList: readonly CharHint[] = [];

	@state()
	private status = "";

	@state()
	private failed = false;

	/**
	 * Which run is the single tab stop, by index. A render never writes it back,
	 * it only clamps a stale index against however many runs currently exist, so
	 * the invariant — exactly one run in range, tabbable — holds even after the
	 * code changes underneath it.
	 */
	@state()
	private activeRun = 0;

	/**
	 * What is in the editor. Seeded from `value` when the editor opens and owned
	 * by whoever is typing afterwards — the page writes a new `value` on every
	 * keystroke, so binding the field to `value` would fight them for the caret.
	 */
	@state()
	private draft = "";

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
	 * A new code invalidates the hints and the copy status, whichever route set
	 * it. The hints go by what they were computed against rather than by the
	 * fact that `value` changed, because the page sets both in one tick.
	 *
	 * The editor's text is deliberately not touched here: the page decodes every
	 * keystroke and writes a new `value` back, so rewriting the field from it
	 * would fight whoever is typing.
	 */
	protected override willUpdate(changed: PropertyValues<this>): void {
		if (changed.has("editing") && this.editing) this.draft = this.value;
		if (!changed.has("value")) return;
		if (this.#hintsFor !== this.value) this.hintList = [];
		this.status = "";
		this.failed = false;
	}

	protected override updated(changed: PropertyValues<this>): void {
		if (!changed.has("editing") || !this.editing) return;
		const input = this.shadowRoot?.querySelector("input");
		input?.focus();
		input?.select();
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

	/**
	 * One tab stop for the whole code, arrows inside it: a full code has around
	 * nine runs, and the bar sits at the top of the page, so nine tab stops there
	 * would push the form nine key presses down.
	 */
	#walk(event: KeyboardEvent): void {
		const buttons = [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>("code button") ??
				[]),
		];
		const at = buttons.indexOf(event.target as HTMLButtonElement);
		if (at === -1) return;

		const to = {
			ArrowLeft: at - 1,
			ArrowRight: at + 1,
			Home: 0,
			End: buttons.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		// Clamped rather than wrapped: an arrow that jumps from the last run to
		// the first reads as a lost keypress.
		const clamped = Math.min(Math.max(to, 0), buttons.length - 1);
		this.activeRun = clamped;
		buttons[clamped]?.focus();
	}

	#draft(event: Event): void {
		// The field's own composed `input` would otherwise reach the page's form
		// listener as if a control had changed, which is the one thing this
		// element must never look like.
		event.stopPropagation();
		this.draft = (event.target as HTMLInputElement).value;
		this.dispatchEvent(
			new CustomEvent<string>("code-draft", {
				detail: this.draft,
				bubbles: true,
			}),
		);
	}

	#key(event: KeyboardEvent): void {
		if (event.key === "Escape") {
			this.editing = false;
			this.dispatchEvent(new Event("code-cancel", { bubbles: true }));
			return;
		}
		if (event.key !== "Enter") return;
		event.preventDefault();
		this.editing = false;
	}

	#editor() {
		return html`<input
				type="text"
				inputmode="latin"
				autocapitalize="characters"
				autocomplete="off"
				spellcheck="false"
				aria-label="Code"
				placeholder=${this.placeholder}
				.value=${this.draft}
				@input=${(event: Event) => {
					this.#draft(event);
				}}
				@keydown=${(event: KeyboardEvent) => {
					this.#key(event);
				}}
				@blur=${() => {
					this.editing = false;
				}}
			/>
			<span class="buttons">
				<button
					type="button"
					class="done"
					@click=${() => {
						this.editing = false;
					}}
				>
					Done
				</button>
			</span>`;
	}

	#display() {
		const runs = this.#runs();
		// Clamped against the current run count, not stored back: a render must
		// never mutate reactive state mid-render, and the code changing out from
		// under a stale index is exactly the case this guards.
		const activeIndex =
			runs.length === 0
				? -1
				: Math.min(Math.max(this.activeRun, 0), runs.length - 1);

		return html`<code
				class=${classMap({ plain: runs.length === 0 })}
				@keydown=${(event: KeyboardEvent) => {
					this.#walk(event);
				}}
				>${
					runs.length === 0
						? this.value
						: runs.map(
								(run, index) => html`<button
								type="button"
								tabindex=${index === activeIndex ? 0 : -1}
								data-tooltip=${run[0]?.hint ?? ""}
								data-group=${run[0]?.group ?? ""}
								aria-label=${`${run[0]?.hint ?? ""} — go to this control`}
								@click=${() => {
									this.dispatchEvent(
										new CustomEvent<string>("slot-jump", {
											detail: run[0]?.group ?? "",
											bubbles: true,
										}),
									);
								}}
								>${run.map(({ char }) => char).join("")}</button
							>`,
							)
				}</code
			>
			<span class="buttons">
				<button
					type="button"
					class="edit"
					@click=${() => {
						this.editing = true;
					}}
				>
					Edit
				</button>
				<button
					type="button"
					class="copy"
					@click=${() => {
						void this.#copy();
					}}
				>
					Copy
				</button>
			</span>`;
	}

	override render() {
		// The page's message wins over the copy status: it answers a question
		// someone is asking right now, while the status answers one they asked a
		// moment ago.
		const message = this.message === "" ? this.status : this.message;

		return html`
			<div class="bar">${this.editing ? this.#editor() : this.#display()}</div>
			<p
				class=${classMap({
					message: true,
					error: this.message === "" ? this.failed : this.invalid,
				})}
				role="status"
				>${message}</p
			>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"code-bar": CodeBar;
	}
}

if (!customElements.get("code-bar")) {
	customElements.define("code-bar", CodeBar);
}
