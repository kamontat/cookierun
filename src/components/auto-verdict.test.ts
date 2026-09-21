/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./auto-verdict.ts";

import type { AutoVerdictElement } from "./auto-verdict.ts";

function mount(prefix: string): AutoVerdictElement {
	document.body.replaceChildren();
	const element = document.createElement("auto-verdict");
	element.setAttribute("prefix", prefix);
	document.body.append(element);
	return element;
}

test("nothing renders until there is a verdict", () => {
	const element = mount("Stored as");

	expect(element.textContent).toBe("");
});

test("full auto says nothing needs manual work", () => {
	const element = mount("Stored as");

	element.verdict = { semi: false, reasons: [] };

	expect(element.textContent).toBe(
		"Stored as Full auto - nothing needs manual work each run.",
	);
	expect(element.querySelector("strong")?.textContent).toBe("Full auto");
});

test("one reason reads needs, more than one reads need", () => {
	const element = mount("This code is");

	element.verdict = { semi: true, reasons: ["Fast Start"] };
	expect(element.textContent).toBe(
		"This code is Semi-auto - Fast Start needs manual work each run.",
	);

	element.verdict = { semi: true, reasons: ["Fast Start", "Jump at start"] };
	expect(element.textContent).toBe(
		"This code is Semi-auto - Fast Start, Jump at start need manual work each run.",
	);
});

// The hand-played types have no verdict, and the line has to empty out again
// rather than keep the last one.
test("clearing the verdict empties the line", () => {
	const element = mount("Stored as");

	element.verdict = { semi: false, reasons: [] };
	element.verdict = null;

	expect(element.textContent).toBe("");
});

// Both call sites set a prefix, but an element without one should not open
// with a stray space before the verdict.
test("no prefix means no leading space", () => {
	document.body.replaceChildren();
	const element = document.createElement("auto-verdict");
	document.body.append(element);

	element.verdict = { semi: false, reasons: [] };

	expect(element.textContent).toBe(
		"Full auto - nothing needs manual work each run.",
	);
});
