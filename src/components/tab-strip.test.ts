/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./tab-strip";

import type { TabOption, TabStrip } from "./tab-strip";

const OPTIONS: readonly TabOption[] = [
	["main", "Main", "", null],
	["cookies", "Cookies", "", null],
	["treasures", "Treasures", "2/3", null],
	["boosts", "Boosts", "", null],
];

async function mount(
	options: readonly TabOption[] = OPTIONS,
	value = "main",
): Promise<TabStrip> {
	document.body.replaceChildren();
	const element = document.createElement("tab-strip") as TabStrip;
	document.body.append(element);
	element.options = options;
	element.value = value;
	await element.updateComplete;
	return element;
}

function tabs(element: TabStrip): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.tab") ??
			[]),
	];
}

function tab(element: TabStrip, value: string): HTMLButtonElement | undefined {
	return tabs(element).find((candidate) => candidate.value === value);
}

/**
 * A handler that restores focus awaits its own `updateComplete` first, so a
 * test watching where focus lands has to settle twice: once for its own
 * await, which resumes after the handler's, and again to observe the result.
 */
async function settle(element: TabStrip): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

test("draws a tab per option with its badge", async () => {
	const element = await mount();

	expect(tabs(element)).toHaveLength(4);
	expect(tab(element, "treasures")?.textContent).toContain("2/3");
});

test("marks the value selected", async () => {
	const element = await mount(OPTIONS, "cookies");

	expect(
		tabs(element).map((button) => button.getAttribute("aria-selected")),
	).toEqual(["false", "true", "false", "false"]);
});

test("a click on a tab fires tab-change with its value and no input", async () => {
	const element = await mount();
	let detail = "";
	let inputSeen = false;
	element.addEventListener("tab-change", (event) => {
		detail = (event as CustomEvent<string>).detail;
	});
	element.addEventListener("input", () => {
		inputSeen = true;
	});

	tab(element, "cookies")?.click();
	await element.updateComplete;

	expect(detail).toBe("cookies");
	expect(element.value).toBe("cookies");
	expect(inputSeen).toBe(false);
});

test("a disabled tab says why and cannot be picked", async () => {
	const options: readonly TabOption[] = [
		["main", "Main", "", null],
		["cookies", "Cookies", "", null],
		["treasures", "Treasures", "", null],
		["boosts", "Boosts", "", "Special Exp Episode takes no boosts."],
	];
	const element = await mount(options);
	let seen = 0;
	element.addEventListener("tab-change", () => {
		seen += 1;
	});

	const boosts = tab(element, "boosts");
	expect(boosts?.getAttribute("aria-disabled")).toBe("true");
	expect(boosts?.getAttribute("title")).toBe(
		"Special Exp Episode takes no boosts.",
	);

	boosts?.click();
	await element.updateComplete;

	expect(seen).toBe(0);
	expect(element.value).toBe("main");
});

test("arrow keys move the pick and skip disabled tabs; Home and End go to the ends", async () => {
	const options: readonly TabOption[] = [
		["main", "Main", "", null],
		["cookies", "Cookies", "", null],
		["treasures", "Treasures", "", "Not used here."],
		["boosts", "Boosts", "", null],
	];
	const element = await mount(options, "main");
	const seen: string[] = [];
	element.addEventListener("tab-change", (event) => {
		seen.push((event as CustomEvent<string>).detail);
	});

	tab(element, "main")?.focus();
	tab(element, "main")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(seen).toEqual(["cookies"]);
	expect(element.value).toBe("cookies");
	expect(element.shadowRoot?.activeElement).toBe(
		tab(element, "cookies") ?? null,
	);

	tab(element, "cookies")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	// treasures is disabled, so the walk lands on boosts instead.
	expect(seen).toEqual(["cookies", "boosts"]);
	expect(element.value).toBe("boosts");

	// Clamped rather than wrapped: the last tab stays put.
	tab(element, "boosts")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);
	expect(element.value).toBe("boosts");
	expect(seen).toEqual(["cookies", "boosts"]);

	tab(element, "boosts")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
	);
	await settle(element);
	expect(element.value).toBe("main");

	tab(element, "main")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "End", bubbles: true }),
	);
	await settle(element);
	// treasures is disabled, so End lands on the last enabled tab, boosts.
	expect(element.value).toBe("boosts");
});

// The resolution for "Home and End go to the ends": the first and last
// ENABLED tab, not literally index 0 and length - 1.
test("Home and End land on the first and last enabled tab when an end is disabled", async () => {
	const options: readonly TabOption[] = [
		["main", "Main", "", "Not used here."],
		["cookies", "Cookies", "", null],
		["treasures", "Treasures", "", null],
		["boosts", "Boosts", "", "Not used here."],
	];
	const element = await mount(options, "cookies");

	tab(element, "cookies")?.focus();
	tab(element, "cookies")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
	);
	await settle(element);
	expect(element.value).toBe("cookies");

	tab(element, "cookies")?.focus();
	tab(element, "cookies")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "End", bubbles: true }),
	);
	await settle(element);
	expect(element.value).toBe("treasures");
});

// Home on the tab that is already first, or End on the one already last,
// changes nothing — so, like a click on the tab already open, it fires
// nothing. Only a value that actually changes is a pick worth announcing.
test("Home fires nothing already on the first tab, and End already on the last", async () => {
	const first = await mount(OPTIONS, "main");
	let seenFirst = 0;
	first.addEventListener("tab-change", () => {
		seenFirst += 1;
	});

	tab(first, "main")?.focus();
	tab(first, "main")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
	);
	await settle(first);

	expect(seenFirst).toBe(0);
	expect(first.value).toBe("main");

	const last = await mount(OPTIONS, "boosts");
	let seenLast = 0;
	last.addEventListener("tab-change", () => {
		seenLast += 1;
	});

	tab(last, "boosts")?.focus();
	tab(last, "boosts")?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "End", bubbles: true }),
	);
	await settle(last);

	expect(seenLast).toBe(0);
	expect(last.value).toBe("boosts");
});

test("setting value fires nothing", async () => {
	const element = await mount();
	let seen = 0;
	element.addEventListener("tab-change", () => {
		seen += 1;
	});
	element.addEventListener("input", () => {
		seen += 1;
	});

	element.value = "boosts";
	await element.updateComplete;

	expect(seen).toBe(0);
	expect(tab(element, "boosts")?.getAttribute("aria-selected")).toBe("true");
});

test("only the selected tab is tabbable", async () => {
	const element = await mount(OPTIONS, "cookies");

	expect(tabs(element).map((button) => button.tabIndex)).toEqual([
		-1, 0, -1, -1,
	]);
});

test("the tablist carries its role and part", async () => {
	const element = await mount();

	const list = element.shadowRoot?.querySelector("[role='tablist']");
	expect(list).not.toBeNull();
	expect(list?.getAttribute("part")).toBe("list");
	expect(tab(element, "main")?.getAttribute("role")).toBe("tab");
});
