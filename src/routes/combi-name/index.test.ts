/// <reference lib="dom" />

import { expect, test } from "bun:test";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();
const body = page.slice(
	page.indexOf("<body>") + "<body>".length,
	page.indexOf("</body>"),
);

document.body.innerHTML = body;

// Dynamic, and kept below the assignment: importing the page script runs it,
// and it looks every element up at module scope.
const { need } = await import("./index");

/**
 * Where a component's markup lives: its shadow root, or the element itself for
 * anything that renders into the light DOM. Written as a fallback rather than a
 * bare `host.shadowRoot` so these tests state what they are after — the
 * component's markup — and not which DOM it happens to put it in.
 */
function inside(host: HTMLElement): ParentNode {
	return (host as { shadowRoot?: ShadowRoot | null }).shadowRoot ?? host;
}

function shown(host: HTMLElement): string {
	return inside(host).textContent ?? "";
}

/** Lit renders on a microtask; the route's own handlers are synchronous. */
async function settle(): Promise<void> {
	await Bun.sleep(0);
	await Bun.sleep(0);
}

const codeBar = need("code");
const verdict = need("verdict");
const warnings = need("warnings");
const resetButton = need<HTMLButtonElement>("reset");

async function codeText(): Promise<string> {
	await settle();
	return inside(codeBar).querySelector("code")?.textContent?.trim() ?? "";
}

/**
 * Values are bound as properties rather than attributes — a chip's value is
 * data the route handed over, not markup — so the button is found by reading
 * them back rather than by an attribute selector.
 */
function control(hostId: string, value: string): HTMLButtonElement {
	const buttons = [
		...inside(need(hostId)).querySelectorAll<HTMLButtonElement>("button"),
	];
	const found = buttons.find((button) => button.value === value);
	if (found === undefined) {
		throw new Error(`#${hostId} has no control for ${value}`);
	}
	return found;
}

async function choose(hostId: string, value: string): Promise<void> {
	control(hostId, value).click();
	await settle();
}

function isOn(hostId: string, value: string): boolean {
	const button = control(hostId, value);
	return (
		button.getAttribute("aria-checked") === "true" ||
		button.getAttribute("aria-selected") === "true"
	);
}

/** Types into the code bar the way someone pasting a code by hand would. */
async function typeCode(text: string): Promise<void> {
	(codeBar as HTMLElement & { editing: boolean }).editing = true;
	await settle();
	const input = inside(codeBar).querySelector("input");
	if (input === null) throw new Error("the code bar has no editor");
	input.value = text;
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await settle();
}

function message(): string {
	return inside(codeBar).querySelector(".message")?.textContent?.trim() ?? "";
}

async function reset(): Promise<void> {
	resetButton.click();
	await settle();
}

test("the page opens on a valid code", async () => {
	expect(await codeText()).toBe("1S0---000-");
});

test("choosing a type writes it into the code", async () => {
	await choose("type", "money");

	expect(await codeText()).toBe("1M0---000-");
	await reset();
});

test("a boost card writes its slot and rewrites the type slot to semi-auto", async () => {
	await choose("type", "auto");
	expect(await codeText()).toBe("1A0---000-");

	await choose("boosts", "fastStart");

	expect(await codeText()).toBe("1H0--F000-");
	expect(shown(verdict)).toContain("Semi-auto");
	expect(shown(verdict)).toContain("Fast Start");
	await reset();
});

// The summary rides in the sticky panel with the code it describes; the
// verdict stays down the page with the warnings.
test("the summary line says what the build is, beside the code", async () => {
	await choose("episode", "episode3");

	expect(shown(need("summary"))).toContain("Episode 3");
	expect(need("summary").closest(".codepanel")).not.toBe(null);
	await reset();
});

test("a cookie power card writes its bit into the code", async () => {
	await choose("cookiePowers", "cheerleader");

	expect(await codeText()).toBe("1S0---001-");
	await reset();
});

test("typing a code moves every control to match it", async () => {
	await typeCode("1M3HPF214J");

	expect(isOn("type", "money")).toBe(true);
	expect(isOn("episode", "episode3")).toBe(true);
	expect(isOn("boosts", "hpExtension")).toBe(true);
	expect(isOn("boosts", "fastStart")).toBe(true);
	expect(isOn("action", "jumpAtStart")).toBe(true);
	await reset();
});

test("typing a code with a loadout fills the loadout controls too", async () => {
	await typeCode("1C0O.1S0---000-");

	expect(shown(need("cookie"))).toContain("Fairy Cookie");
	await reset();
});

// The picker does not offer the consumable and special families, but a code
// written before that — or by hand — can still carry one, and dropping it
// would rewrite someone's saved build behind their back.
test("a code carrying a treasure the picker hides keeps it", async () => {
	await typeCode("1TU00Z.1S0---000-");

	// The built code, read off the bar rather than off its rendering: the
	// editor is still open, so the rendered code is the field, not the runs.
	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1TU00Z.1S0---000-",
	);
	expect(shown(need("treasure1"))).toContain("XP-Elixir");
	await reset();
});

// A half-typed code is not an error, so it says how far along it is rather
// than complaining.
test("an unfinished code reports how many characters are in it", async () => {
	await typeCode("1M3H");

	expect(message()).toBe("4 of 10 characters.");
	await reset();
});

test("an unfinished code leaves the controls where they were", async () => {
	await choose("type", "money");
	await typeCode("1E3H");

	expect(isOn("type", "money")).toBe(true);
	await reset();
});

test("an unreadable code says what is wrong with it", async () => {
	await typeCode("1Q0---000-");

	expect(message()).toContain("Q");
	await reset();
});

test("an unreadable code leaves the controls where they were", async () => {
	await choose("type", "money");
	await typeCode("1Q0---000-");

	expect(isOn("type", "money")).toBe(true);
	await reset();
});

// Hand-typed codes contradict themselves; the page shows one rather than
// refusing it, and says what it did about it.
test("a code that contradicts itself still loads, with a warning", async () => {
	await typeCode("1A0--F000-");

	expect(isOn("boosts", "fastStart")).toBe(true);
	expect(warnings.textContent).toContain("Semi-auto");
	await reset();
});

test("the warning goes away once the code stops contradicting itself", async () => {
	await typeCode("1A0--F000-");
	expect(warnings.textContent).not.toBe("");

	await typeCode("1S0---000-");

	expect(warnings.textContent).toBe("");
	await reset();
});

test("pasting a code anywhere on the page loads it", async () => {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "1M3---000-" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(isOn("type", "money")).toBe(true);
	expect(await codeText()).toBe("1M3---000-");
	await reset();
});

// The line under the code answers a question about the code in front of you,
// so it cannot outlive the code it was about.
test("a message from the last code goes away once a control moves", async () => {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "1M3---000-" },
	});
	document.dispatchEvent(event);
	await settle();
	expect(message()).not.toBe("");

	await choose("type", "exp");

	expect(message()).toBe("");
	await reset();
});

test("pasting something that is not a code is left to the browser", async () => {
	await choose("type", "money");
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "hello there" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(isOn("type", "money")).toBe(true);
	expect(event.defaultPrevented).toBe(false);
	await reset();
});

test("clicking a run of the code moves focus to the control that writes it", async () => {
	const runs = [
		...inside(codeBar).querySelectorAll<HTMLButtonElement>("code button"),
	];
	const episode = runs.find(
		(run) => run.getAttribute("data-group") === "episode",
	);
	episode?.click();
	await settle();

	expect(document.activeElement).toBe(need("episode"));
	await reset();
});

test("reset goes back to the code the page opened on", async () => {
	await choose("type", "box");
	await choose("boosts", "fastStart");

	await reset();

	expect(await codeText()).toBe("1S0---000-");
	expect(isOn("boosts", "fastStart")).toBe(false);
});

test("the code is remembered for the next visit", async () => {
	await choose("type", "exp");

	expect(localStorage.getItem("combi-name:code")).toBe("1E0---000-");
	await reset();
});

// A link that differs from the open page only by its hash does not reload it,
// so without this the page would ignore the code someone just pasted into the
// address bar — and then overwrite it on the next click.
test("a code arriving in the address bar loads without a reload", async () => {
	location.hash = "#1B5---000-";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(isOn("type", "box")).toBe(true);
	expect(isOn("episode", "episode5")).toBe(true);
	await reset();
});

test("a hash the page cannot read leaves the build alone", async () => {
	await choose("type", "money");
	location.hash = "#not-a-code";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(isOn("type", "money")).toBe(true);
	await reset();
});

test("every character of the code carries a hint", async () => {
	await settle();
	const runs = [
		...inside(codeBar).querySelectorAll<HTMLButtonElement>("code button"),
	];

	expect(runs.length).toBeGreaterThan(0);
	for (const run of runs) {
		expect(run.getAttribute("data-tooltip")).not.toBe("");
	}
});
