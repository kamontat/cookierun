/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools.ts";

import "./tool-index.ts";

test("the home index says what each tool does, not just its name", () => {
	document.body.replaceChildren();
	const index = document.createElement("tool-index");
	document.body.append(index);

	expect(index.querySelectorAll("dt").length).toBe(TOOLS.length);

	TOOLS.forEach((tool, position) => {
		const link = index.querySelectorAll("dt")[position]?.querySelector("a");
		expect(link?.getAttribute("href")).toBe(`./${tool.slug}/`);
		expect(link?.textContent).toBe(tool.name);
		expect(index.querySelectorAll("dd")[position]?.textContent).toBe(
			tool.tagline,
		);
	});
});

// The page used to supply the <dl> and have it filled in by id.
test("the element brings its own description list", () => {
	document.body.replaceChildren();
	document.body.append(document.createElement("tool-index"));

	expect(document.body.querySelector("tool-index > dl")).not.toBeNull();
});
