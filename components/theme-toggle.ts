/**
 * Pico paints light by default, dark under `prefers-color-scheme`, and obeys
 * `data-theme` on the root over both. So the whole feature is: remember a
 * choice, write that attribute, and let the stylesheet do the rest.
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
	if (theme === "system") delete root.dataset.theme;
	else root.dataset.theme = theme;
}

/**
 * Exported as a function as well as wrapped in the element below, because a
 * custom element swallows a callback exception into the global error handler.
 * The storage-refused test has to call something that can actually throw.
 */
export function renderThemeControl(
	host: HTMLElement,
	root: HTMLElement = document.documentElement,
	storage: ThemeStorage = localStorage,
): void {
	const select = document.createElement("select");
	select.id = "theme-choice";
	select.replaceChildren(
		...THEMES.map((theme) => {
			const option = document.createElement("option");
			option.value = theme;
			option.textContent = LABELS[theme];
			return option;
		}),
	);

	const current = readTheme(storage);
	select.value = current;
	applyTheme(current, root);

	select.addEventListener("change", () => {
		const chosen = isTheme(select.value) ? select.value : "system";
		applyTheme(chosen, root);
		writeTheme(chosen, storage);
	});

	const label = document.createElement("label");
	label.htmlFor = select.id;
	label.textContent = "Theme";

	host.replaceChildren(label, select);
}

export class ThemeToggle extends HTMLElement {
	connectedCallback(): void {
		renderThemeControl(this);
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
