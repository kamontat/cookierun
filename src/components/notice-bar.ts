import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

export type NoticeType = "info" | "warn" | "error";

export type NoticeOptions = {
	/** A line above the list, for a message that is several lines. */
	title?: string;
	/**
	 * Keeps an info message up past `infoFor` until `release` is called — for
	 * a message that stays true for as long as something else is open.
	 */
	hold?: boolean;
};

/** The mark each type wears beside its colour. */
const BADGE: Record<NoticeType, string> = { info: "i", warn: "!", error: "×" };

/** How long an info message stays up, in milliseconds. */
const INFO_FOR = 5000;

/**
 * The page's one place for a message. Whatever the page has to say — a code
 * read with changes, a copy that worked, a store the browser refused — goes
 * here, as one of three types, and replaces whatever was showing.
 *
 * It is a strip of one line that is always there, empty when there is nothing
 * to say, so a message arriving or going never changes the height of what it
 * sits in. A list folds behind its title and a count ("Read with changes (2)
 * ▾") until it is opened; a new message starts folded again. Each type wears
 * a badge as well as a colour: i, ! or ×.
 *
 * Info and warn speak through a `role="status"` region, an error through a
 * `role="alert"` one. Both regions are always in the tree, so a screen reader
 * is already listening when a message arrives in either, and a folded list is
 * clipped off the screen rather than taken out of the region, so every line is
 * still heard. An info message clears itself after `infoFor`; warn and error
 * stay until dismissed or replaced, since each has something left to act on.
 */
export class NoticeBar extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			/* One line reserved whether or not anything is showing (see .box):
			   the strip is a fixed part of what holds it, not a box that pushes
			   it taller. */
			:host {
				display: block;
				font-size: 0.9rem;
				line-height: 1.26rem;
			}

			/* Each type's colour comes in through --tone, plumbing rather than a
			   site token: every value it takes is defined in tokens.css. */
			:host([type="info"]) {
				--tone: var(--cr-accent);
			}

			:host([type="warn"]) {
				--tone: var(--cr-blessed);
			}

			:host([type="error"]) {
				--tone: var(--cr-danger);
			}

			/* Badge, message and dismiss button side by side. The reserved line
			   is the box's, not the host's: a rule or padding the page puts on
			   the host would otherwise eat into it, since a page's box-sizing
			   outranks anything :host says. */
			.box {
				min-height: calc(1.26rem + var(--cr-space-1) * 2);
				display: flex;
				flex-direction: row;
				gap: var(--cr-space-2);
				align-items: flex-start;
				padding-block: var(--cr-space-1);
			}

			/* The tone is the badge's ground, never text colour: the amber does
			   not clear 4.5:1 as text on paper. The glyph is the page colour on
			   it, and aria-hidden, since the live region already says which
			   kind of message this is by being a status or an alert. */
			.badge {
				flex: none;
				display: grid;
				place-items: center;
				width: 1.1rem;
				height: 1.1rem;
				margin-top: 0.08rem;
				border-radius: var(--cr-radius);
				background: var(--tone);
				color: var(--cr-bg);
				font-family: var(--cr-mono);
				font-size: 0.75rem;
				font-weight: 700;
				line-height: 1;
			}

			.regions {
				flex: 1 1 auto;
				min-width: 0;
				overflow-wrap: anywhere;
			}

			p,
			ul {
				margin: 0;
			}

			ul {
				display: grid;
				gap: var(--cr-space-1);
				margin-top: var(--cr-space-1);
				padding-left: 1.1rem;
				list-style: disc;
			}

			/* Off the screen, still in the live region. */
			ul.folded {
				position: absolute;
				width: 1px;
				height: 1px;
				margin: 0;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
			}

			/* The fold and the ✕ sit on the strip's one line and never make it
			   taller: no border or padding of their own on a fine pointer, and on
			   a coarse one the tap-sized box hangs over the line by negative
			   margins rather than pushing it apart. --line is the strip's line
			   height, 0.9rem at 1.4, plumbing rather than a site token. */
			button.fold,
			button.dismiss {
				--line: 1.26rem;
				min-height: 0;
				height: var(--line);
				border: 0;
				background: none;
				box-shadow: none;
				padding: 0;
				color: inherit;
				font: inherit;
				line-height: var(--line);
			}

			button.fold:active,
			button.dismiss:active {
				transform: none;
			}

			@media (pointer: coarse) {
				button.fold,
				button.dismiss {
					height: auto;
					min-height: var(--cr-tap);
					margin-block: calc((var(--line) - var(--cr-tap)) / 2);
				}
			}

			button.fold {
				font-weight: 600;
				text-align: start;
				cursor: pointer;
			}

			button.fold .count {
				color: var(--cr-muted);
				font-weight: 400;
			}

			button.dismiss {
				flex: none;
				padding-inline: var(--cr-space-1);
				color: var(--cr-muted);
			}
		`,
	];

	/** How long an info message stays up. A property so a test can shorten it. */
	@property({ attribute: false })
	infoFor = INFO_FOR;

	@state()
	private kind: NoticeType | null = null;

	@state()
	private lines: readonly string[] = [];

	@state()
	private heading = "";

	/** Whether a folded list is open. Every new message starts folded. */
	@state()
	private open = false;

	#held = false;

	#timer: ReturnType<typeof setTimeout> | undefined;

	/** What is showing, or null when nothing is. */
	get type(): NoticeType | null {
		return this.kind;
	}

	/** The title and every line, one per line; empty when nothing shows. */
	get text(): string {
		return [this.heading, ...this.lines]
			.filter((line) => line !== "")
			.join("\n");
	}

	/** Shows a message, replacing whatever was showing. */
	show(
		type: NoticeType,
		text: string | readonly string[],
		options: NoticeOptions = {},
	): void {
		this.kind = type;
		this.lines = typeof text === "string" ? [text] : [...text];
		this.heading = options.title ?? "";
		this.open = false;
		this.#held = options.hold === true;
		this.setAttribute("type", type);
		this.#arm();
	}

	/** Empties the banner. */
	clear(): void {
		this.#disarm();
		this.#held = false;
		this.kind = null;
		this.lines = [];
		this.heading = "";
		this.removeAttribute("type");
	}

	/** Lets a held info message clear itself, from now. */
	release(): void {
		if (!this.#held) return;
		this.#held = false;
		this.#arm();
	}

	override connectedCallback(): void {
		super.connectedCallback();
		// Moving the element disconnects it, which drops the timer; an info
		// message carried along must still go.
		this.#arm();
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		this.#disarm();
	}

	#arm(): void {
		this.#disarm();
		if (this.kind !== "info" || this.#held || !this.isConnected) return;
		this.#timer = setTimeout(() => {
			this.clear();
		}, this.infoFor);
	}

	#disarm(): void {
		clearTimeout(this.#timer);
		this.#timer = undefined;
	}

	/**
	 * Empties the banner from its ✕ and says so. The ✕ goes with the message,
	 * so if it held focus, focus would fall to <body> (or the dialog); this
	 * element cannot know where focus belongs on the page, so it reports
	 * whether the ✕ had it and the page decides.
	 */
	#dismiss(button: HTMLButtonElement): void {
		const focused = this.shadowRoot?.activeElement === button;
		this.clear();
		this.dispatchEvent(
			new CustomEvent<{ focused: boolean }>("notice-dismiss", {
				detail: { focused },
				bubbles: true,
			}),
		);
	}

	#body() {
		if (this.lines.length === 1 && this.heading === "") {
			return html`<p>${this.lines[0]}</p>`;
		}
		const title = this.heading === "" ? (this.lines[0] ?? "") : this.heading;
		return html`<button
				type="button"
				class="fold"
				aria-expanded=${String(this.open)}
				@click=${() => {
					this.open = !this.open;
				}}
			>
				${title} <span class="count">(${this.lines.length})</span>
				<span aria-hidden="true">${this.open ? "▴" : "▾"}</span>
			</button>
			<ul class=${this.open ? "" : "folded"}>
				${this.lines.map((line) => html`<li>${line}</li>`)}
			</ul>`;
	}

	override render() {
		const polite = this.kind === "info" || this.kind === "warn";
		return html`<div class="box">
			${
				this.kind === null
					? nothing
					: html`<span class="badge" aria-hidden="true">${BADGE[this.kind]}</span>`
			}
			<div class="regions">
				<div role="status">${polite ? this.#body() : nothing}</div>
				<div role="alert">${this.kind === "error" ? this.#body() : nothing}</div>
			</div>
			${
				this.kind === null
					? nothing
					: html`<button
							type="button"
							class="dismiss"
							aria-label="Dismiss"
							@click=${(event: Event) => {
								this.#dismiss(event.currentTarget as HTMLButtonElement);
							}}
						>
							<span aria-hidden="true">✕</span>
						</button>`
			}
		</div>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"notice-bar": NoticeBar;
	}
}

if (!customElements.get("notice-bar")) {
	customElements.define("notice-bar", NoticeBar);
}
