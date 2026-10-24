import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";

import { base } from "./theme";

/**
 * One thing a summary row says. Declared here rather than imported from the
 * combi route: components never import from routes, and the route builds
 * these from its own words and pictures.
 */
export type SummaryItem =
	| {
			kind: "text";
			text: string;
			muted?: boolean;
			/**
			 * Drawn only once its row is toggled, like the pictures' names: a
			 * detail the row can do without at a glance — why a run is
			 * semi-auto, say.
			 */
			detail?: boolean;
	  }
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
			/**
			 * Which form of a treasure the picture is. An evolved one and the
			 * blessed one beside it wear the same picture, so this is drawn on it:
			 * the kind's letter in the top corner and a ring in its colour, the
			 * same cues the treasure picker uses, and its name in the picture's
			 * alt text. A base form carries none.
			 */
			mark?: Mark;
			/**
			 * The name, drawn small under the picture. A phone has no hover, so a
			 * title alone hides the name there; the caption says it everywhere.
			 */
			caption?: string;
	  }
	/** At most two faces, overlapping, then a name. */
	| {
			kind: "stack";
			srcs: readonly string[];
			text?: string;
			title?: string;
			/** The name under the faces, as for an image. */
			caption?: string;
	  }
	| { kind: "sep"; text: "·" | "→" }
	| { kind: "tag"; text: string };

/** Declared here, not imported: components never import from routes. */
export type Mark = "evolved" | "blessed";

const MARKS: Record<Mark, { letter: string; name: string }> = {
	evolved: { letter: "E", name: "Evolved" },
	blessed: { letter: "B", name: "Blessed" },
};

/**
 * Whether a row has something its toggle shows: pictures with names, or a
 * detail line.
 */
function pictured(row: SummaryRow): boolean {
	return row.items.some(
		(entry) =>
			((entry.kind === "image" || entry.kind === "stack") &&
				entry.caption !== undefined) ||
			(entry.kind === "text" && entry.detail === true),
	);
}

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
function stackName(
	entry: Extract<SummaryItem, { kind: "stack" }>,
	names: boolean,
) {
	if (entry.text !== undefined) return entry.text;
	if (entry.caption !== undefined && names) {
		return html`<span class="caption">${entry.caption}</span>`;
	}
	if (entry.caption !== undefined && entry.srcs.length > 0) {
		return html`<span class="hidden">${entry.caption}</span>`;
	}
	if (entry.title === undefined) return nothing;
	return entry.srcs.length === 0
		? entry.title
		: html`<span class="hidden">${entry.title}</span>`;
}

/**
 * An image's words for a screen reader: none when its text already says it,
 * otherwise its title, with the kind's name when it carries one.
 */
function pictureAlt(
	entry: Extract<SummaryItem, { kind: "image" }>,
	names: boolean,
): string {
	if (entry.text !== undefined) return "";
	if (entry.caption !== undefined && names) return "";
	// Hidden, the caption is still the picture's name: shorter than a title
	// that lists a treasure slot's alternatives.
	const title = entry.caption ?? entry.title ?? "";
	return entry.mark === undefined
		? title
		: `${title}, ${MARKS[entry.mark].name}`;
}

/**
 * An image's name line under its picture: the name, the level note beside it,
 * and the kind's name for a screen reader, since the letter on the picture is
 * hidden from one.
 */
function caption(entry: Extract<SummaryItem, { kind: "image" }>) {
	return html`<span class="caption"
		>${entry.caption}${
			entry.note === undefined
				? nothing
				: html` <span class="note">${entry.note}</span>`
		}${
			entry.mark === undefined
				? nothing
				: html`<span class="hidden">, ${MARKS[entry.mark].name}</span>`
		}</span
	>`;
}

function item(entry: SummaryItem, names = false) {
	switch (entry.kind) {
		case "text":
			if (entry.detail && !names) return nothing;
			return html`<span class=${entry.muted ? "text muted" : "text"}
				>${entry.text}</span
			>`;
		case "pill":
			return html`<span class=${entry.tone === "semi" ? "pill semi" : "pill"}
				>${entry.text}</span
			>`;
		case "image":
			return html`<span
				class=${entry.caption === undefined ? "image" : "image cell"}
				title=${entry.title ?? nothing}
				>${
					entry.src === null
						? nothing
						: html`<span class="pic" data-mark=${entry.mark ?? nothing}
								><img
									src=${entry.src}
									alt=${pictureAlt(entry, names)}
									loading="lazy"
								/>${
									entry.mark === undefined
										? nothing
										: html`<span class="mark" aria-hidden="true"
												>${MARKS[entry.mark].letter}</span
											>`
								}${
									entry.badge === undefined
										? nothing
										: html`<span class="badge">${entry.badge}</span>`
								}</span
							>`
				}${
					entry.src === null && entry.badge !== undefined
						? html`<span class="badge">${entry.badge}</span>`
						: nothing
				}${
					entry.caption === undefined
						? html`${entry.text ?? (entry.src === null ? (entry.title ?? nothing) : nothing)}${
								entry.note === undefined
									? nothing
									: html`<span class="note">${entry.note}</span>`
							}`
						: names
							? caption(entry)
							: nothing
				}</span
			>`;
		case "stack":
			return html`<span
				class=${entry.caption === undefined ? "stack" : "stack cell"}
				title=${entry.title ?? nothing}
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
				}${stackName(entry, names)}</span
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
			}

			.row {
				display: grid;
				grid-template-columns: 7rem minmax(0, 1fr) auto;
				align-items: center;
				gap: var(--cr-space-3);
				padding: var(--cr-space-2);
			}

			/* The way to the tab, at the end of the row: the pictures themselves
			   now show and hide names, so opening the tab needs its own place. */
			.open {
				align-self: stretch;
				min-width: 2rem;
				border-radius: var(--cr-radius);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 1.25rem;
				text-align: center;
			}

			.open:hover {
				background: var(--cr-surface-2);
				color: var(--cr-accent);
			}

			.names {
				border-radius: var(--cr-radius);
				padding: var(--cr-space-1);
			}

			.names:hover {
				background: var(--cr-surface-2);
			}

			/* Every picture sits in the same box, whatever its art, so a row of
			   them lines up as a grid. Showing a row's names widens its boxes alike. */
			.image.cell,
			.stack.cell {
				flex-direction: column;
				/* Room for the +N badge, which hangs below the picture's corner. */
				gap: 0.35rem;
				width: 2.75rem;
				text-align: center;
			}

			.row[data-names] .image.cell,
			.row[data-names] .stack.cell {
				width: 6rem;
			}

			.cell .pic,
			.cell .faces {
				display: flex;
				justify-content: center;
				align-items: center;
				width: 2.75rem;
				height: 2.75rem;
			}

			.cell .pic img {
				width: 2.5rem;
				height: 2.5rem;
			}

			.cell .faces img {
				width: 2.1rem;
				height: 2.1rem;
			}

			.cell .faces img + img {
				margin-left: -1.45rem;
			}

			/* A separator between pictures lines up with the pictures, not with
			   the names under them. */
			.names .sep {
				align-self: flex-start;
				line-height: 2.75rem;
			}

			/* A hairline between sections, so each row reads as its own tab's
			   line rather than one block of pictures. */
			.row + .row {
				border-top: 1px solid var(--cr-line);
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

			/* A name under its picture wraps rather than widening the box: two
			   lines at most, then an ellipsis, with the whole name in the title. */
			.caption {
				display: -webkit-box;
				overflow: hidden;
				-webkit-box-orient: vertical;
				-webkit-line-clamp: 2;
				font-size: 0.7rem;
				line-height: 1.25;
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

			.pic[data-mark="evolved"] {
				--mark: var(--cr-evolved);
			}

			.pic[data-mark="blessed"] {
				--mark: var(--cr-blessed);
			}

			.pic[data-mark] img {
				border-radius: 50%;
				box-shadow: 0 0 0 var(--cr-border) var(--mark);
			}

			.mark {
				position: absolute;
				top: -0.35rem;
				left: -0.4rem;
				border-radius: var(--cr-radius);
				background: var(--mark);
				padding: 0 0.2rem;
				color: var(--cr-bg);
				font-family: var(--cr-mono);
				font-size: 0.6rem;
				font-weight: 700;
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
					flex-wrap: nowrap;
					width: 100%;
					padding: var(--cr-space-1) var(--cr-space-2);
				}

				/* One line whatever the build: what does not fit fades out at the
				   end instead of wrapping, and the arrow stays on show. The full
				   picture is one tap away. */
				.lineitems {
					display: flex;
					flex: 1 1 auto;
					flex-wrap: nowrap;
					align-items: center;
					gap: var(--cr-space-1) var(--cr-space-2);
					min-width: 0;
					overflow: hidden;
					white-space: nowrap;
					mask-image: linear-gradient(
						to right,
						black calc(100% - 1.5rem),
						transparent
					);
				}

				.lineitems > * {
					flex: none;
				}

				:host([expanded]) .hide {
					display: block;
					margin-left: auto;
					color: var(--cr-muted);
					font-size: 0.8rem;
				}

				/* The label stands over the pictures, and the way to the tab
				   keeps the right edge for the whole height of the row:
				   [label / data] | [›], the same column the desktop row has. */
				.row {
					grid-template-columns: minmax(0, 1fr) auto;
					grid-template-areas:
						"label open"
						"value open";
					gap: var(--cr-space-1) var(--cr-space-2);
				}

				.row .label {
					grid-area: label;
				}

				.row .value {
					grid-area: value;
				}

				.row .open {
					grid-area: open;
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

	/**
	 * The rows, by target, whose pictures' names are on show. Pictures lead and
	 * a row's names are one click away — on a phone as much as anywhere, since
	 * it has no hover. Each row has its own switch (the owner's call).
	 */
	@state()
	private named: ReadonlySet<string> = new Set();

	#toggleNames(target: string): void {
		const next = new Set(this.named);
		if (next.has(target)) next.delete(target);
		else next.add(target);
		this.named = next;
	}

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
				<span class="lineitems">${this.compact.map((entry) => item(entry))}</span
				><span class="sep" aria-hidden="true">▾</span>
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
						html`<div
							class="row"
							data-target=${row.target}
							?data-names=${this.named.has(row.target)}
						>
							<span class="label">${row.label}</span>${
								pictured(row)
									? html`<button
											type="button"
											class="value names"
											aria-pressed=${String(this.named.has(row.target))}
											title=${this.named.has(row.target) ? "Hide names" : "Show names"}
											@click=${() => this.#toggleNames(row.target)}
										>
											${row.items.map((entry) =>
												item(entry, this.named.has(row.target)),
											)}
										</button>`
									: html`<span class="value"
											>${row.items.map((entry) => item(entry))}</span
										>`
							}<button
								type="button"
								class="open"
								aria-label=${`Open ${row.label}`}
								title=${`Open ${row.label}`}
								@click=${() => this.#jump(row.target)}
							>
								<span aria-hidden="true">›</span>
							</button>
						</div>`,
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
