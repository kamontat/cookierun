/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-tiles";

import type { EntryTiles } from "./entry-tiles";

const TREASURES = [
	["001", "Always Cute Acorn", "../assets/treasures/tr_ga034.png"],
	["002", "Bear Jelly's Ferris Wheel", "../assets/treasures/tr_ga001.png"],
	["003", "Cheesecake Slice", null],
] as const;

// The evolved entry and the blessed one deliberately share a picture and all
// but a prefix of their name, which is the pair the badge exists to tell apart.
const KINDED = [
	["001", "Always Cute Acorn", "../assets/treasures/tr_ga034.png", "base"],
	["002", "Chewy Cheese Ball", "../assets/treasures/tr_pet04_m.png", "evolved"],
	[
		"003",
		"Blessed Chewy Cheese Ball",
		"../assets/treasures/tr_pet04_m.png",
		"blessed",
	],
] as const;

async function mount(legend = "Treasure slot 1"): Promise<EntryTiles> {
	document.body.replaceChildren();
	const element = document.createElement("entry-tiles") as EntryTiles;
	element.setAttribute("legend", legend);
	document.body.append(element);
	element.options = TREASURES;
	await element.updateComplete;
	return element;
}

async function mountKinded(): Promise<EntryTiles> {
	const element = await mount();
	element.options = KINDED;
	await element.updateComplete;
	return element;
}

function entries(element: EntryTiles): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button.entry",
		) ?? []),
	];
}

function search(element: EntryTiles): HTMLInputElement | null {
	return element.shadowRoot?.querySelector("input") ?? null;
}

function tile(element: EntryTiles): HTMLButtonElement {
	const node =
		element.shadowRoot?.querySelector<HTMLButtonElement>("button.tile");
	if (node === null || node === undefined) throw new Error("no tile button");
	return node;
}

function dialog(element: EntryTiles): HTMLDialogElement {
	const node = element.shadowRoot?.querySelector("dialog");
	if (node === null || node === undefined) throw new Error("no dialog");
	return node;
}

function done(element: EntryTiles): HTMLButtonElement {
	const node =
		element.shadowRoot?.querySelector<HTMLButtonElement>("button.done");
	if (node === null || node === undefined) throw new Error("no Done button");
	return node;
}

function clear(element: EntryTiles): HTMLButtonElement {
	const node =
		element.shadowRoot?.querySelector<HTMLButtonElement>("button.clear");
	if (node === null || node === undefined) throw new Error("no Clear button");
	return node;
}

function cell(element: EntryTiles, value: string): HTMLButtonElement {
	const found = [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button.entry",
		) ?? []),
	].find((button) => button.value === value);
	if (found === undefined) throw new Error(`no cell for ${value}`);
	return found;
}

async function settle(element: EntryTiles): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

test("the legend names the slot", async () => {
	const element = await mount("Treasure slot 2");

	expect(element.shadowRoot?.querySelector(".label")?.textContent?.trim()).toBe(
		"Treasure slot 2",
	);
});

test("an empty slot says None", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector(".hint")?.textContent?.trim()).toBe(
		"None",
	);
	expect(element.shadowRoot?.querySelector(".picks")).toBe(null);
});

// A slot nobody has filled still has to invite a click.
test("an empty slot draws its tile with a dashed frame", async () => {
	const element = await mount();

	expect(tile(element).classList.contains("empty")).toBe(true);

	element.selected = ["001"];
	await element.updateComplete;

	expect(tile(element).classList.contains("empty")).toBe(false);
});

// The same "this or that" the code reads as, so a closed slot says exactly
// what the summary above it would say.
// One alternative per line: side by side they were two half-names, and a slot
// holds alternatives worth reading in full.
test("each alternative is its own row under the slot's name", async () => {
	const element = await mount();

	element.selected = ["001", "003"];
	await element.updateComplete;

	const rows = [...(element.shadowRoot?.querySelectorAll(".picks > li") ?? [])];

	expect(
		rows.map((row) => row.querySelector(".name")?.textContent?.trim()),
	).toEqual(["Always Cute Acorn", "Cheesecake Slice"]);
	expect(element.shadowRoot?.querySelector(".hint")?.textContent?.trim()).toBe(
		"2 alternatives",
	);
});

test("the picked entries show their thumbnails in the list", async () => {
	const element = await mount();

	element.selected = ["001"];
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".picks img")?.getAttribute("src"),
	).toBe("../assets/treasures/tr_ga034.png");
});

test("picks inside the dialog do not change the slot until Done", async () => {
	const element = await mount();
	element.options = [
		["000", "Always Cute Acorn", null, "base"],
		["007", "Blessed Stretched Acorn", null, "blessed"],
	];
	await settle(element);
	let heard = 0;
	element.addEventListener("input", () => {
		heard += 1;
	});

	tile(element).click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);

	expect([element.selected, heard]).toEqual([[], 0]);
});

test("Done writes every pick and dispatches one input", async () => {
	const element = await mount();
	element.options = [
		["000", "Always Cute Acorn", null, "base"],
		["007", "Blessed Stretched Acorn", null, "blessed"],
	];
	await settle(element);
	let heard = 0;
	element.addEventListener("input", () => {
		heard += 1;
	});

	tile(element).click();
	await settle(element);
	cell(element, "007").click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);
	done(element).click();
	await settle(element);

	// Id order, not click order: a slot's alternatives are written in id order.
	expect([element.selected, heard, dialog(element).open]).toEqual([
		["000", "007"],
		1,
		false,
	]);
});

// A slot is a set. Half a set applied on the way out is worse than none.
test("closing without Done leaves the slot as it was", async () => {
	const element = await mount();
	element.options = [["000", "Always Cute Acorn", null, "base"]];
	element.selected = ["000"];
	await settle(element);

	tile(element).click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);
	dialog(element).close();
	await settle(element);

	expect(element.selected).toEqual(["000"]);
});

// Native <dialog> does not light-dismiss on its own; a click on the backdrop
// has to be wired up by hand, and it has to cancel rather than commit.
test("a click on the backdrop cancels the dialog", async () => {
	const element = await mount();
	element.options = [["000", "Always Cute Acorn", null, "base"]];
	element.selected = ["000"];
	await settle(element);

	tile(element).click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);
	dialog(element).dispatchEvent(new Event("pointerdown", { bubbles: true }));
	dialog(element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
	await settle(element);

	expect([dialog(element).open, element.selected]).toEqual([false, ["000"]]);
});

// A click fires on the nearest common ancestor of the press and release
// targets, so selecting text in the search box and releasing past the
// sheet's edge would otherwise target the dialog too and discard the whole
// draft with no confirmation.
test("a press that starts inside the sheet leaves the dialog open and the draft intact even if the click lands on the backdrop", async () => {
	const element = await mount();
	element.options = [["000", "Always Cute Acorn", null, "base"]];
	await settle(element);

	tile(element).click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);

	const sheet = element.shadowRoot?.querySelector(".sheet");
	if (sheet === null || sheet === undefined) throw new Error("no sheet");
	sheet.dispatchEvent(new Event("pointerdown", { bubbles: true }));
	dialog(element).dispatchEvent(new MouseEvent("click", { bubbles: true }));
	await settle(element);

	expect(dialog(element).open).toBe(true);
	expect(cell(element, "000").getAttribute("aria-checked")).toBe("true");
});

test("Clear empties the draft without closing or committing", async () => {
	const element = await mount();
	element.options = [["000", "Always Cute Acorn", null, "base"]];
	element.selected = ["000"];
	await settle(element);

	tile(element).click();
	await settle(element);
	clear(element).click();
	await settle(element);

	expect([
		cell(element, "000").getAttribute("aria-checked"),
		element.selected,
		dialog(element).open,
	]).toEqual(["false", ["000"], true]);
});

test("the tile wears every alternative the slot holds", async () => {
	const element = await mount();
	element.options = [
		["000", "Always Cute Acorn", null, "base"],
		["007", "Blessed Stretched Acorn", null, "blessed"],
	];
	element.selected = ["000", "007"];
	await settle(element);

	const list = element.shadowRoot?.querySelector(".picks");

	expect(list?.textContent).toContain("Always Cute Acorn");
	expect(list?.textContent).toContain("Blessed Stretched Acorn");
});

// A slot's alternatives are written in id order, so click order would produce
// a different code for the same slot.
test("selected reads back in the option order, not the order clicked", async () => {
	const element = await mount();

	tile(element).click();
	await settle(element);
	cell(element, "003").click();
	await settle(element);
	cell(element, "001").click();
	await settle(element);
	done(element).click();
	await settle(element);

	expect(element.selected).toEqual(["001", "003"]);
});

test("a value the options do not contain is dropped by the setter", async () => {
	const element = await mount();

	element.selected = ["001", "zzz"];
	await element.updateComplete;

	expect(element.selected).toEqual(["001"]);
});

test("a value the replaced options no longer contain is dropped", async () => {
	const element = await mount();

	element.selected = ["001"];
	element.options = [["002", "Bear Jelly's Ferris Wheel", null]];
	await element.updateComplete;

	expect(element.selected).toEqual([]);
});

test("typing in the search box narrows the list", async () => {
	const element = await mount();
	tile(element).click();
	await settle(element);
	const box = search(element);
	if (box === null) throw new Error("no search box");

	box.value = "acorn";
	box.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await element.updateComplete;

	expect(entries(element).map((entry) => entry.value)).toEqual(["001"]);
});

test("the search box's own event does not escape the shadow root", async () => {
	const element = await mount();
	let escaped = 0;
	element.addEventListener("input", () => {
		escaped += 1;
	});

	tile(element).click();
	await settle(element);
	search(element)?.dispatchEvent(
		new Event("input", { bubbles: true, composed: true }),
	);
	await element.updateComplete;

	expect(escaped).toBe(0);
});

test("a picked entry is marked as checked", async () => {
	const element = await mount();

	element.selected = ["003"];
	await element.updateComplete;
	tile(element).click();
	await settle(element);

	expect(
		entries(element).map((entry) => entry.getAttribute("aria-checked")),
	).toEqual(["false", "false", "true"]);
});

test("the first pick is the slot's single tab stop", async () => {
	const element = await mount();

	element.selected = ["002"];
	await element.updateComplete;
	tile(element).click();
	await settle(element);

	expect(entries(element).map((entry) => entry.tabIndex)).toEqual([-1, 0, -1]);
});

// Two cells can carry the same picture and nearly the same name, so the kind
// is what the eye has left to go on.
test("each entry wears the badge of its kind", async () => {
	const element = await mountKinded();

	expect(entries(element).map((entry) => entry.dataset["kind"])).toEqual([
		"base",
		"evolved",
		"blessed",
	]);
	expect(
		entries(element).map((entry) =>
			entry.querySelector(".badge")?.textContent?.trim(),
		),
	).toEqual(["N", "E", "B"]);
});

// Colour and a letter are no help to a screen reader, so the cell says it.
test("an entry names its kind in its accessible name", async () => {
	const element = await mountKinded();

	expect(
		entries(element).map((entry) => entry.getAttribute("aria-label")),
	).toEqual([
		"Always Cute Acorn, Base",
		"Chewy Cheese Ball, Evolved",
		"Blessed Chewy Cheese Ball, Blessed",
	]);
});

// Cookies and pets have no chain, and neither does an option list written
// before this existed. Nothing is claimed about either.
test("an entry with no kind wears no badge and claims nothing", async () => {
	const element = await mount();

	expect(entries(element).map((entry) => entry.dataset["kind"])).toEqual([
		undefined,
		undefined,
		undefined,
	]);
	expect(element.shadowRoot?.querySelector(".entry .badge")).toBe(null);
	expect(entries(element)[0]?.getAttribute("aria-label")).toBe(
		"Always Cute Acorn",
	);
});

// The closed line is where a built slot is read back, so it has to answer the
// same question the grid does — and a chip has a border to answer it with.
test("a pick carries its kind onto the closed line", async () => {
	const element = await mountKinded();

	element.selected = ["002", "003"];
	await element.updateComplete;

	expect(
		[...(element.shadowRoot?.querySelectorAll<HTMLElement>(".chip") ?? [])].map(
			(chip) => chip.dataset["kind"],
		),
	).toEqual(["evolved", "blessed"]);
});

function kindFilters(element: EntryTiles): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			".kinds button",
		) ?? []),
	];
}

function pressKind(element: EntryTiles, kind: string): void {
	kindFilters(element)
		.find((button) => button.dataset["kind"] === kind)
		?.click();
}

test("the filter row offers every kind, plus all of them", async () => {
	const element = await mountKinded();

	expect(kindFilters(element).map((button) => button.dataset["kind"])).toEqual([
		"all",
		"base",
		"evolved",
		"blessed",
	]);
	expect(
		kindFilters(element).map((button) => button.textContent?.trim()),
	).toEqual(["All", "Base", "Evolved", "Blessed"]);
});

test("a list carrying no kinds has no filter row to offer", async () => {
	const element = await mount();

	expect(kindFilters(element)).toEqual([]);
});

test("picking a kind narrows the grid to it", async () => {
	const element = await mountKinded();
	tile(element).click();
	await settle(element);

	pressKind(element, "blessed");
	await settle(element);

	expect(entries(element).map((entry) => entry.value)).toEqual(["003"]);
});

test("All brings the rest of the list back", async () => {
	const element = await mountKinded();
	tile(element).click();
	await settle(element);

	pressKind(element, "evolved");
	await settle(element);
	pressKind(element, "all");
	await settle(element);

	expect(entries(element).map((entry) => entry.value)).toEqual([
		"001",
		"002",
		"003",
	]);
});

test("the row says which kind it is filtering by", async () => {
	const element = await mountKinded();
	tile(element).click();
	await settle(element);

	pressKind(element, "evolved");
	await settle(element);

	expect(
		kindFilters(element).map((button) => button.getAttribute("aria-pressed")),
	).toEqual(["false", "false", "true", "false"]);
});

// Two narrowings of one list, not two lists.
test("the kind filter and the search box narrow together", async () => {
	const element = await mountKinded();
	tile(element).click();
	await settle(element);
	const box = search(element);
	if (box === null) throw new Error("no search box");

	pressKind(element, "blessed");
	await settle(element);
	box.value = "chewy";
	box.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await settle(element);

	expect(entries(element).map((entry) => entry.value)).toEqual(["003"]);
});

// Narrowing a list is not a change of what the slot holds — the same rule the
// search box follows.
test("filtering by kind does not escape the shadow root as a change", async () => {
	const element = await mountKinded();
	let escaped = 0;
	element.addEventListener("input", () => {
		escaped += 1;
	});

	tile(element).click();
	await settle(element);
	pressKind(element, "base");
	await settle(element);

	expect(escaped).toBe(0);
});

// Reopening the dialog with the previous visit's kind filter still narrowed
// leaves picked cells off screen with nothing on screen saying why.
test("closing the dialog resets the kind filter for the next time it opens", async () => {
	const element = await mountKinded();
	tile(element).click();
	await settle(element);

	pressKind(element, "blessed");
	await settle(element);
	dialog(element).close();
	await settle(element);

	tile(element).click();
	await settle(element);

	expect(entries(element).map((entry) => entry.value)).toEqual([
		"001",
		"002",
		"003",
	]);
	expect(
		kindFilters(element).map((button) => button.getAttribute("aria-pressed")),
	).toEqual(["true", "false", "false", "false"]);
});

test("a pick the kind filter hides is still held, and still on the closed line", async () => {
	const element = await mountKinded();

	element.selected = ["002"];
	await element.updateComplete;
	tile(element).click();
	await settle(element);
	pressKind(element, "blessed");
	await settle(element);

	expect(element.selected).toEqual(["002"]);
	expect(
		element.shadowRoot?.querySelector(".chip .name")?.textContent?.trim(),
	).toBe("Chewy Cheese Ball");
});

test("an arrow walks to the next entry", async () => {
	const element = await mount();
	tile(element).click();
	await settle(element);

	entries(element)[0]?.focus();
	entries(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(entries(element)[1] ?? null);
});

// Dropping one alternative is what the list is read for, so it happens on the
// list rather than inside the dialog, and it commits straight away: there is
// nothing to cancel, and a list you must confirm a deletion in is a list you
// cannot tidy at a glance.
test("a pick's own button drops it from the slot", async () => {
	const element = await mount();
	element.selected = ["001", "003"];
	await settle(element);
	let heard = 0;
	element.addEventListener("input", () => {
		heard += 1;
	});

	const remove = element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
		".picks button.remove",
	);
	remove?.[0]?.click();
	await settle(element);

	expect([element.selected, heard]).toEqual([["003"], 1]);
});

// The row focus was on has stopped existing, so focus goes to whichever button
// took its place — and to the slot's own button once the list has emptied.
test("focus survives a drop", async () => {
	const element = await mount();
	element.selected = ["001", "003"];
	await settle(element);

	element.shadowRoot
		?.querySelectorAll<HTMLButtonElement>(".picks button.remove")[0]
		?.click();
	await settle(element);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(
		element.shadowRoot?.querySelector(".picks button.remove"),
	);

	element.shadowRoot
		?.querySelectorAll<HTMLButtonElement>(".picks button.remove")[0]
		?.click();
	await settle(element);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(tile(element));
});

function levelButtons(element: EntryTiles, value: string): HTMLButtonElement[] {
	const row = [
		...(element.shadowRoot?.querySelectorAll<HTMLElement>(".chip") ?? []),
	].find((chip) => chip.getAttribute("data-value") === value);
	return [...(row?.querySelectorAll<HTMLButtonElement>("button.level") ?? [])];
}

function pressed(element: EntryTiles, value: string): number[] {
	return levelButtons(element, value)
		.filter((button) => button.getAttribute("aria-pressed") === "true")
		.map((button) => Number(button.getAttribute("data-level")));
}

async function press(
	element: EntryTiles,
	value: string,
	level: number,
): Promise<void> {
	levelButtons(element, value)[level]?.click();
	await element.updateComplete;
}

test("each pick has ten level buttons, +0 through +9, with only +0 pressed", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	await element.updateComplete;

	expect(
		levelButtons(element, "001").map((button) => button.textContent?.trim()),
	).toEqual(["+0", "+1", "+2", "+3", "+4", "+5", "+6", "+7", "+8", "+9"]);
	expect(pressed(element, "001")).toEqual([0]);
	const group = element.shadowRoot?.querySelector(
		'.chip[data-value="001"] .levels',
	);
	expect(group?.getAttribute("role")).toBe("group");
	expect(group?.getAttribute("aria-label")).toBe("Always Cute Acorn levels");
	expect(element.levels).toEqual({ "001": [0], "002": [0] });
});

test("the levels setter shows on the buttons and keeps only selected values", async () => {
	const element = await mount();
	element.selected = ["001"];
	element.levels = { "001": [9, 0, 2, 1, 5, 5], "003": [9] };
	await element.updateComplete;

	expect(pressed(element, "001")).toEqual([0, 1, 2, 5, 9]);
	expect(element.levels).toEqual({ "001": [0, 1, 2, 5, 9] });
});

test("pressing a level toggles it and dispatches one input each time", async () => {
	const element = await mount();
	element.selected = ["001"];
	await element.updateComplete;

	let inputs = 0;
	const count = (): void => {
		inputs++;
	};
	element.addEventListener("input", count);

	await press(element, "001", 9);
	expect(element.levels).toEqual({ "001": [0, 9] });
	expect(inputs).toBe(1);

	await press(element, "001", 0);
	expect(element.levels).toEqual({ "001": [9] });
	expect(inputs).toBe(2);

	element.removeEventListener("input", count);
});

test("the last pressed level cannot be released", async () => {
	const element = await mount();
	element.selected = ["001"];
	await element.updateComplete;

	let inputs = 0;
	const count = (): void => {
		inputs++;
	};
	element.addEventListener("input", count);

	expect(levelButtons(element, "001")[0]?.getAttribute("aria-disabled")).toBe(
		"true",
	);
	await press(element, "001", 0);
	expect(element.levels).toEqual({ "001": [0] });
	expect(inputs).toBe(0);

	await press(element, "001", 3);
	expect(levelButtons(element, "001")[0]?.hasAttribute("aria-disabled")).toBe(
		false,
	);

	element.removeEventListener("input", count);
});

test("dropping one pick keeps the other's levels", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "001": [1], "002": [4, 5, 6, 7, 8, 9] };
	await element.updateComplete;

	element.shadowRoot
		?.querySelector<HTMLButtonElement>('.chip[data-value="001"] button.remove')
		?.click();
	await element.updateComplete;

	expect(element.selected).toEqual(["002"]);
	expect(element.levels).toEqual({ "002": [4, 5, 6, 7, 8, 9] });
});

test("Done keeps the levels of picks that stay, and a re-added pick starts at +0", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "001": [6], "002": [9] };
	await element.updateComplete;

	tile(element).click();
	await element.updateComplete;
	entries(element)
		.find((cell) => cell.value === "002")
		?.click();
	entries(element)
		.find((cell) => cell.value === "003")
		?.click();
	await element.updateComplete;
	done(element).click();
	await element.updateComplete;
	expect(element.levels).toEqual({ "001": [6], "003": [0] });

	tile(element).click();
	await element.updateComplete;
	entries(element)
		.find((cell) => cell.value === "002")
		?.click();
	await element.updateComplete;
	done(element).click();
	await element.updateComplete;
	expect(element.levels["002"]).toEqual([0]);
});

test("toggling one pick's level leaves the other pick's buttons alone", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "002": [3, 4] };
	await element.updateComplete;

	await press(element, "001", 7);

	expect(pressed(element, "001")).toEqual([0, 7]);
	expect(pressed(element, "002")).toEqual([3, 4]);
});
