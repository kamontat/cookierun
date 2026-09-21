/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./check-group";

import type { CheckGroup } from "./check-group";

async function mount(id: string, legend: string): Promise<CheckGroup> {
	document.body.replaceChildren();
	const element = document.createElement("check-group") as CheckGroup;
	element.id = id;
	element.setAttribute("legend", legend);
	document.body.append(element);
	element.options = [
		["hp", "HP Extension"],
		["power", "Power Jelly Boost"],
		["fast", "Fast Start"],
	];
	await element.updateComplete;
	return element;
}

function inputs(element: CheckGroup): HTMLInputElement[] {
	return [...(element.shadowRoot?.querySelectorAll("input") ?? [])];
}

test("the legend names the group", async () => {
	const element = await mount("boosts", "Boosts");

	expect(element.shadowRoot?.querySelector("legend")?.textContent).toBe(
		"Boosts",
	);
});

test("a checkbox is rendered per option, in the order given", async () => {
	const element = await mount("boosts", "Boosts");

	expect(inputs(element).map((input) => input.value)).toEqual([
		"hp",
		"power",
		"fast",
	]);
});

// This is the wire format. Boosts occupy slots 4-6 and cookie powers are bit
// positions, so reading back in click order would reorder the code.
test("selected reads back in the option order, not the order ticked", async () => {
	const element = await mount("boosts", "Boosts");

	inputs(element)[2]?.click();
	await element.updateComplete;
	inputs(element)[0]?.click();
	await element.updateComplete;

	expect(element.selected).toEqual(["hp", "fast"]);
});

test("setting selected ticks exactly those boxes", async () => {
	const element = await mount("boosts", "Boosts");

	element.selected = ["power"];
	await element.updateComplete;
	expect(inputs(element).map((input) => input.checked)).toEqual([
		false,
		true,
		false,
	]);

	element.selected = [];
	await element.updateComplete;
	expect(inputs(element).map((input) => input.checked)).toEqual([
		false,
		false,
		false,
	]);
});

test("a value that is not an option is ignored rather than invented", async () => {
	const element = await mount("boosts", "Boosts");

	element.selected = ["hp", "nonsense"];
	await element.updateComplete;

	expect(element.selected).toEqual(["hp"]);
});

// `change` does not cross a shadow boundary, so the component has to say so
// itself or the page never hears that a box was ticked.
test("ticking a box bubbles an input event out of the element", async () => {
	const element = await mount("boosts", "Boosts");
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	inputs(element)[0]?.click();
	await element.updateComplete;

	expect(seen).toBe(1);
	expect(element.selected).toEqual(["hp"]);
});
