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

test("a semi-auto verdict wears a badge and names what forces the work", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start", "Jump at start"] };
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Semi-auto");
	expect(text(element, ".verdict")).toBe(
		"Fast Start, Jump at start need manual work each run.",
	);
});

test("a full-auto verdict says nothing needs manual work", async () => {
	const element = await mount();

	element.verdict = { semi: false, reasons: [] };
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Full auto");
	expect(text(element, ".verdict")).toBe("Nothing needs manual work each run.");
});

// The board's own heading stands with or without a verdict; only the badge and
// the sentence are the verdict's.
test("a cleared verdict takes the badge and the line with it", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start"] };
	await element.updateComplete;
	element.verdict = null;
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector(".badge")).toBe(null);
	expect(element.shadowRoot?.querySelector(".verdict")).toBe(null);
	expect(text(element, "h2")).toBe("Your build");
});

test("the card announces itself politely", async () => {
	const element = await mount();

	expect(element.getAttribute("aria-live")).toBe("polite");
});
