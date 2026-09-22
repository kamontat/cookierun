import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [value: string, label: string];

/**
 * A row of chips that resolves to one pick — a radio group wearing the site's
 * button look. It replaces a `<select>` wherever the list is short enough to
 * show whole: seeing the twelve episodes at once is the point, and a closed
 * select hides eleven of them behind a click.
 *
 * One tab stop for the group, arrows inside it, the same rule the entry lists
 * follow. Arrows move the choice as well as the focus, which is what a radio
 * group does and what makes a chip row usable without the mouse.
 */
export class ChipGroup extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			.label {
				display: block;
				margin-bottom: var(--cr-space-2);
				color: var(--cr-muted);
				font-size: 0.8rem;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			.chips {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-2);
			}

			.chip {
				box-shadow: none;
				background: var(--cr-surface-2);
				padding: var(--cr-space-2) var(--cr-space-3);
				font-size: 0.8rem;
			}

			/* The chosen chip is the one carrying the accent, and it keeps the
			   offset block so the row reads as one raised tile among flat ones. */
			.chip[aria-checked="true"] {
				border-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 18%, transparent);
				box-shadow: var(--cr-block);
				color: var(--cr-text);
				font-weight: 600;
			}

			.chip:active {
				transform: translate(1px, 1px);
			}
		`,
	];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	/**
	 * Whether clicking the chip already chosen goes back to the first option.
	 *
	 * For a row whose first option is its own "none" — no random boost, no
	 * action — that is how someone undoes a pick, rather than hunting along the
	 * row for the None chip. A row with no "none" to go back to leaves this off,
	 * since a type or an episode is always something.
	 *
	 * A property rather than an attribute: it is the same decision as which
	 * option the route puts first, and it is made where that one is.
	 */
	@property({ attribute: false })
	resettable = false;

	#chosen = "";

	/**
	 * Falls back to the first option whenever `#chosen` names none of them —
	 * nothing picked yet, or an `options` list replaced under the pick. That is
	 * what the `<select>` this replaces read as, and what `render` marks
	 * checked, so the getter can never disagree with what is on screen.
	 */
	get value(): string {
		return this.options.some(([value]) => value === this.#chosen)
			? this.#chosen
			: (this.options[0]?.[0] ?? "");
	}

	set value(value: string) {
		this.#chosen = value;
		this.requestUpdate();
	}

	#chips(): HTMLButtonElement[] {
		return [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.chip") ??
				[]),
		];
	}

	/**
	 * A chip is a `<button>`, so nothing composed escapes on its own the way a
	 * native control's `input` does — but the host still dispatches its own
	 * untargeted `input`, because that is the event the page's form listener
	 * hears.
	 */
	async #choose(value: string): Promise<void> {
		this.#chosen = value;
		this.requestUpdate();
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;
	}

	/**
	 * A click, which is the one route that can reset: the arrow walk moves along
	 * the row and clamps at its ends, so an arrow landing on the chip already
	 * chosen must leave it alone rather than undo it.
	 *
	 * A click that changes nothing says nothing — no event — since `input` from
	 * this host means the value moved.
	 */
	#click(value: string): void {
		const chosen = this.value;
		const next =
			this.resettable && value === chosen
				? (this.options[0]?.[0] ?? "")
				: value;
		if (next === chosen) return;
		void this.#choose(next);
	}

	async #walk(event: KeyboardEvent): Promise<void> {
		const chips = this.#chips();
		const at = chips.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const to = {
			ArrowRight: at + 1,
			ArrowDown: at + 1,
			ArrowLeft: at - 1,
			ArrowUp: at - 1,
			Home: 0,
			End: chips.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		// Clamped rather than wrapped: an arrow that jumps from the last chip to
		// the first reads as a lost keypress.
		const landing = chips[Math.min(Math.max(to, 0), chips.length - 1)];
		if (landing === undefined) return;

		await this.#choose(landing.value);
		// After the await: the choice re-renders, and focus has to follow the
		// chip into its replacement.
		this.#chips()
			.find((chip) => chip.value === landing.value)
			?.focus();
	}

	override render() {
		const chosen = this.value;

		return html`
			<span class="label">${this.label}</span>
			<div
				class="chips"
				role="radiogroup"
				aria-label=${this.label}
				@keydown=${(event: KeyboardEvent) => {
					void this.#walk(event);
				}}
			>
				${this.options.map(
					([value, text]) => html`<button
						type="button"
						class="chip"
						role="radio"
						.value=${value}
						aria-checked=${String(value === chosen)}
						tabindex=${value === chosen ? 0 : -1}
						@click=${() => {
							this.#click(value);
						}}
					>
						${text}
					</button>`,
				)}
			</div>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"chip-group": ChipGroup;
	}
}

if (!customElements.get("chip-group")) {
	customElements.define("chip-group", ChipGroup);
}
