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

/** How long an info message stays up, in milliseconds. */
const INFO_FOR = 5000;

/**
 * The page's one place for a message. Whatever the page has to say — a code
 * read with changes, a copy that worked, a store the browser refused — goes
 * here, as one of three types, and replaces whatever was showing.
 *
 * Info and warn speak through a `role="status"` region, an error through a
 * `role="alert"` one. Both regions are always in the tree, so a screen reader
 * is already listening when a message arrives in either. An info message
 * clears itself after `infoFor`; warn and error stay until dismissed or
 * replaced, since each has something left to act on.
 *
 * Empty, the element takes no room and no grid track (it is positioned out of
 * flow, visually hidden), but stays in the accessibility tree: a live region
 * that is `display: none` until it has something to say is often not heard
 * saying it.
 */
export class NoticeBar extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			:host(:not([type])) {
				position: absolute;
				width: 1px;
				height: 1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
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

			/* The message and its dismiss button side by side. */
			.box {
				display: flex;
				flex-direction: row;
				gap: var(--cr-space-2);
				align-items: flex-start;
			}

			:host([type]) .box {
				border: var(--cr-border) solid var(--tone);
				border-left-width: calc(var(--cr-border) * 3);
				border-radius: var(--cr-radius);
				background: color-mix(in srgb, var(--tone) 12%, var(--cr-surface));
				padding: var(--cr-space-2) var(--cr-space-3);
			}

			.regions {
				flex: 1 1 auto;
				min-width: 0;
				font-size: 0.9rem;
				overflow-wrap: anywhere;
			}

			p,
			ul {
				margin: 0;
			}

			ul {
				display: grid;
				gap: var(--cr-space-1);
				padding-left: 1.1rem;
				list-style: disc;
			}

			/* Body text rather than the tone: the tone is the box's edge and wash,
			   and the amber does not clear 4.5:1 as text on paper. */
			strong {
				display: block;
				margin-bottom: var(--cr-space-1);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			button.dismiss {
				flex: none;
				border-color: transparent;
				background: none;
				box-shadow: none;
				padding: 0 var(--cr-space-1);
				line-height: 1.4;
			}

			button.dismiss:active {
				transform: none;
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
		return html`${this.heading === "" ? nothing : html`<strong>${this.heading}</strong>`}<ul>
				${this.lines.map((line) => html`<li>${line}</li>`)}
			</ul>`;
	}

	override render() {
		const polite = this.kind === "info" || this.kind === "warn";
		return html`<div class="box">
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
