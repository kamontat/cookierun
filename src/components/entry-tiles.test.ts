/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-tiles";

import type { EntryTiles } from "./entry-tiles";

const TREASURES = [
	["001", "Always Cute Acorn", "../assets/treasures/tr_ga034.png"],
	["002", "Bear Jelly's Ferris Wheel", "../assets/treasures/tr_ga001.png"],
	["003", "Cheesecake Slice", null],
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

test("an arrow walks to the next entry", async () => {
	const element = await mount();

	entries(element)[0]?.focus();
	entries(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(entries(element)[1] ?? null);
});
