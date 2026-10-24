import { css, html, LitElement } from "lit";
import { state } from "lit/decorators.js";

import { base, controls } from "./theme";

/**
 * The stylesheet paints dark by default, light under `prefers-color-scheme`,
 * and obeys `data-theme` on the root over both. So the whole feature is:
 * remember a choice, write that attribute, and let the tokens do the rest.
 *
 * Each page carries a tiny inline copy of the read-and-apply step in its head,
 * marked `id="theme-boot"`. Module scripts are deferred, so without it the page
 * paints in the system theme first and flips once this file runs.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "theme";

const THEMES = ["system", "light", "dark"] as const;

const LABELS: Record<Theme, string> = {
	system: "System",
	light: "Light",
	dark: "Dark",
};

/** Storage throws rather than returning null in a locked-down browser. */
type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isTheme(value: unknown): value is Theme {
	return THEMES.includes(value as Theme);
}

export function readTheme(storage: ThemeStorage): Theme {
	try {
		const stored = storage.getItem(THEME_KEY);
		return isTheme(stored) ? stored : "system";
	} catch {
		return "system";
	}
}

export function writeTheme(theme: Theme, storage: ThemeStorage): void {
	try {
		if (theme === "system") storage.removeItem(THEME_KEY);
		else storage.setItem(THEME_KEY, theme);
	} catch {
		// A browser that refuses storage still gets the theme for this page.
	}
}

/** "system" means no attribute at all, which hands the page back to the OS. */
export function applyTheme(theme: Theme, root: HTMLElement): void {
	if (theme === "system") root.removeAttribute("data-theme");
	else root.setAttribute("data-theme", theme);
}

export class ThemeToggle extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			/* The label beside the select rather than over it, so the control is
			   one line in the top bar instead of setting the bar's height. */
			:host {
				display: flex;
				align-items: center;
				gap: var(--cr-space-2);
			}

			label {
				margin: 0;
			}

			.field {
				position: relative;
				display: inline-grid;
			}

			select {
				width: auto;
				font-size: 0.85rem;
			}

			/* A select matches :focus-visible on a mouse click too, so the
			   shared accent ring stayed on the top bar after every theme pick.
			   The owner asked for it gone; the select's own border still marks
			   the control. */
			select:focus-visible {
				outline: none;
			}

			.icon {
				display: none;
			}

			/* iOS Safari zooms the page in on any field it focuses whose text is
			   under 16px, and never zooms back out. A full-size select is the
			   whole fix; the 0.85rem above is a bar-sized detail that is not
			   worth a viewport for. */
			@media (pointer: coarse) {
				select {
					font-size: 1rem;
				}
			}

			/* Under 48rem the bar has no room for a word and a select, so the
			   control is an icon button. The select still takes the tap - it lies
			   over the icon, invisible, so the platform's own picker opens - and
			   the label stays in the accessibility tree as the select's name; it
			   just stops taking up space. */
			@media (width < 48rem) {
				label {
					position: absolute;
					width: 1px;
					height: 1px;
					margin: -1px;
					overflow: hidden;
					clip-path: inset(50%);
					white-space: nowrap;
				}

				.icon {
					display: grid;
					place-items: center;
					min-width: 2rem;
					min-height: 2rem;
					border: var(--cr-border) solid var(--cr-line);
					border-radius: var(--cr-radius);
					background: var(--cr-surface-2);
					box-shadow: var(--cr-block);
					font-size: 1rem;
					line-height: 1;
				}

				select {
					position: absolute;
					inset: 0;
					width: 100%;
					height: 100%;
					min-height: 0;
					opacity: 0;
					cursor: pointer;
				}
			}

			@media (width < 48rem) and (pointer: coarse) {
				.icon {
					min-width: var(--cr-tap);
					min-height: var(--cr-tap);
				}
			}
		`,
	];

	/**
	 * The stored choice, held here rather than read back out of `localStorage`
	 * on every render, so that a pick re-renders the control. Storage is read
	 * once per connection, before the first render, which is what puts the
	 * `<select>` on the remembered theme rather than on `system`.
	 */
	@state()
	private choice: Theme = "system";

	override connectedCallback(): void {
		super.connectedCallback();
		this.choice = readTheme(localStorage);
		applyTheme(this.choice, document.documentElement);
	}

	/**
	 * `input`, not `change`, and stopped: a native select's `input` event is
	 * `bubbles: true, composed: true`, so it escapes this shadow root on its own
	 * carrying nothing the page can use, while the `change` that follows is not
	 * composed and never arrives at all. The host's own `input` is the one
	 * event a listener outside can rely on. Nothing listens for it today - the
	 * rail sits outside both of the combi page's forms - but the rule is the
	 * rule every other control here follows, and a component that is an
	 * exception to it is a trap for whoever wires the next page.
	 */
	#choose(event: Event): void {
		event.stopPropagation();
		const value = (event.target as HTMLSelectElement).value;
		const chosen = isTheme(value) ? value : "system";
		this.choice = chosen;
		applyTheme(chosen, document.documentElement);
		writeTheme(chosen, localStorage);
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		// `.selected`, the IDL property, rather than a `selected` content
		// attribute: once the user has picked an option by hand that option is
		// marked dirty and the attribute stops moving the selection, while the
		// property setter still does. A `.value` binding on the `<select>` itself
		// would not work either - Lit commits an element's own property bindings
		// before rendering its children, so it would run before these `<option>`s
		// existed.
		return html`
			<label for="theme-choice">Theme</label>
			<span class="field">
				<span class="icon" aria-hidden="true">◐</span>
				<select
					id="theme-choice"
					@input=${(event: Event) => {
						this.#choose(event);
					}}
				>
					${THEMES.map(
						(theme) =>
							html`<option value=${theme} .selected=${theme === this.choice}>
								${LABELS[theme]}
							</option>`,
					)}
				</select>
			</span>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"theme-toggle": ThemeToggle;
	}
}

// One `bun test` process shares one registry across every test file.
if (!customElements.get("theme-toggle")) {
	customElements.define("theme-toggle", ThemeToggle);
}
