/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./labelled-select";

import type { LabelledSelect } from "./labelled-select";

async function mount(id: string, label: string): Promise<LabelledSelect> {
	document.body.replaceChildren();
	const element = document.createElement("labelled-select") as LabelledSelect;
	element.id = id;
	element.setAttribute("label", label);
	document.body.append(element);
	await element.updateComplete;
	return element;
}

// Nesting the select inside the label would collapse the gap Pico's own label
// margin puts between them, so the association is an explicit for/id pair.
test("the label points at the select and names it", async () => {
	const element = await mount("type", "Type");
	const select = element.shadowRoot?.querySelector("select");
	const label = element.shadowRoot?.querySelector("label");

	expect(select?.id).not.toBe("");
	expect(label?.htmlFor).toBe(select?.id);
	expect(label?.textContent).toBe("Type");
});

test("two elements on one page do not share a select id", async () => {
	document.body.replaceChildren();
	const first = document.createElement("labelled-select") as LabelledSelect;
	const second = document.createElement("labelled-select") as LabelledSelect;
	document.body.append(first, second);
	await first.updateComplete;
	await second.updateComplete;

	const ids = [first, second].map(
		(element) => element.shadowRoot?.querySelector("select")?.id,
	);
	expect(new Set(ids).size).toBe(2);
});

test("options render in the order they are given", async () => {
	const element = await mount("type", "Type");
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	await element.updateComplete;
	const select = element.shadowRoot?.querySelector("select");

	expect([...(select?.options ?? [])].map((option) => option.value)).toEqual([
		"a",
		"b",
	]);
	expect(
		[...(select?.options ?? [])].map((option) => option.textContent),
	).toEqual(["Alpha", "Beta"]);
});

test("value reads and writes through to the select", async () => {
	const element = await mount("type", "Type");
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	await element.updateComplete;

	element.value = "b";
	await element.updateComplete;
	expect(element.shadowRoot?.querySelector("select")?.value).toBe("b");
	expect(element.value).toBe("b");
});

// The page listens for `input` on the enclosing form, so the event has to
// leave the component.
test("choosing an option bubbles an input event out of the element", async () => {
	const element = await mount("type", "Type");
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	await element.updateComplete;

	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	const select = element.shadowRoot?.querySelector("select");
	if (select == null) throw new Error("no select");
	select.value = "b";
	select.dispatchEvent(new Event("change"));

	expect(seen).toBe(1);
});

// Mirrors what a native, untouched <select> does: with options but no
// explicit selection, its value is the first option's, not empty. The route
// leans on exactly this at import time - it reads `.value` synchronously, to
// seed its default code, before this element (or any Lit element) has ever
// completed a render.
test("a value nobody set reads as the first option, even before the first render", () => {
	document.body.replaceChildren();
	const element = document.createElement("labelled-select") as LabelledSelect;
	element.id = "type";
	element.setAttribute("label", "Type");
	document.body.append(element);

	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];

	expect(element.value).toBe("a");
});

// Lit commits the select's own property/attribute bindings before it renders
// the <option> children that come from the same template, so a naive
// `.value=${...}` binding on the <select> can be assigned while the select
// still has no options - and the browser then auto-selects whichever option
// happens to land first, silently dropping the intended value. Both orders
// below are exercised because the route hits one of them on every load.

// This is what the route does: every control's `options` list is assigned at
// module scope, and only afterwards - still before the element has ever
// rendered - does a loaded code assign `value`.
test("options set first, then value, before the element has ever rendered", async () => {
	document.body.replaceChildren();
	const element = document.createElement("labelled-select") as LabelledSelect;
	element.id = "type";
	element.setAttribute("label", "Type");
	document.body.append(element);

	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	element.value = "b";

	await element.updateComplete;

	expect(element.value).toBe("b");
	expect(element.shadowRoot?.querySelector("select")?.value).toBe("b");
});

// The reverse order: nothing guarantees a caller sets options before value, so
// this has to land too.
test("value set before options, before the element has ever rendered", async () => {
	document.body.replaceChildren();
	const element = document.createElement("labelled-select") as LabelledSelect;
	element.id = "type";
	element.setAttribute("label", "Type");
	document.body.append(element);

	element.value = "b";
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];

	await element.updateComplete;

	expect(element.value).toBe("b");
	expect(element.shadowRoot?.querySelector("select")?.value).toBe("b");
});
