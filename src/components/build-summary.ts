import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { base } from "./theme";

/** One picture, and which form of an entry it is where that is a distinction. */
export type SummaryFace = {
	readonly src: string;
	/** `base`, `evolved` or `blessed`; anything else is drawn plain. */
	readonly kind?: string | null;
};

/**
 * One value of the build. A tile stands its faces above its name — that is the
 * loadout, where the picture is the thing you recognise — and a chip sets them
 * side by side, for the rows where the name carries the meaning and the picture
 * only confirms it.
 */
export type SummaryItem = {
	readonly label: string;
	/** What the item is: a role, or a treasure slot's position. */
	readonly note?: string;
	readonly faces?: readonly SummaryFace[];
	readonly shape?: "tile" | "chip";
};

export type SummaryGroup = {
	readonly label: string;
	readonly items: readonly SummaryItem[];
};

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
 * The build in front of you, drawn rather than spelled out: the faces of the
 * cookie, relay, pet and treasures, the episode and boost icons, the cookie
 * power+ portraits, and a plain chip wherever the format has no art — the run
 * type, the random boost and the action have none.
 *
 * It carries the auto verdict too. The verdict is a judgment about the build
 * and the card is the picture of it, so splitting them put the answer and the
 * reason for it a scroll apart.
 */
export class BuildSummary extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			.card {
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface);
				box-shadow: var(--cr-block);
				padding: var(--cr-space-3) var(--cr-space-4) var(--cr-space-4);
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

			.group {
				margin-top: var(--cr-space-4);
			}

			h3 {
				margin: 0 0 var(--cr-space-2);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
				font-weight: 500;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			.items {
				display: flex;
				flex-wrap: wrap;
				align-items: flex-start;
				gap: var(--cr-space-2);
			}

			.item {
				display: flex;
				align-items: center;
				gap: var(--cr-space-2);
				border: 1px solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				padding: 2px var(--cr-space-2) 2px 2px;
				font-size: 0.75rem;
			}

			/* A tile stands its faces over its name, and holds a fixed width so a
			   row of them reads as a row rather than as four different widths. */
			.item.tile {
				display: grid;
				justify-items: center;
				gap: var(--cr-space-1);
				min-width: 5rem;
				max-width: 9rem;
				padding: var(--cr-space-2);
				text-align: center;
			}

			.faces {
				display: flex;
				align-items: center;
				gap: var(--cr-space-1);
			}

			.face {
				--kind: transparent;

				border: 2px solid var(--kind);
				border-radius: var(--cr-radius);
				line-height: 0;
			}

			/* A face with nothing to say about its form takes no ring: a tinted
			   border on every picture is no distinction at all. */
			.face[data-kind="base"] {
				--kind: var(--cr-muted);
			}

			.face[data-kind="evolved"] {
				--kind: var(--cr-evolved);
			}

			.face[data-kind="blessed"] {
				--kind: var(--cr-blessed);
			}

			img {
				width: 30px;
				height: 30px;
				object-fit: contain;
			}

			.tile img {
				width: 40px;
				height: 40px;
			}

			.note {
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.6rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			.or {
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.65rem;
			}
		`,
	];

	/** The build, in reading order. A group with no items is left out by the page. */
	@property({ attribute: false })
	groups: readonly SummaryGroup[] = [];

	/** Null for the hand-played types, where auto vs semi-auto means nothing. */
	@property({ attribute: false })
	verdict: Verdict | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.setAttribute("aria-live", "polite");
	}

	#faces(item: SummaryItem) {
		const faces = item.faces ?? [];
		if (faces.length === 0) return nothing;

		return html`<span class="faces"
			>${faces.map(
				(face, index) =>
					html`${index === 0 ? nothing : html`<span class="or">or</span>`}<span
						class="face"
						data-kind=${face.kind ?? nothing}
						><img src=${face.src} alt="" /></span
					>`,
			)}</span
		>`;
	}

	#item(item: SummaryItem) {
		return html`<span class=${item.shape === "tile" ? "item tile" : "item"}
			>${this.#faces(item)}${
				item.note === undefined
					? nothing
					: html`<span class="note">${item.note}</span>`
			}<span class="label"
				>${item.label}</span
			></span
		>`;
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
		// Nothing at all rather than an empty card: a heading over nothing says
		// less than the blank space it costs.
		if (this.groups.length === 0 && this.verdict === null) return nothing;

		return html`<section class="card">
			<header>
				<h2>Your build</h2>
				${
					this.verdict === null
						? nothing
						: html`<span class="badge"
							>${this.verdict.semi ? "Semi-auto" : "Full auto"}</span
						>`
				}
			</header>
			${this.#verdict()}
			${this.groups.map(
				(group) => html`<div class="group">
					<h3>${group.label}</h3>
					<div class="items">${group.items.map((item) => this.#item(item))}</div>
				</div>`,
			)}
		</section>`;
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
