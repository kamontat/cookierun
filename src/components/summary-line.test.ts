/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./summary-line";

import type { SummaryLine } from "./summary-line";

async function mount(): Promise<SummaryLine> {
	document.body.replaceChildren();
	const element = document.createElement("summary-line") as SummaryLine;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function text(element: SummaryLine): string {
	return element.shadowRoot?.textContent?.trim() ?? "";
}

test("the fields read as one line of prose", async () => {
	const element = await mount();

	element.fields = ["Score", "Any episode", "Fast Start"];
	await element.updateComplete;

	expect(text(element)).toBe("Score · Any episode · Fast Start");
});

// The line sits in the sticky panel, where an empty paragraph would still take
// its height off a phone screen.
test("nothing to say renders nothing at all", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector("p")).toBe(null);
});

test("a line emptied again goes away", async () => {
	const element = await mount();

	element.fields = ["Score"];
	await element.updateComplete;
	element.fields = [];
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector("p")).toBe(null);
});

test("the line announces itself politely", async () => {
	const element = await mount();

	expect(element.getAttribute("aria-live")).toBe("polite");
});
