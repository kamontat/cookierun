/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools";

import "./tool-index";

import type { ToolIndex } from "./tool-index";

async function mount(): Promise<ToolIndex> {
	document.body.replaceChildren();
	const element = document.createElement("tool-index") as ToolIndex;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

test("every registered tool gets a term and a description", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelectorAll("dt").length).toBe(TOOLS.length);
	expect(element.shadowRoot?.querySelectorAll("dd").length).toBe(TOOLS.length);
});

test("each term links to its tool from the home pane", async () => {
	const element = await mount();
	const link = element.shadowRoot?.querySelector("dt a");

	expect(link?.getAttribute("href")).toBe("./combi-name/");
	expect(link?.textContent).toBe("Combi name codes");
});
