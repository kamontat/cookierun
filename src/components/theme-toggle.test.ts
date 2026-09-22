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

// A real pick fires two native events, `input` then `change`. Only `input` is
// `composed: true`, so only `input` escapes the shadow root unaided - and it
// does so before any handler on the control has run, carrying the theme that
// was in force a moment ago. Handling `change` instead leaves that stale echo
// as the only thing a page outside ever hears, since `change` dies at the
// boundary. So: handle `input`, stop it, and re-dispatch from the host.
test("choosing a theme paints the page, remembers it, and says so once", async () => {
	localStorage.removeItem(THEME_KEY);
	const element = await mount();
	const control = select(element);

	// Recorded rather than asserted in the listener: happy-dom's default
	// `errorCapture: "tryAndCatch"` swallows whatever a listener throws, so an
	// assertion in here would pass whether or not it held.
	const heard: { count: number; theme: string | null } = {
		count: 0,
		theme: null,
	};
	const onInput = () => {
		heard.count += 1;
		heard.theme = document.documentElement.getAttribute("data-theme");
	};
	document.body.addEventListener("input", onInput);

	try {
		control.value = "dark";
		control.dispatchEvent(
			new Event("input", { bubbles: true, composed: true }),
		);
		control.dispatchEvent(new Event("change", { bubbles: true }));

		expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
		expect(localStorage.getItem(THEME_KEY)).toBe("dark");
		expect(heard.count).toBe(1);
		// The page was already dark when the event arrived, which is what tells
		// this apart from the control's own leaked echo.
		expect(heard.theme).toBe("dark");

		control.value = "system";
		control.dispatchEvent(
			new Event("input", { bubbles: true, composed: true }),
		);

		expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
		expect(localStorage.getItem(THEME_KEY)).toBe(null);
		expect(heard.count).toBe(2);
	} finally {
		// document.body outlives this test, and replaceChildren() in the next
		// mount() clears its children rather than its listeners.
		document.body.removeEventListener("input", onInput);
	}
});

// The choice is this element's own state, not a view onto localStorage: a
// browser that refuses writes still gets the theme for the visit, and the
// control has to keep showing what is actually in force rather than snapping
// back to whatever the store does or does not hold at the next render.
test("a re-render keeps showing the chosen theme, not what storage says", async () => {
	localStorage.removeItem(THEME_KEY);
	const element = await mount();
	const control = select(element);

	control.value = "dark";
	control.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await element.updateComplete;

	// A store the choice never reached - exactly the state a browser that
	// refuses `setItem` leaves behind.
	localStorage.removeItem(THEME_KEY);
	element.requestUpdate();
	await element.updateComplete;

	expect(select(element).value).toBe("dark");
	expect(
		[...select(element).options]
			.filter((option) => option.selected)
			.map((option) => option.value),
	).toEqual(["dark"]);

	applyTheme("system", document.documentElement);
});
