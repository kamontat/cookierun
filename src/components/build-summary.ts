import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";

import { base } from "./theme";

/**
 * One thing a summary row says. Declared here rather than imported from the
 * combi route: components never import from routes, and the route builds
 * these from its own words and pictures.
 */
export type SummaryItem =
	| { kind: "text"; text: string; muted?: boolean }
	| { kind: "pill"; text: string; tone?: "semi" }
	| {
			kind: "image";
			/**
			 * Null draws the text alone, rather than a broken picture — or the
			 * title, when there is no text either, so no item is ever invisible.
			 */
			src: string | null;
			text?: string;
			/** The hover text, for what the picture alone leaves out. */
			title?: string;
			/** Drawn in the picture's corner, as `+N`. */
			badge?: string;
			/** The small level text beside the picture. */
			note?: string;
	  }
	/** At most two faces, overlapping, then a name. */
	| { kind: "stack"; srcs: readonly string[]; text?: string; title?: string }
	| { kind: "sep"; text: "·" | "→" }
	| { kind: "tag"; text: string };

export type SummaryRow = {
	label: string;
	/** Opaque to this element: the route maps it to a tab and a control. */
	target: string;
	items: readonly SummaryItem[];
};

/**
 * What a stack says in words. Its own text when it has some; otherwise its
 * title, which is on screen only when there are no faces to say it with, and
 * kept for a screen reader when there are — the faces themselves are unnamed,
 * since a pair of portraits is one thing, not two.
 */
function stackName(entry: Extract<SummaryItem, { kind: "stack" }>) {
	if (entry.text !== undefined) return entry.text;
	if (entry.title === undefined) return nothing;
	return entry.srcs.length === 0
		? entry.title
		: html`<span class="hidden">${entry.title}</span>`;
}

function item(entry: SummaryItem) {
	switch (entry.kind) {
		case "text":
			return html`<span class=${entry.muted ? "text muted" : "text"}
				>${entry.text}</span
			>`;
		case "pill":
			return html`<span class=${entry.tone === "semi" ? "pill semi" : "pill"}
				>${entry.text}</span
			>`;
		case "image":
			return html`<span class="image" title=${entry.title ?? nothing}
				>${
					entry.src === null
						? nothing
						: html`<span class="pic"
								><img
									src=${entry.src}
									alt=${entry.text === undefined ? (entry.title ?? "") : ""}
									loading="lazy"
								/>${
									entry.badge === undefined
										? nothing
										: html`<span class="badge">${entry.badge}</span>`
								}</span
							>`
				}${
					entry.src === null && entry.badge !== undefined
						? html`<span class="badge">${entry.badge}</span>`
						: nothing
				}${entry.text ?? (entry.src === null ? (entry.title ?? nothing) : nothing)}${
					entry.note === undefined
						? nothing
						: html`<span class="note">${entry.note}</span>`
				}</span
			>`;
		case "stack":
			return html`<span class="stack" title=${entry.title ?? nothing}
				>${
					entry.srcs.length === 0
						? nothing
						: html`<span class="faces"
								>${entry.srcs
									.slice(0, 2)
									.map(
										(src) => html`<img src=${src} alt="" loading="lazy" />`,
									)}</span
							>`
				}${stackName(entry)}</span
			>`;
		case "sep":
			return html`<span class="sep" aria-hidden="true">${entry.text}</span>`;
		case "tag":
			return html`<span class="tag">${entry.text}</span>`;
	}
}

/**
 * The whole build at a glance, with pictures: one row per tab, and each row a
 * way to the control behind it. It reads the build and changes nothing, so it
 * never fires `input` — the page re-renders the build on `input`, and the
 * summary is a picture of that build, not a control in it — and asks for a
 * control with `summary-jump` instead.
 *
 * On a phone it opens folded to one compact line; tapping the line shows the
 * rows, and Hide folds them again. That is this element's own state, never
 * remembered and never announced.
 */
export class BuildSummary extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			button {
				border: 0;
				background: none;
				padding: 0;
				color: inherit;
				font: inherit;
				text-align: left;
				cursor: pointer;
			}

			button:focus-visible {
				outline: var(--cr-border) solid var(--cr-accent);
				outline-offset: 2px;
			}

			.rows {
				display: grid;
				gap: var(--cr-space-1);
			}

			.row {
				display: grid;
				grid-template-columns: 7rem 1fr;
				align-items: center;
				gap: var(--cr-space-3);
				border-radius: var(--cr-radius);
				padding: var(--cr-space-1) var(--cr-space-2);
			}

			.row:hover {
				background: var(--cr-surface-2);
			}

			.label {
				color: var(--cr-muted);
				font-size: 0.75rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			.value,
			.line {
				display: flex;
				flex-wrap: wrap;
				align-items: center;
				gap: var(--cr-space-1) var(--cr-space-2);
				min-width: 0;
			}

			.muted,
			.sep,
			.hint {
				color: var(--cr-muted);
			}

			.muted {
				font-size: 0.85rem;
			}

			.pill,
			.tag {
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				padding: 0 var(--cr-space-2);
				font-family: var(--cr-mono);
				font-size: 0.75rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			.pill {
				border-color: var(--cr-accent);
				color: var(--cr-accent);
			}

			.pill.semi {
				border-color: var(--cr-accent-2);
				color: var(--cr-accent-2);
			}

			.tag {
				color: var(--cr-muted);
			}

			.image,
			.stack {
				display: inline-flex;
				align-items: center;
				gap: var(--cr-space-1);
			}

			.hidden {
				position: absolute;
				width: 1px;
				height: 1px;
				margin: -1px;
				overflow: hidden;
				clip-path: inset(50%);
				white-space: nowrap;
			}

			.pic {
				position: relative;
				display: inline-flex;
			}

			img {
				width: 1.75rem;
				height: 1.75rem;
				object-fit: contain;
			}

			.badge {
				position: absolute;
				right: -0.4rem;
				bottom: -0.3rem;
				border-radius: var(--cr-radius);
				background: var(--cr-accent);
				padding: 0 0.2rem;
				color: var(--cr-bg);
				font-family: var(--cr-mono);
				font-size: 0.6rem;
				line-height: 1.2;
			}

			.image > .badge {
				position: static;
			}

			.note {
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
			}

			.faces {
				display: inline-flex;
			}

			.faces img + img {
				margin-left: -0.75rem;
			}

			.hint {
				margin: var(--cr-space-1) 0 0;
				padding: 0 var(--cr-space-2);
				font-size: 0.85rem;
			}

			.line,
			.hide {
				display: none;
			}

			@media (width < 48rem) {
				:host(:not([expanded])) .rows {
					display: none;
				}

				:host(:not([expanded])) .line {
					display: flex;
					width: 100%;
					padding: var(--cr-space-1) var(--cr-space-2);
				}

				:host([expanded]) .hide {
					display: block;
					margin-left: auto;
					color: var(--cr-muted);
					font-size: 0.8rem;
				}

				.row {
					grid-template-columns: 1fr;
					gap: var(--cr-space-1);
				}
			}

			@media (pointer: coarse) {
				.row,
				.line,
				.hide {
					min-height: var(--cr-tap);
				}
			}
		`,
	];

	@property({ attribute: false })
	rows: readonly SummaryRow[] = [];

	/** The one line a phone shows folded. */
	@property({ attribute: false })
	compact: readonly SummaryItem[] = [];

	/** The muted line under the rows, when there is little else to say. */
	@property({ attribute: false })
	hint: string | null = null;

	@state()
	private expanded = false;

	override updated(): void {
		// Reflected by hand: the fold is this element's own, not a property the
		// page sets, but the stylesheet reads it off the host.
		this.toggleAttribute("expanded", this.expanded);
	}

	/**
	 * The button pressed disappears with the fold, so focus moves to the one
	 * that takes its place rather than falling back to the page.
	 */
	async #fold(expanded: boolean): Promise<void> {
		this.expanded = expanded;
		await this.updateComplete;
		this.renderRoot
			.querySelector<HTMLButtonElement>(expanded ? ".hide" : ".line")
			?.focus();
	}

	#jump(target: string): void {
		this.dispatchEvent(
			new CustomEvent<string>("summary-jump", {
				detail: target,
				bubbles: true,
			}),
		);
	}

	override render() {
		return html`<button
				type="button"
				class="line"
				aria-expanded="false"
				@click=${() => this.#fold(true)}
			>
				${this.compact.map(item)}<span class="sep" aria-hidden="true">▾</span>
			</button>
			<div class="rows">
				<button
					type="button"
					class="hide"
					@click=${() => this.#fold(false)}
				>
					Hide ▴
				</button>
				${this.rows.map(
					(row) =>
						html`<button
							type="button"
							class="row"
							data-target=${row.target}
							@click=${() => this.#jump(row.target)}
						>
							<span class="label">${row.label}</span
							><span class="value">${row.items.map(item)}</span>
						</button>`,
				)}
				${this.hint === null ? nothing : html`<p class="hint">${this.hint}</p>`}
			</div>`;
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
