/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-set.ts";

import type { EntrySet } from "./entry-set.ts";

function mount(): EntrySet {
	document.body.replaceChildren();
	const element = document.createElement("entry-set");
	element.setAttribute("legend", "Treasure slot 1");
	document.body.append(element);
	element.options = [
		["000", "Acorn", "treasures/tr_ga034.png"],
		["001", "Mushroom", null],
		["002", "Slate", null],
	];
	return element;
}

function addRows(element: EntrySet): HTMLButtonElement[] {
	return [...element.querySelectorAll<HTMLButtonElement>(".entry")];
}

function chips(element: EntrySet): HTMLButtonElement[] {
	return [...element.querySelectorAll<HTMLButtonElement>(".chip")];
}

test("the summary names the slot and what is in it", () => {
	const element = mount();

	expect(element.querySelector("summary")?.textContent).toContain(
		"Treasure slot 1",
	);
	expect(element.querySelector("summary")?.textContent).toContain("None");

	element.selected = ["000", "002"];

	expect(element.querySelector("summary")?.textContent).toContain(
		"Acorn or Slate",
	);
});

// Three of these open at once is a wall of scrolling lists; closed, a slot
// reads as one line.
test("the list starts closed", () => {
	expect(mount().querySelector("details")?.open).toBe(false);
});

test("the list is named for the slot it fills", () => {
	expect(mount().querySelector(".entries")?.getAttribute("aria-label")).toBe(
		"Treasure slot 1",
	);
});

test("nothing is picked to begin with", () => {
	const element = mount();
	expect(element.selected).toEqual([]);
	expect(chips(element)).toHaveLength(0);
});

test("clicking a row adds it as a chip and bubbles an input event", () => {
	const element = mount();
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	addRows(element)[1]?.click();

	expect(element.selected).toEqual(["001"]);
	expect(chips(element).map((chip) => chip.value)).toEqual(["001"]);
	expect(seen).toBe(1);
});

test("clicking a chip removes it", () => {
	const element = mount();
	element.selected = ["000", "002"];

	chips(element)[0]?.click();

	expect(element.selected).toEqual(["002"]);
});

// This is the wire format: alternatives are written in id order, so reading
// back in click order would produce a different code for the same slot.
test("selected reads back in option order, not the order clicked", () => {
	const element = mount();

	addRows(element)[2]?.click();
	addRows(element)[0]?.click();

	expect(element.selected).toEqual(["000", "002"]);
});

test("adding the same entry twice is a no-op", () => {
	const element = mount();

	addRows(element)[0]?.click();
	addRows(element)[0]?.click();

	expect(element.selected).toEqual(["000"]);
});

test("a value that is not an option is ignored rather than invented", () => {
	const element = mount();

	element.selected = ["000", "nonsense"];

	expect(element.selected).toEqual(["000"]);
});

// aria-selected is only valid on option/tab/row/gridcell/treeitem roles; a
// plain button ignores it, so assistive technology needs both roles present.
// aria-multiselectable also has to be on the listbox, since this one accepts
// several picks.
test("the list and its rows carry the roles that make aria-selected valid", () => {
	const element = mount();
	const list = element.querySelector(".entries");

	expect(list?.getAttribute("role")).toBe("listbox");
	expect(list?.getAttribute("aria-multiselectable")).toBe("true");
	for (const row of addRows(element)) {
		expect(row.getAttribute("role")).toBe("option");
	}
});

// `#render()` replaces the button the click landed on, so something has to put
// focus back or it drops to <body>.
test("adding an entry keeps focus on the row that was added", () => {
	const element = mount();

	addRows(element)[1]?.click();

	expect((document.activeElement as HTMLButtonElement).value).toBe("001");
});

// 50 rows in each of three slots is 150 tab stops in the loadout alone. A
// listbox is one stop, and arrows move inside it.
test("the list is a single tab stop, on the first picked row", () => {
	const element = mount();
	element.selected = ["002"];

	expect(addRows(element).map((row) => row.tabIndex)).toEqual([-1, -1, 0]);
});

test("with nothing picked the first row is the one tab stop", () => {
	expect(addRows(mount()).map((row) => row.tabIndex)).toEqual([0, -1, -1]);
});

test("the arrow keys walk the rows and End jumps to the last", () => {
	const element = mount();
	addRows(element)[0]?.focus();
	const press = (key: string) =>
		element
			.querySelector(".entries")
			?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));

	press("ArrowDown");
	expect((document.activeElement as HTMLButtonElement).value).toBe("001");

	press("End");
	expect((document.activeElement as HTMLButtonElement).value).toBe("002");

	press("ArrowDown");
	expect((document.activeElement as HTMLButtonElement).value).toBe("002");
});

test("clicking a chip to remove it also returns focus to the search input", () => {
	const element = mount();
	element.selected = ["000", "002"];
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	chips(element)[0]?.click();

	expect(document.activeElement).toBe(search);
});

test("an already-picked row is marked so", () => {
	const element = mount();
	element.selected = ["001"];

	expect(
		addRows(element).map((row) => row.getAttribute("aria-selected")),
	).toEqual(["false", "true", "false"]);
});

test("typing filters the rows", () => {
	const element = mount();
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	search.value = "sla";
	search.dispatchEvent(new Event("input", { bubbles: true }));

	expect(addRows(element).map((row) => row.value)).toEqual(["002"]);
});

test("only the first rows are rendered, with a count of what is hidden", () => {
	const element = mount();
	element.options = Array.from(
		{ length: 120 },
		(_, n) => [String(n).padStart(3, "0"), `Treasure ${n}`, null] as const,
	);

	expect(addRows(element)).toHaveLength(50);
	expect(element.querySelector(".more")?.textContent).toBe(
		"Showing 50 of 120. Type to narrow the list.",
	);
});
