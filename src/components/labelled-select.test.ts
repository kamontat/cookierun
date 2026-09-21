/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./labelled-select.ts";

import type { LabelledSelect } from "./labelled-select.ts";

function mount(id: string, label: string): LabelledSelect {
	document.body.replaceChildren();
	const element = document.createElement("labelled-select");
	element.id = id;
	element.setAttribute("label", label);
	document.body.append(element);
	return element;
}

// Nesting the select inside the label would collapse the gap Pico's own label
// margin puts between them, so the association is an explicit for/id pair.
test("the label points at the select and names it", () => {
	const element = mount("type", "Type");
	const select = element.querySelector("select")!;
	const label = element.querySelector("label")!;

	expect(select.id).not.toBe("");
	expect(label.htmlFor).toBe(select.id);
	expect(label.textContent).toBe("Type");
});

test("two elements on one page do not share a select id", () => {
	document.body.replaceChildren();
	const first = document.createElement("labelled-select");
	const second = document.createElement("labelled-select");
	document.body.append(first, second);

	const ids = [...document.body.querySelectorAll("select")].map((s) => s.id);
	expect(new Set(ids).size).toBe(2);
});

test("options render in the order they are given", () => {
	const element = mount("type", "Type");
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	const select = element.querySelector("select")!;

	expect([...select.options].map((option) => option.value)).toEqual(["a", "b"]);
	expect([...select.options].map((option) => option.textContent)).toEqual([
		"Alpha",
		"Beta",
	]);
});

test("value reads and writes through to the select", () => {
	const element = mount("type", "Type");
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];

	element.value = "b";
	expect(element.querySelector("select")!.value).toBe("b");
	expect(element.value).toBe("b");
});

// The page listens for `input` on the enclosing form, so the event has to
// leave the component.
test("an input event from the select bubbles out of the element", () => {
	const element = mount("type", "Type");
	element.options = [["a", "Alpha"]];

	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});
	element
		.querySelector("select")!
		.dispatchEvent(new Event("input", { bubbles: true }));

	expect(seen).toBe(1);
});
