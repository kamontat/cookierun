/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { applyTheme, readTheme, THEME_KEY, writeTheme } from "./theme-toggle";

import "./theme-toggle";

import type { ThemeToggle } from "./theme-toggle";

function fakeStorage(seed: Record<string, string> = {}) {
	const store = new Map(Object.entries(seed));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
		read: () => store.get(THEME_KEY) ?? null,
	};
}

async function mount(): Promise<ThemeToggle> {
	document.body.replaceChildren();
	const element = document.createElement("theme-toggle") as ThemeToggle;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function select(element: ThemeToggle): HTMLSelectElement {
	const found = element.shadowRoot?.querySelector("select");
	if (found === null || found === undefined) throw new Error("no select");
	return found;
}

test("an unset or unrecognised choice falls back to following the system", () => {
	expect(readTheme(fakeStorage())).toBe("system");
	expect(readTheme(fakeStorage({ [THEME_KEY]: "sepia" }))).toBe("system");
	expect(readTheme(fakeStorage({ [THEME_KEY]: "dark" }))).toBe("dark");
});

// The stylesheet reads prefers-color-scheme only when the attribute is absent,
// so "system" has to remove it rather than write some third value.
test("applying system removes the attribute instead of setting one", () => {
	const root = document.createElement("html");

	applyTheme("dark", root);
	expect(root.getAttribute("data-theme")).toBe("dark");

	applyTheme("system", root);
	expect(root.hasAttribute("data-theme")).toBe(false);
});

test("system is stored as the absence of a choice", () => {
	const storage = fakeStorage({ [THEME_KEY]: "light" });

	writeTheme("dark", storage);
	expect(storage.read()).toBe("dark");

	writeTheme("system", storage);
	expect(storage.read()).toBe(null);
});

// Called as functions on purpose. A custom element reports a callback
// exception to the global error handler rather than throwing to whoever
// appended it, so going through <theme-toggle> here would pass either way.
test("a browser that refuses storage still themes the page", () => {
	const hostile = {
		getItem: () => {
			throw new Error("denied");
		},
		setItem: () => {
			throw new Error("denied");
		},
		removeItem: () => {
			throw new Error("denied");
		},
	};

	expect(readTheme(hostile)).toBe("system");
	expect(() => writeTheme("dark", hostile)).not.toThrow();
	expect(() =>
		applyTheme("dark", document.createElement("html")),
	).not.toThrow();
});

test("the control offers the three choices and starts on the stored one", async () => {
	localStorage.setItem(THEME_KEY, "light");
	const element = await mount();

	expect([...select(element).options].map((option) => option.value)).toEqual([
		"system",
		"light",
		"dark",
	]);
	expect(select(element).value).toBe("light");
	expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	expect(element.shadowRoot?.querySelector("label")?.htmlFor).toBe(
		select(element).id,
	);

	localStorage.removeItem(THEME_KEY);
	applyTheme("system", document.documentElement);
});

test("choosing a theme paints the page and remembers it", async () => {
	localStorage.removeItem(THEME_KEY);
	const element = await mount();
	const control = select(element);

	control.value = "dark";
	control.dispatchEvent(new Event("change"));

	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	expect(localStorage.getItem(THEME_KEY)).toBe("dark");

	control.value = "system";
	control.dispatchEvent(new Event("change"));

	expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	expect(localStorage.getItem(THEME_KEY)).toBe(null);
});
