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

function toggleButton(element: BuildSummary): HTMLButtonElement {
	const button = inside(element).querySelector<HTMLButtonElement>(
		"h2 button[aria-expanded]",
	);
	if (button === null) throw new Error("the heading is not a toggle");
	return button;
}

test("the heading is a button that collapses and reopens the board, saying which", async () => {
	const element = await mount();
	let toggles = 0;
	element.addEventListener("toggle", () => {
		toggles += 1;
	});

	expect(element.collapsed).toBe(false);
	expect(toggleButton(element).getAttribute("aria-expanded")).toBe("true");

	toggleButton(element).click();
	await element.updateComplete;

	expect(element.collapsed).toBe(true);
	expect(element.hasAttribute("collapsed")).toBe(true);
	expect(toggleButton(element).getAttribute("aria-expanded")).toBe("false");
	expect(toggles).toBe(1);

	toggleButton(element).click();
	await element.updateComplete;

	expect(element.collapsed).toBe(false);
	expect(toggles).toBe(2);
});

// The page sets it from what it remembered; that is not a click to announce.
test("setting collapsed from outside dispatches nothing", async () => {
	const element = await mount();
	let toggles = 0;
	element.addEventListener("toggle", () => {
		toggles += 1;
	});

	element.collapsed = true;
	await element.updateComplete;

	expect(toggleButton(element).getAttribute("aria-expanded")).toBe("false");
	expect(toggles).toBe(0);
});

// Folded away, the badge and the sentence are what is left to read the build
// by, so they stay.
test("a collapsed board keeps its verdict on show", async () => {
	const element = await mount();
	element.verdict = { semi: true, reasons: ["Fast Start"] };
	element.collapsed = true;
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Semi-auto");
	expect(text(element, ".verdict")).toBe(
		"Fast Start needs manual work each run.",
	);
});
