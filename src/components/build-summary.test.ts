/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./build-summary";

import type { BuildSummary, SummaryRow } from "./build-summary";

async function mount(
	rows: readonly SummaryRow[] = [],
	hint: string | null = null,
): Promise<BuildSummary> {
	document.body.replaceChildren();
	const element = document.createElement("build-summary") as BuildSummary;
	element.rows = rows;
	element.hint = hint;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function inside(element: BuildSummary): ShadowRoot {
	const root = element.shadowRoot;
	if (root === null) throw new Error("the element has no shadow root");
	return root;
}

function button(element: BuildSummary, selector: string): HTMLButtonElement {
	const found = inside(element).querySelector<HTMLButtonElement>(selector);
	if (found === null) throw new Error(`no ${selector}`);
	return found;
}

const ROWS: readonly SummaryRow[] = [
	{
		label: "Run",
		target: "mode",
		items: [
			{ kind: "pill", text: "Semi-auto", tone: "semi" },
			{ kind: "text", text: "Fast Start", muted: true },
			{ kind: "sep", text: "·" },
			{ kind: "text", text: "Money" },
		],
	},
	{
		label: "Treasures",
		target: "treasures",
		items: [
			{
				kind: "image",
				src: "../assets/a.png",
				title: "A +3–9 or B +5–9",
				badge: "+1",
				note: "+3–9",
			},
			{ kind: "sep", text: "→" },
			{ kind: "image", src: null, text: "C" },
			{ kind: "tag", text: "exact order" },
		],
	},
];

test("draws a row per entry with its label and items", async () => {
	const element = await mount(ROWS);

	const rows = [...inside(element).querySelectorAll("button.row")];
	expect(rows.length).toBe(2);
	expect(rows.map((row) => row.querySelector(".label")?.textContent)).toEqual([
		"Run",
		"Treasures",
	]);
	const run = rows[0]?.querySelector(".value");
	expect(run?.querySelector(".pill")?.textContent?.trim()).toBe("Semi-auto");
	expect(run?.querySelector(".pill")?.classList.contains("semi")).toBe(true);
	expect(run?.querySelector(".muted")?.textContent?.trim()).toBe("Fast Start");
	expect(run?.textContent).toContain("Money");
	expect(rows[1]?.querySelector(".tag")?.textContent?.trim()).toBe(
		"exact order",
	);
});

test("an image item draws its picture, badge and note", async () => {
	const element = await mount(ROWS);

	const images = inside(element).querySelectorAll(
		"button.row[data-target=treasures] .image",
	);
	const first = images[0];
	expect(first?.querySelector("img")?.getAttribute("src")).toBe(
		"../assets/a.png",
	);
	expect(first?.getAttribute("title")).toBe("A +3–9 or B +5–9");
	expect(first?.querySelector(".badge")?.textContent?.trim()).toBe("+1");
	expect(first?.querySelector(".note")?.textContent?.trim()).toBe("+3–9");

	// A null src draws the text alone, with no broken picture.
	const second = images[1];
	expect(second?.querySelector("img")).toBe(null);
	expect(second?.textContent?.trim()).toBe("C");
	expect(second?.querySelector(".badge")).toBe(null);
});

test("an image item with neither picture nor text shows its title", async () => {
	const element = await mount([
		{
			label: "Treasures",
			target: "treasures",
			items: [{ kind: "image", src: null, title: "Mystery +3" }],
		},
	]);
	element.compact = [{ kind: "image", src: null, title: "Mystery" }];
	await element.updateComplete;

	const image = inside(element).querySelector("button.row .image");
	expect(image?.textContent?.trim()).toBe("Mystery +3");
	expect(button(element, "button.line").textContent).toContain("Mystery");
});

test("an icon-only item is named by its title, on screen and to a screen reader", async () => {
	const element = await mount([
		{
			label: "Boosts",
			target: "boosts",
			items: [
				{ kind: "image", src: "hp.png", title: "HP Extension" },
				{ kind: "stack", srcs: ["a.png", "b.png"], title: "EXP Party" },
				{ kind: "stack", srcs: [], title: "Fairy" },
			],
		},
	]);

	const [image, stack, bare] = inside(element).querySelectorAll(
		"button.row .image, button.row .stack",
	);
	expect(image?.getAttribute("title")).toBe("HP Extension");
	expect(image?.querySelector("img")?.getAttribute("alt")).toBe("HP Extension");
	expect(stack?.getAttribute("title")).toBe("EXP Party");
	expect(stack?.querySelectorAll("img").length).toBe(2);
	expect(stack?.querySelector(".hidden")?.textContent).toBe("EXP Party");
	// No faces to show: the name is the only thing left to say it with.
	expect(bare?.textContent?.trim()).toBe("Fairy");
	expect(bare?.querySelector(".hidden")).toBe(null);
});

test("an image's mark draws the kind's letter and names it", async () => {
	const element = await mount([
		{
			label: "Treasures",
			target: "treasures",
			items: [
				{ kind: "image", src: "a.png", title: "Cheese Ball", mark: "evolved" },
				{
					kind: "image",
					src: "a.png",
					title: "Blessed Cheese Ball",
					mark: "blessed",
				},
				{ kind: "image", src: "b.png", title: "Acorn" },
			],
		},
	]);

	const [evolved, blessed, plain] =
		inside(element).querySelectorAll("button.row .pic");
	expect(evolved?.getAttribute("data-mark")).toBe("evolved");
	expect(evolved?.querySelector(".mark")?.textContent).toBe("E");
	expect(evolved?.querySelector("img")?.getAttribute("alt")).toBe(
		"Cheese Ball, Evolved",
	);
	expect(blessed?.querySelector(".mark")?.textContent).toBe("B");
	expect(plain?.hasAttribute("data-mark")).toBe(false);
	expect(plain?.querySelector(".mark")).toBe(null);
});

test("a caption names a picture under it, once, for every reader", async () => {
	const element = await mount([
		{
			label: "Treasures",
			target: "treasures",
			items: [
				{
					kind: "image",
					src: "a.png",
					title: "Cheese Ball +3 or Acorn",
					caption: "Cheese Ball",
					mark: "evolved",
				},
				{
					kind: "stack",
					srcs: ["a.png", "b.png"],
					title: "EXP Party",
					caption: "EXP Party",
				},
			],
		},
	]);

	const [image, stack] = inside(element).querySelectorAll(
		"button.row .image, button.row .stack",
	);
	expect(image?.querySelector(".caption")?.textContent).toContain(
		"Cheese Ball",
	);
	// The caption says the name, so the picture says nothing more; the kind
	// still reaches a screen reader beside the caption.
	expect(image?.querySelector("img")?.getAttribute("alt")).toBe("");
	expect(image?.querySelector(".caption .hidden")?.textContent).toBe(
		", Evolved",
	);
	expect(stack?.querySelector(".caption")?.textContent).toBe("EXP Party");
	expect(stack?.querySelector(":scope > .hidden")).toBe(null);
});

test("clicking a row fires summary-jump with its target", async () => {
	const element = await mount(ROWS);
	const targets: string[] = [];
	document.body.addEventListener("summary-jump", (event) => {
		targets.push((event as CustomEvent<string>).detail);
	});

	button(element, "button.row[data-target=treasures]").click();
	button(element, "button.row[data-target=mode]").click();

	expect(targets).toEqual(["treasures", "mode"]);
});

test("the compact line expands the rows and Hide folds them", async () => {
	const element = await mount(ROWS);
	element.compact = [{ kind: "text", text: "5 boosts" }];
	await element.updateComplete;

	expect(element.hasAttribute("expanded")).toBe(false);
	expect(button(element, "button.line").textContent).toContain("5 boosts");
	expect(button(element, "button.line").textContent).toContain("▾");

	button(element, "button.line").click();
	await element.updateComplete;
	expect(element.hasAttribute("expanded")).toBe(true);
	expect(button(element, "button.hide").textContent?.trim()).toBe("Hide ▴");

	button(element, "button.hide").click();
	await element.updateComplete;
	expect(element.hasAttribute("expanded")).toBe(false);
});

test("draws the hint when given", async () => {
	const element = await mount(ROWS.slice(0, 1), "Nothing else picked yet.");

	expect(inside(element).querySelector(".hint")?.textContent?.trim()).toBe(
		"Nothing else picked yet.",
	);

	element.hint = null;
	await element.updateComplete;
	expect(inside(element).querySelector(".hint")).toBe(null);
});

// It sits beside the form whose `input` re-renders the build, and nothing it
// does changes a value.
test("fires no input", async () => {
	const element = await mount(ROWS);
	element.compact = [{ kind: "text", text: "Money" }];
	await element.updateComplete;
	let heard = 0;
	for (const type of ["input", "change", "toggle"]) {
		document.body.addEventListener(type, () => {
			heard += 1;
		});
	}

	button(element, "button.line").click();
	await element.updateComplete;
	button(element, "button.hide").click();
	await element.updateComplete;
	button(element, "button.row").click();

	expect(heard).toBe(0);
});
