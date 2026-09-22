/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./card-group";

import type { CardGroup } from "./card-group";

const POWERS = [
	["cheerleader", "Cheerleader Cookie", "../assets/cookies/ch20.png"],
	["fairy", "Fairy Cookie", "../assets/cookies/ch26.png"],
	["expParty", "EXP Party", null],
] as const;

async function mount(legend = "Cookie power+"): Promise<CardGroup> {
	document.body.replaceChildren();
	const element = document.createElement("card-group") as CardGroup;
	element.setAttribute("legend", legend);
	document.body.append(element);
	element.options = POWERS;
	await element.updateComplete;
	return element;
}

function cards(element: CardGroup): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button.card",
		) ?? []),
	];
}

test("the legend names the group", async () => {
	const element = await mount("Boosts");

	expect(element.shadowRoot?.querySelector("legend")?.textContent).toBe(
		"Boosts",
	);
});

test("a card is rendered per option, in the order given", async () => {
	const element = await mount();

	expect(cards(element).map((card) => card.value)).toEqual([
		"cheerleader",
		"fairy",
		"expParty",
	]);
});

// This is the wire format: cookie powers are bit positions and boosts occupy
// slots 4-6, so reading back in click order would reorder the code.
test("selected reads back in the option order, not the order clicked", async () => {
	const element = await mount();

	cards(element)[2]?.click();
	await element.updateComplete;
	cards(element)[0]?.click();
	await element.updateComplete;

	expect(element.selected).toEqual(["cheerleader", "expParty"]);
});

test("setting selected checks exactly those cards", async () => {
	const element = await mount();

	element.selected = ["fairy"];
	await element.updateComplete;

	expect(
		cards(element).map((card) => card.getAttribute("aria-checked")),
	).toEqual(["false", "true", "false"]);
});

test("clicking a checked card unchecks it", async () => {
	const element = await mount();

	element.selected = ["fairy"];
	await element.updateComplete;
	cards(element)[1]?.click();
	await element.updateComplete;

	expect(element.selected).toEqual([]);
});

test("clicking a card dispatches exactly one input event from the host", async () => {
	const element = await mount();
	let seen = 0;
	element.addEventListener("input", (event) => {
		seen += 1;
		expect(event.target).toBe(element);
	});

	cards(element)[0]?.click();
	await element.updateComplete;

	expect(seen).toBe(1);
});

test("a value the options do not contain is dropped by the setter", async () => {
	const element = await mount();

	element.selected = ["fairy", "nowhere"];
	await element.updateComplete;

	expect(element.selected).toEqual(["fairy"]);
});

// Options and the selection are two separate writes, so a list replaced under
// a pick has to prune at render too, not only in the setter.
test("a value the replaced options no longer contain is dropped", async () => {
	const element = await mount();

	element.selected = ["fairy"];
	element.options = [["cheerleader", "Cheerleader Cookie", null]];
	await element.updateComplete;

	expect(element.selected).toEqual([]);
});

test("an option with art renders its image", async () => {
	const element = await mount();

	expect(cards(element)[0]?.querySelector("img")?.getAttribute("src")).toBe(
		"../assets/cookies/ch20.png",
	);
});

// Two of the cookie powers are not cookies and have no portrait, so the card
// still needs a face rather than an empty frame.
test("an option without art renders a lettered tile instead", async () => {
	const element = await mount();

	const card = cards(element)[2];
	expect(card?.querySelector("img")).toBe(null);
	expect(card?.querySelector(".glyph")?.textContent?.trim()).toBe("EP");
});

test("the card names its option", async () => {
	const element = await mount();

	expect(cards(element)[1]?.querySelector(".name")?.textContent?.trim()).toBe(
		"Fairy Cookie",
	);
});

test("the cards carry checkbox semantics", async () => {
	const element = await mount();

	expect(cards(element)[0]?.getAttribute("role")).toBe("checkbox");
});
