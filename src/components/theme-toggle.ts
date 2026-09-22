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
			:host {
				display: block;
			}

			select {
				margin-top: var(--cr-space-1);
				font-size: 0.85rem;
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
