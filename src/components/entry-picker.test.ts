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

test("the summary names the control and what is picked", () => {
	const element = mount();

	expect(element.querySelector("summary")?.textContent).toContain("Cookie");
	expect(element.querySelector("summary")?.textContent).toContain("None");

	element.value = "01";

	expect(element.querySelector("summary")?.textContent).toContain(
		"Strawberry Cookie",
	);
});

// Six of these open at once is a wall of scrolling lists; closed, the loadout
// reads as six lines.
test("the list starts closed", () => {
	expect(mount().querySelector("details")?.open).toBe(false);
});

test("the search input is named even though the label is now a summary", () => {
	const search = mount().querySelector("input[type=search]");

	expect(search?.getAttribute("aria-label")).toBe("Filter Cookie");
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

// `#render()` replaces the button the click landed on, so something has to put
// focus back or it drops to <body>.
test("picking keeps focus on the row that was picked", () => {
	const element = mount();

	rows(element)[2]?.click();

	expect((document.activeElement as HTMLButtonElement).value).toBe("01");
});

test("clearing the pick keeps focus on the None row", () => {
	const element = mount();
	element.value = "01";

	rows(element)[0]?.click();

	expect((document.activeElement as HTMLButtonElement).value).toBe("");
	expect(element.value).toBeNull();
});

// 50 rows in each of six pickers is 300 tab stops between the loadout and the
// rest of the page. A listbox is one stop, and arrows move inside it.
test("the list is a single tab stop, on the selected row", () => {
	const element = mount();
	element.value = "01";

	expect(rows(element).map((row) => row.tabIndex)).toEqual([-1, -1, 0, -1]);
});

test("with nothing picked the first row is the one tab stop", () => {
	expect(rows(mount()).map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
});

function press(element: EntryPicker, key: string): void {
	element
		.querySelector(".entries")
		?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

test("the arrow keys walk the rows and Home and End jump to the ends", () => {
	const element = mount();
	rows(element)[0]?.focus();

	press(element, "ArrowDown");
	expect((document.activeElement as HTMLButtonElement).value).toBe("00");

	press(element, "ArrowUp");
	expect((document.activeElement as HTMLButtonElement).value).toBe("");

	press(element, "End");
	expect((document.activeElement as HTMLButtonElement).value).toBe("02");

	press(element, "Home");
	expect((document.activeElement as HTMLButtonElement).value).toBe("");
});

test("the arrows stop at the ends rather than wrapping around", () => {
	const element = mount();
	rows(element)[0]?.focus();

	press(element, "ArrowUp");

	expect((document.activeElement as HTMLButtonElement).value).toBe("");
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
