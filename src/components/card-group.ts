import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	/**
	 * Every picture this option wears. A list rather than one image because some
	 * cookie power+ entries belong to several cookies or pets at once; empty
	 * means the option has no art and falls back to a lettered tile.
	 */
	images: readonly string[],
];

/** The initials a card falls back to when the entry has no portrait. */
function glyphFor(label: string): string {
	return label
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

/**
 * A grid of picture cards, any number of them on at once. It replaces a column
 * of checkboxes wherever the options have faces: a cookie power+ list reads far
 * faster as seven portraits than as seven names.
 *
 * Every card is its own tab stop rather than a roving group — these are
 * independent toggles, not one choice among several, and the longest list here
 * is seven.
 */
export class CardGroup extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			fieldset {
				margin: 0;
				border: none;
				padding: 0;
			}

			legend {
				margin-bottom: var(--cr-space-2);
				padding: 0;
				color: var(--cr-muted);
				font-size: 0.8rem;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			.cards {
				display: grid;
				grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
				gap: var(--cr-space-2);
			}

			.card {
				display: flex;
				flex-direction: column;
				align-items: center;
				gap: var(--cr-space-2);
				box-shadow: none;
				background: var(--cr-surface-2);
				padding: var(--cr-space-3) var(--cr-space-2);
				text-transform: none;
				letter-spacing: normal;
				font-family: var(--cr-font);
			}

			/* A card that is on carries the accent and the offset block, so the
			   picked ones read as raised out of the grid. */
			.card[aria-checked="true"] {
				border-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 18%, transparent);
				box-shadow: var(--cr-block);
				font-weight: 600;
			}

			.card:active {
				transform: translate(1px, 1px);
			}

			.art {
				display: grid;
				place-items: center;
				width: 3.5rem;
				height: 3.5rem;
			}

			/* The image carries the frame's measurements rather than a percentage
			   of them: the frame is a grid area, so a percentage has nothing
			   definite to resolve against and the portrait falls back to its own
			   height, overflowing the card. The two lengths stay in step. */
			.art img {
				width: 3.5rem;
				height: 3.5rem;
				object-fit: contain;
			}

			/* Several faces share the one frame: a pair side by side, three or
			   four in a square. Each is sized to its share of it, since the
			   frame is what the row of cards is aligned to. */
			.art[data-count="2"] {
				grid-template-columns: repeat(2, 1fr);
				gap: 0.1rem;
			}

			.art[data-count="2"] img {
				width: 1.7rem;
				height: 3.5rem;
			}

			.art[data-count="3"],
			.art[data-count="4"] {
				grid-template-columns: repeat(2, 1fr);
				gap: 0.1rem;
			}

			.art[data-count="3"] img,
			.art[data-count="4"] img {
				width: 1.7rem;
				height: 1.7rem;
			}

			.glyph {
				display: grid;
				place-items: center;
				width: 100%;
				height: 100%;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-bg);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 1.1rem;
				letter-spacing: var(--cr-tracking);
			}

			.name {
				font-size: 0.8rem;
				line-height: 1.25;
				text-align: center;
			}

			/* Off is the quiet state. In the accent colour it read as a complaint
			   about the card rather than as its current setting. */
			.tick {
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
				letter-spacing: var(--cr-tracking);
			}

			.card[aria-checked="true"] .tick {
				color: var(--cr-accent);
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private ticked: ReadonlySet<string> = new Set();

	/**
	 * Filters the element's own `options` rather than reading the rendered
	 * cards, so the answer comes back in option order — part of the wire format,
	 * not a preference.
	 */
	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.ticked.has(value));
	}

	set selected(values: readonly string[]) {
		this.ticked = new Set(values.filter((value) => this.#has(value)));
	}

	override willUpdate(): void {
		// `options` and the selection are two separate writes, so a list replaced
		// under a pick would otherwise leave the dropped value in the set —
		// invisible while it has no card, and back the moment a later list
		// contains it again.
		const kept = [...this.ticked].filter((value) => this.#has(value));
		if (kept.length !== this.ticked.size) this.ticked = new Set(kept);
	}

	#has(value: string): boolean {
		return this.options.some(([candidate]) => candidate === value);
	}

	#toggle(value: string): void {
		const next = new Set(this.ticked);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		this.ticked = next;
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		return html`
			<fieldset>
				<legend>${this.legend}</legend>
				<div class="cards">
					${this.options.map(([value, label, images]) => {
						const on = this.ticked.has(value);
						return html`<button
							type="button"
							class="card"
							role="checkbox"
							.value=${value}
							aria-checked=${String(on)}
							@click=${() => {
								this.#toggle(value);
							}}
						>
							<span class="art" data-count=${String(images.length)}>
								${
									images.length === 0
										? html`<span class="glyph" aria-hidden="true"
												>${glyphFor(label)}</span
											>`
										: images.map(
												(image) =>
													html`<img src=${image} alt="" loading="lazy" />`,
											)
								}
							</span>
							<span class="name">${label}</span>
							<span class="tick" aria-hidden="true">${on ? "ON" : "OFF"}</span>
						</button>`;
					})}
				</div>
			</fieldset>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"card-group": CardGroup;
	}
}

if (!customElements.get("card-group")) {
	customElements.define("card-group", CardGroup);
}
