/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-picker.ts";

import type { EntryPicker } from "./entry-picker.ts";

function mount(): EntryPicker {
	document.body.replaceChildren();
	const element = document.createElement("entry-picker");
	element.setAttribute("label", "Cookie");
	document.body.append(element);
	element.options = [
		["00", "GingerBrave", "cookies/ch01.png"],
		["01", "Strawberry Cookie", "cookies/ch02.png"],
		["02", "Wizard Cookie", null],
	];
	return element;
}

function rows(element: EntryPicker): HTMLButtonElement[] {
	return [...element.querySelectorAll<HTMLButtonElement>("button[value]")];
}

test("the label names the control", () => {
	expect(mount().querySelector("label")?.textContent).toBe("Cookie");
});

test("one row per option plus a None row, in the order given", () => {
	expect(rows(mount()).map((row) => row.value)).toEqual(["", "00", "01", "02"]);
});

test("an option with an icon renders an image, one without does not", () => {
	const element = mount();
	const images = [...element.querySelectorAll("img")];

	expect(images).toHaveLength(2);
	expect(images[0]?.getAttribute("src")).toBe("cookies/ch01.png");
	expect(images[0]?.getAttribute("loading")).toBe("lazy");
});

test("clicking a row sets the value and bubbles an input event", () => {
	const element = mount();
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	rows(element)[2]?.click();

	expect(element.value).toBe("01");
	expect(seen).toBe(1);
});

test("clicking the None row clears the value", () => {
	const element = mount();
	element.value = "01";

	rows(element)[0]?.click();

	expect(element.value).toBeNull();
});

// aria-selected is only valid on option/tab/row/gridcell/treeitem roles; a
// plain button ignores it, so assistive technology needs both roles present.
test("the list and its rows carry the roles that make aria-selected valid", () => {
	const element = mount();

	expect(element.querySelector(".entries")?.getAttribute("role")).toBe(
		"listbox",
	);
	for (const row of rows(element)) {
		expect(row.getAttribute("role")).toBe("option");
	}
});

test("clicking a row returns focus to the search input, not <body>", () => {
	const element = mount();
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	rows(element)[2]?.click();

	expect(document.activeElement).toBe(search);
});

test("setting the value marks that row as the selected one", () => {
	const element = mount();
	element.value = "02";

	expect(rows(element).map((row) => row.getAttribute("aria-selected"))).toEqual(
		["false", "false", "false", "true"],
	);
});

test("setting a value that is not an option is ignored rather than invented", () => {
	const element = mount();
	element.value = "nonsense";

	expect(element.value).toBeNull();
});

test("typing filters the rows to matching labels, case-insensitively", () => {
	const element = mount();
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	search.value = "wiz";
	search.dispatchEvent(new Event("input", { bubbles: true }));

	expect(rows(element).map((row) => row.value)).toEqual(["", "02"]);
});

test("the selected row stays visible even when the filter excludes it", () => {
	const element = mount();
	element.value = "00";
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	search.value = "wiz";
	search.dispatchEvent(new Event("input", { bubbles: true }));

	expect(rows(element).map((row) => row.value)).toContain("00");
});

// 1,144 treasures cannot all be in the DOM of three pickers at once.
test("only the first rows are rendered, with a count of what is hidden", () => {
	const element = mount();
	element.options = Array.from(
		{ length: 120 },
		(_, n) => [String(n).padStart(3, "0"), `Treasure ${n}`, null] as const,
	);

	expect(rows(element)).toHaveLength(51);
	expect(element.querySelector(".more")?.textContent).toBe(
		"Showing 50 of 120. Type to narrow the list.",
	);
});
