/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./build-summary";

import type { BuildSummary } from "./build-summary";

async function mount(): Promise<BuildSummary> {
	document.body.replaceChildren();
	const element = document.createElement("build-summary") as BuildSummary;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function inside(element: BuildSummary): ShadowRoot {
	const root = element.shadowRoot;
	if (root === null) throw new Error("the element has no shadow root");
	return root;
}

function text(element: BuildSummary, selector: string): string {
	return inside(element).querySelector(selector)?.textContent?.trim() ?? "";
}

const LOADOUT = {
	label: "Loadout",
	items: [
		{
			label: "Fairy Cookie",
			note: "Cookie",
			shape: "tile" as const,
			faces: [{ src: "cookies/ch26.png" }],
		},
	],
};

test("a group draws its heading and its items", async () => {
	const element = await mount();

	element.groups = [LOADOUT];
	await element.updateComplete;

	expect(text(element, ".group h3")).toBe("Loadout");
	expect(text(element, ".item .label")).toBe("Fairy Cookie");
	expect(text(element, ".item .note")).toBe("Cookie");
	expect(inside(element).querySelector("img")?.getAttribute("src")).toBe(
		"cookies/ch26.png",
	);
});

// A treasure slot holding alternatives is one item wearing several faces, the
// way a cookie power+ belonging to four cookies is.
test("every face of an item is drawn, in the order given", async () => {
	const element = await mount();

	element.groups = [
		{
			label: "Treasures",
			items: [
				{
					label: "Always Cute Acorn or Blessed Stretched Acorn",
					note: "1",
					shape: "tile",
					faces: [
						{ src: "a.png", kind: "base" },
						{ src: "b.png", kind: "blessed" },
					],
				},
			],
		},
	];
	await element.updateComplete;

	const faces = [...inside(element).querySelectorAll(".face")];

	expect(
		faces.map((face) => [
			face.getAttribute("data-kind"),
			face.querySelector("img")?.getAttribute("src"),
		]),
	).toEqual([
		["base", "a.png"],
		["blessed", "b.png"],
	]);
});

// Three fields of the format have no art at all - the run type, the random
// boost and the action - so an item with no faces is a label and nothing else
// rather than a broken picture.
test("an item with no faces draws no picture", async () => {
	const element = await mount();

	element.groups = [
		{ label: "Run", items: [{ label: "Double Coins", shape: "chip" }] },
	];
	await element.updateComplete;

	expect(text(element, ".item .label")).toBe("Double Coins");
	expect(inside(element).querySelector("img")).toBe(null);
});

test("a semi-auto verdict wears a badge and names what forces the work", async () => {
	const element = await mount();

	element.groups = [LOADOUT];
	element.verdict = { semi: true, reasons: ["Fast Start", "Jump at start"] };
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Semi-auto");
	expect(text(element, ".verdict")).toBe(
		"Fast Start, Jump at start need manual work each run.",
	);
});

test("a full-auto verdict says nothing needs manual work", async () => {
	const element = await mount();

	element.groups = [LOADOUT];
	element.verdict = { semi: false, reasons: [] };
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Full auto");
	expect(text(element, ".verdict")).toBe("Nothing needs manual work each run.");
});

// Auto vs semi-auto means nothing for the hand-played types, so the badge goes
// away rather than claiming one of them.
test("a cleared verdict takes the badge and the line with it", async () => {
	const element = await mount();

	element.groups = [LOADOUT];
	element.verdict = { semi: true, reasons: ["Fast Start"] };
	await element.updateComplete;
	element.verdict = null;
	await element.updateComplete;

	expect(inside(element).querySelector(".badge")).toBe(null);
	expect(inside(element).querySelector(".verdict")).toBe(null);
});

// A group whose every field is unset is left out by the page, and a card with
// no groups at all is a heading over nothing.
test("nothing to show renders nothing at all", async () => {
	const element = await mount();

	expect(inside(element).querySelector(".card")).toBe(null);
});

test("the card announces itself politely", async () => {
	const element = await mount();

	expect(element.getAttribute("aria-live")).toBe("polite");
});
