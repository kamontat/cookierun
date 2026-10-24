/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-grid";

import type { EntryGrid, Option } from "./entry-grid";

const COOKIES: readonly Option[] = [
	["0A", "Adventurer Cookie", "../assets/cookies/ch38.png"],
	["0B", "Brave Cookie", "../assets/cookies/ch01.png"],
	["0C", "Cheerleader Cookie", null],
];

function manyOptions(count: number): Option[] {
	return Array.from({ length: count }, (_, at) => [
		`C${at}`,
		`Cookie ${at}`,
		null,
	]);
}

async function mount(label = "Cookie"): Promise<EntryGrid> {
	document.body.replaceChildren();
	const element = document.createElement("entry-grid") as EntryGrid;
	element.setAttribute("label", label);
	document.body.append(element);
	element.options = COOKIES;
	await element.updateComplete;
	return element;
}

function cells(element: EntryGrid): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button.entry",
		) ?? []),
	];
}

function search(element: EntryGrid): HTMLInputElement | null {
	return element.shadowRoot?.querySelector("input") ?? null;
}

async function settle(element: EntryGrid): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

test("draws every option inline with None first", async () => {
	const element = await mount();
	element.options = manyOptions(60);
	await element.updateComplete;

	const values = cells(element).map((cell) => cell.value);
	expect(values.length).toBe(61);
	expect(values[0]).toBe("");
	expect(values.slice(1)).toEqual(manyOptions(60).map(([value]) => value));
});

test("required drops the None cell", async () => {
	const element = await mount();
	element.required = true;
	await element.updateComplete;

	expect(cells(element).map((cell) => cell.value)).toEqual(["0A", "0B", "0C"]);
});

test("a pick sets value and fires input", async () => {
	const element = await mount();
	let seen = 0;
	element.addEventListener("input", (event) => {
		seen += 1;
		expect(event.target).toBe(element);
	});

	cells(element)[1]?.click();
	await element.updateComplete;

	expect(element.value).toBe("0A");
	expect(seen).toBe(1);
});

test("typing in the search narrows the cells and fires no input", async () => {
	const element = await mount();
	element.searchable = true;
	await element.updateComplete;
	let seen = 0;
	element.addEventListener("input", () => {
		seen += 1;
	});

	const box = search(element);
	if (box === null) throw new Error("no search box");
	box.value = "brave";
	box.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await element.updateComplete;

	expect(cells(element).map((cell) => cell.value)).toEqual(["", "0B"]);
	expect(seen).toBe(0);
});

test("an unsearchable control renders no search box", async () => {
	const element = await mount();

	expect(search(element)).toBe(null);
});

test("a value its options lack reads as null", async () => {
	const element = await mount();

	element.value = "ZZ";
	await element.updateComplete;

	expect(element.value).toBeNull();
});

// The same roving-tabindex coverage every catalog grid on the page carries:
// one tab stop for the whole grid, arrows inside it, clamped at the ends.
test("only the picked entry is tabbable", async () => {
	const element = await mount();

	element.value = "0B";
	await element.updateComplete;

	expect(cells(element).map((cell) => cell.tabIndex)).toEqual([-1, -1, 0, -1]);
});

test("an arrow walks to the next entry", async () => {
	const element = await mount();

	cells(element)[0]?.focus();
	cells(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(cells(element)[1] ?? null);
});

// Clamped rather than wrapped: an arrow that jumps from the last entry to the
// first reads as a lost keypress.
test("an arrow on the last entry stays there", async () => {
	const element = await mount();

	cells(element)[3]?.focus();
	cells(element)[3]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(cells(element)[3] ?? null);
});

test("Home moves focus to the first entry and End to the last", async () => {
	const element = await mount();

	cells(element)[2]?.focus();
	cells(element)[2]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
	);
	await settle(element);
	expect(element.shadowRoot?.activeElement).toBe(cells(element)[0] ?? null);

	cells(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "End", bubbles: true }),
	);
	await settle(element);
	expect(element.shadowRoot?.activeElement).toBe(cells(element)[3] ?? null);
});

// Arrow movement is navigation only — it must not pick a value, unlike
// <chip-group>'s radio-style walk. Only a click (or Enter/Space on the
// focused button, which the browser already gives a <button> for free) picks.
test("an arrow walk does not change the value", async () => {
	const element = await mount();

	cells(element)[0]?.focus();
	cells(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.value).toBeNull();
});

test("the None cell clears the pick and fires input", async () => {
	const element = await mount();
	element.value = "0A";
	await element.updateComplete;
	let seen = 0;
	element.addEventListener("input", () => {
		seen += 1;
	});

	cells(element)[0]?.click();
	await element.updateComplete;

	expect(element.value).toBeNull();
	expect(seen).toBe(1);
});

test("the grid carries the listbox role and its label", async () => {
	const element = await mount("Relay");

	const grid = element.shadowRoot?.querySelector("[role='listbox']");
	expect(grid?.getAttribute("aria-label")).toBe("Relay");
	expect(cells(element)[0]?.getAttribute("role")).toBe("option");
});

test("the picked cell carries aria-selected", async () => {
	const element = await mount();
	element.value = "0B";
	await element.updateComplete;

	expect(
		cells(element).map((cell) => cell.getAttribute("aria-selected")),
	).toEqual(["false", "false", "true", "false"]);
});

// A required control with nothing picked still needs one tab stop — with no
// None row there is no cell holding the empty value to carry it.
test("a required control with nothing picked makes the first cell tabbable", async () => {
	const element = await mount();
	element.required = true;
	await element.updateComplete;

	expect(cells(element).map((cell) => cell.tabIndex)).toEqual([0, -1, -1]);
});

// Inline means inline: the grid grows the page rather than scrolling inside a
// box of its own. tileStyles' .entries carries the dialog's scroll rules, and
// an overflow left on auto turns a one-pixel rounding (WebKit at 110% zoom)
// into a grid that scrolls by itself.
test("the grid never scrolls inside its own box", async () => {
	const element = await mount();
	const entries = element.shadowRoot?.querySelector<HTMLElement>(".entries");
	if (entries === null || entries === undefined) throw new Error("no grid");
	const style = getComputedStyle(entries);

	expect(style.overflowY).toBe("visible");
	expect(style.overflowX).toBe("visible");
	expect(style.maxHeight).toBe("none");
});
