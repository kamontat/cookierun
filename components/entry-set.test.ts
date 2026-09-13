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

test("the legend names the slot", () => {
	expect(mount().querySelector("legend")?.textContent).toBe("Treasure slot 1");
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
