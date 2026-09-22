/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./auto-verdict";

import type { AutoVerdictElement } from "./auto-verdict";

async function mount(prefix: string | null): Promise<AutoVerdictElement> {
	document.body.replaceChildren();
	const element = document.createElement("auto-verdict") as AutoVerdictElement;
	if (prefix !== null) element.setAttribute("prefix", prefix);
	document.body.append(element);
	await element.updateComplete;
	return element;
}

async function text(element: AutoVerdictElement): Promise<string> {
	await element.updateComplete;
	return (element.shadowRoot?.textContent ?? "").replace(/\s+/g, " ").trim();
}

test("nothing is said until there is a verdict", async () => {
	const element = await mount("Stored as");

	expect(await text(element)).toBe("");
});

test("full auto says nothing needs manual work", async () => {
	const element = await mount("Stored as");
	element.verdict = { semi: false, reasons: [] };

	expect(await text(element)).toBe(
		"Stored as Full auto - nothing needs manual work each run.",
	);
});

test("one reason reads as a singular", async () => {
	const element = await mount("This code is");
	element.verdict = { semi: true, reasons: ["Fast Start"] };

	expect(await text(element)).toBe(
		"This code is Semi-auto - Fast Start needs manual work each run.",
	);
});

test("several reasons read as a plural, joined by commas", async () => {
	const element = await mount("This code is");
	element.verdict = { semi: true, reasons: ["Fast Start", "a jump"] };

	expect(await text(element)).toBe(
		"This code is Semi-auto - Fast Start, a jump need manual work each run.",
	);
});

// `clearReader` in the combi route sets this back to null on every keystroke
// that shortens a code below ten characters, so a verdict that has rendered
// has to be able to go away again - leaving the last one on screen would say
// "Semi-auto" about a code the reader has already given up on.
test("clearing the verdict empties the line again", async () => {
	const element = await mount("This code is");
	element.verdict = { semi: true, reasons: ["Fast Start"] };
	expect(await text(element)).toBe(
		"This code is Semi-auto - Fast Start needs manual work each run.",
	);

	element.verdict = null;

	expect(await text(element)).toBe("");
});

// Without a prefix the line has to open on the verdict, not on a stray space.
test("an element without a prefix opens on the verdict", async () => {
	const element = await mount(null);
	element.verdict = { semi: false, reasons: [] };

	expect(await text(element)).toBe(
		"Full auto - nothing needs manual work each run.",
	);
});

test("the element announces itself politely", async () => {
	const element = await mount("Stored as");

	expect(element.getAttribute("aria-live")).toBe("polite");
});
