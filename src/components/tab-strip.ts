import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { base, controls } from "./theme";

export type TabOption = readonly [
	value: string,
	label: string,
	/** Empty for no badge — a mode row has nothing to count. */
	badge: string,
	/**
	 * Why the tab can't be picked, or `null` where it can. The episode decides
	 * this, not the tab itself: Treasures is off for specialExp, for instance,
	 * because the episode takes none.
	 */
	disabled: string | null,
];

/**
 * The tab bar across the top of the controls: Main, Cookies, Treasures,
 * Boosts. One tab stop for the row, the same roving-tabindex rule
 * `<chip-group>` follows, because a tab is chosen the same way a radio is.
 *
 * It owns none of what a tab shows — the route decides that, and swaps the
 * light-DOM panel underneath when `value` changes. This element only draws
 * the row and says which one is current.
 */
export class TabStrip extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			.list {
				display: flex;
				flex-wrap: wrap;
				border-bottom: var(--cr-border) solid var(--cr-line);
			}

			/* Flat rather than the arcade button block: a tab reads as part of
			   the bar it sits in, not as a control raised off it. */
			.tab {
				display: inline-flex;
				align-items: center;
				gap: var(--cr-space-2);
				border: none;
				border-radius: 0;
				box-shadow: none;
				background: transparent;
				padding: var(--cr-space-2) var(--cr-space-3);
				font-family: var(--cr-mono);
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			/* The open tab lifts onto the surface colour, the same raised-tile
			   language the chosen chip and card carry elsewhere on the page. */
			.tab[aria-selected="true"] {
				background: var(--cr-surface);
				font-weight: 600;
			}

			.tab[aria-disabled="true"] {
				color: var(--cr-muted);
				cursor: not-allowed;
			}

			.badge {
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				padding: 0 var(--cr-space-2);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
			}

			/* On the open tab the badge sits on the accent instead, so the count
			   that matters right now is the one that stands out. */
			.tab[aria-selected="true"] .badge {
				background: var(--cr-accent);
				color: var(--cr-bg);
			}

			@media (pointer: coarse) {
				.tab {
					min-height: var(--cr-tap);
				}
			}
		`,
	];

	@property({ attribute: false })
	options: readonly TabOption[] = [];

	/**
	 * Which tab is open. A plain property with no fallback of its own —
	 * `<chip-group>` falls back to its first option because nothing else holds
	 * the "nothing chosen yet" case, but a tab strip always has a route behind
	 * it deciding what `value` is, stored tab included. It renders whatever
	 * this says and nothing more.
	 */
	@property({ type: String })
	value = "";

	#tabs(): HTMLButtonElement[] {
		return [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.tab") ??
				[]),
		];
	}

	#disabled(tab: HTMLButtonElement): boolean {
		return tab.getAttribute("aria-disabled") === "true";
	}

	/**
	 * Commits a pick: writes `value` and fires `tab-change`. The only path that
	 * does either — setting `value` from outside is a plain property write and
	 * triggers neither, which is what keeps a disabled-tab fallback or a
	 * restored "stored tab" from echoing back as a user action.
	 */
	async #choose(value: string): Promise<void> {
		this.value = value;
		this.dispatchEvent(
			new CustomEvent<string>("tab-change", { detail: value, bubbles: true }),
		);
		await this.updateComplete;
	}

	/** A click that changes nothing says nothing, the same rule `<chip-group>` follows. */
	#click(value: string, disabled: string | null): void {
		if (disabled !== null) return;
		if (value === this.value) return;
		void this.#choose(value);
	}

	/** Walks from `at` in `step` steps, skipping disabled tabs, clamped at the ends rather than wrapped. */
	#walkTo(
		tabs: HTMLButtonElement[],
		at: number,
		step: 1 | -1,
	): number | undefined {
		for (let i = at + step; i >= 0 && i < tabs.length; i += step) {
			if (!this.#disabled(tabs[i] as HTMLButtonElement)) return i;
		}
		return undefined;
	}

	/** Home (`dir` 1) or End (`dir` -1): the first enabled tab counting from that end. */
	#endTo(tabs: HTMLButtonElement[], dir: 1 | -1): number | undefined {
		const start = dir === 1 ? 0 : tabs.length - 1;
		for (let i = start; i >= 0 && i < tabs.length; i += dir) {
			if (!this.#disabled(tabs[i] as HTMLButtonElement)) return i;
		}
		return undefined;
	}

	async #walk(event: KeyboardEvent): Promise<void> {
		const tabs = this.#tabs();
		const at = tabs.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const step = {
			ArrowRight: 1 as const,
			ArrowDown: 1 as const,
			ArrowLeft: -1 as const,
			ArrowUp: -1 as const,
		}[event.key];

		if (step === undefined && event.key !== "Home" && event.key !== "End")
			return;

		event.preventDefault();

		const to =
			step !== undefined
				? this.#walkTo(tabs, at, step)
				: this.#endTo(tabs, event.key === "Home" ? 1 : -1);
		if (to === undefined) return;

		const landing = tabs[to];
		if (landing === undefined) return;

		await this.#choose(landing.value);
		// After the await: the choice re-renders, and focus has to follow the
		// tab into its replacement.
		this.#tabs()
			.find((tab) => tab.value === landing.value)
			?.focus();
	}

	override render() {
		return html`
			<div
				class="list"
				role="tablist"
				part="list"
				@keydown=${(event: KeyboardEvent) => {
					void this.#walk(event);
				}}
			>
				${this.options.map(([value, label, badge, disabled]) => {
					const selected = value === this.value;
					return html`<button
						type="button"
						class="tab"
						role="tab"
						.value=${value}
						aria-selected=${String(selected)}
						aria-disabled=${String(disabled !== null)}
						title=${disabled ?? nothing}
						tabindex=${selected ? 0 : -1}
						@click=${() => {
							this.#click(value, disabled);
						}}
					>
						<span>${label}</span>
						${badge ? html`<span class="badge">${badge}</span>` : nothing}
					</button>`;
				})}
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"tab-strip": TabStrip;
	}
}

if (!customElements.get("tab-strip")) {
	customElements.define("tab-strip", TabStrip);
}
