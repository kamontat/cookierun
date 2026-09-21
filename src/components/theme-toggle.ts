import { css, html, LitElement } from "lit";

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

	override connectedCallback(): void {
		super.connectedCallback();
		applyTheme(readTheme(localStorage), document.documentElement);
	}

	#choose(event: Event): void {
		const value = (event.target as HTMLSelectElement).value;
		const chosen = isTheme(value) ? value : "system";
		applyTheme(chosen, document.documentElement);
		writeTheme(chosen, localStorage);
	}

	override render() {
		const current = readTheme(localStorage);
		return html`
			<label for="theme-choice">Theme</label>
			<select
				id="theme-choice"
				.value=${current}
				@change=${(event: Event) => {
					this.#choose(event);
				}}
			>
				${THEMES.map(
					(theme) =>
						html`<option value=${theme} ?selected=${theme === current}>
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
