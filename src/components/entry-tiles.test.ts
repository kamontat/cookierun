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

function remove(
	element: EntryTiles,
	index: number,
): HTMLButtonElement | undefined {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"summary button.remove",
		) ?? []),
	][index];
}

function search(element: EntryTiles): HTMLInputElement | null {
	return element.shadowRoot?.querySelector("input") ?? null;
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

	expect(element.shadowRoot?.querySelector(".pick")?.textContent?.trim()).toBe(
		"None",
	);
});

// The same "this or that" the code reads as, so a closed slot says exactly
// what the summary above it would say.
test("alternatives read as this or that on the closed line", async () => {
	const element = await mount();

	element.selected = ["001", "003"];
	await element.updateComplete;

	const pick = element.shadowRoot?.querySelector(".pick");
	expect(
		[...(pick?.querySelectorAll(".name") ?? [])].map((name) =>
			name.textContent?.trim(),
		),
	).toEqual(["Always Cute Acorn", "Cheesecake Slice"]);
	expect(
		[...(pick?.querySelectorAll(".or") ?? [])].map((word) =>
			word.textContent?.trim(),
		),
	).toEqual(["or"]);
});

// Four alternatives in one slot used to stack into a tall column of full-size
// portraits. They are chips now: thumbnail, name, and a way out.
test("each pick is a chip carrying its own remove button", async () => {
	const element = await mount();

	element.selected = ["001", "003"];
	await element.updateComplete;

	const removes = [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"summary button.remove",
		) ?? []),
	];
	expect(removes.map((button) => button.getAttribute("aria-label"))).toEqual([
		"Remove Always Cute Acorn",
		"Remove Cheesecake Slice",
	]);
});

test("the remove button drops that pick and leaves the others", async () => {
	const element = await mount();

	element.selected = ["001", "003"];
	await element.updateComplete;
	remove(element, 0)?.click();
	await settle(element);

	expect(element.selected).toEqual(["003"]);
});

test("removing a pick dispatches exactly one input event from the host", async () => {
	const element = await mount();
	element.selected = ["001", "003"];
	await element.updateComplete;
	let seen = 0;
	element.addEventListener("input", () => {
		seen += 1;
	});

	remove(element, 0)?.click();
	await settle(element);

	expect(seen).toBe(1);
});

// The button sits inside the summary, where any click would otherwise open the
// list — which is the opposite of what someone tidying a slot is asking for.
test("removing a pick does not open the list", async () => {
	const element = await mount();

	element.selected = ["001"];
	await element.updateComplete;
	const click = new MouseEvent("click", { bubbles: true, cancelable: true });
	remove(element, 0)?.dispatchEvent(click);
	await settle(element);

	expect(click.defaultPrevented).toBe(true);
	expect(element.open).toBe(false);
});

test("removing the last pick leaves the slot saying None", async () => {
	const element = await mount();

	element.selected = ["001"];
	await element.updateComplete;
	remove(element, 0)?.click();
	await settle(element);

	expect(element.selected).toEqual([]);
	expect(element.shadowRoot?.querySelector(".pick")?.textContent?.trim()).toBe(
		"None",
	);
});

// Focus has to land somewhere after the chip it was on stops existing.
test("focus moves to the next remove button when one is taken away", async () => {
	const element = await mount();

	element.selected = ["001", "003"];
	await element.updateComplete;
	remove(element, 0)?.focus();
	remove(element, 0)?.click();
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(remove(element, 0) ?? null);
});

test("the picked entries show their thumbnails on the closed line", async () => {
	const element = await mount();

	element.selected = ["001"];
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".pick img")?.getAttribute("src"),
	).toBe("../assets/treasures/tr_ga034.png");
});

test("clicking an entry adds it to the slot", async () => {
	const element = await mount();

	entries(element)[1]?.click();
	await settle(element);

	expect(element.selected).toEqual(["002"]);
});

test("clicking a picked entry removes it", async () => {
	const element = await mount();

	element.selected = ["002"];
	await element.updateComplete;
	entries(element)[1]?.click();
	await settle(element);

	expect(element.selected).toEqual([]);
});

// A slot's alternatives are written in id order, so click order would produce
// a different code for the same slot.
test("selected reads back in the option order, not the order clicked", async () => {
	const element = await mount();

	entries(element)[2]?.click();
	await settle(element);
	entries(element)[0]?.click();
	await settle(element);

	expect(element.selected).toEqual(["001", "003"]);
});

test("clicking an entry dispatches exactly one input event from the host", async () => {
	const element = await mount();
	let seen = 0;
	element.addEventListener("input", (event) => {
		seen += 1;
		expect(event.target).toBe(element);
	});

	entries(element)[0]?.click();
	await settle(element);

	expect(seen).toBe(1);
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

	expect(
		entries(element).map((entry) => entry.getAttribute("aria-checked")),
	).toEqual(["false", "false", "true"]);
});

test("the first pick is the slot's single tab stop", async () => {
	const element = await mount();

	element.selected = ["002"];
	await element.updateComplete;

	expect(entries(element).map((entry) => entry.tabIndex)).toEqual([-1, 0, -1]);
});

test("the host says whether its list is open", async () => {
	const element = await mount();
	const details = element.shadowRoot?.querySelector("details");
	if (details == null) throw new Error("the slot has no details");

	details.open = true;
	details.dispatchEvent(new Event("toggle"));
	await element.updateComplete;

	expect(element.hasAttribute("open")).toBe(true);
});

test("a click outside the slot closes it", async () => {
	const element = await mount();
	const details = element.shadowRoot?.querySelector("details");
	if (details == null) throw new Error("the slot has no details");

	details.open = true;
	details.dispatchEvent(new Event("toggle"));
	await element.updateComplete;

	document.body.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
	await element.updateComplete;

	expect(element.open).toBe(false);
	expect(details.open).toBe(false);
});

test("a click inside the slot leaves it open", async () => {
	const element = await mount();
	const details = element.shadowRoot?.querySelector("details");
	if (details == null) throw new Error("the slot has no details");

	details.open = true;
	details.dispatchEvent(new Event("toggle"));
	await element.updateComplete;

	entries(element)[0]?.dispatchEvent(
		new MouseEvent("pointerdown", { bubbles: true, composed: true }),
	);
	await element.updateComplete;

	expect(element.open).toBe(true);
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

	pressKind(element, "blessed");
	await settle(element);

	expect(entries(element).map((entry) => entry.value)).toEqual(["003"]);
});

test("All brings the rest of the list back", async () => {
	const element = await mountKinded();

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

	pressKind(element, "evolved");
	await settle(element);

	expect(
		kindFilters(element).map((button) => button.getAttribute("aria-pressed")),
	).toEqual(["false", "false", "true", "false"]);
});

// Two narrowings of one list, not two lists.
test("the kind filter and the search box narrow together", async () => {
	const element = await mountKinded();
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

	pressKind(element, "base");
	await settle(element);

	expect(escaped).toBe(0);
});

test("a pick the kind filter hides is still held, and still on the closed line", async () => {
	const element = await mountKinded();

	element.selected = ["002"];
	await element.updateComplete;
	pressKind(element, "blessed");
	await settle(element);

	expect(element.selected).toEqual(["002"]);
	expect(
		element.shadowRoot?.querySelector(".chip .name")?.textContent?.trim(),
	).toBe("Chewy Cheese Ball");
});

test("an arrow walks to the next entry", async () => {
	const element = await mount();

	entries(element)[0]?.focus();
	entries(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(entries(element)[1] ?? null);
});
