/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./verdict-line";

import type { VerdictLine } from "./verdict-line";

async function mount(): Promise<VerdictLine> {
	document.body.replaceChildren();
	const element = document.createElement("verdict-line") as VerdictLine;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function text(element: VerdictLine, selector: string): string {
	return element.shadowRoot?.querySelector(selector)?.textContent?.trim() ?? "";
}

test("the summary reads as one line of prose", async () => {
	const element = await mount();

	element.summary = ["Score", "Any episode", "Fast Start"];
	await element.updateComplete;

	expect(text(element, ".summary")).toBe("Score · Any episode · Fast Start");
});

test("an empty summary renders nothing in its place", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector(".summary")).toBe(null);
});

test("a full-auto verdict says nothing needs manual work", async () => {
	const element = await mount();

	element.verdict = { semi: false, reasons: [] };
	await element.updateComplete;

	expect(text(element, ".verdict")).toBe(
		"Full auto — nothing needs manual work each run.",
	);
});

test("a semi-auto verdict names what forces the manual work", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start"] };
	await element.updateComplete;

	expect(text(element, ".verdict")).toBe(
		"Semi-auto — Fast Start needs manual work each run.",
	);
});

test("several reasons are listed and read as plural", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start", "Jump at start"] };
	await element.updateComplete;

	expect(text(element, ".verdict")).toBe(
		"Semi-auto — Fast Start, Jump at start need manual work each run.",
	);
});

// Auto vs semi-auto means nothing for the hand-played types, so the line goes
// away rather than claiming one of them.
test("a cleared verdict renders no verdict line", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start"] };
	await element.updateComplete;
	element.verdict = null;
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector(".verdict")).toBe(null);
});

test("the line announces itself politely", async () => {
	const element = await mount();

	expect(element.getAttribute("aria-live")).toBe("polite");
});
