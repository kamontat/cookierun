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

// `options` and `selected` are two separate writes, so the setter alone cannot
// see a list that is replaced underneath a tick. Dropping the tick has to
// happen at render time, which is where `<entry-picker>` and `<entry-set>` do
// it too - and it has to be a drop rather than a hide, or the value comes back
// ticked the moment a later list contains it again.
test("replacing the options drops a tick the new list does not contain", async () => {
	const element = await mount("boosts", "Boosts");
	element.selected = ["hp", "fast"];
	await element.updateComplete;

	element.options = [
		["power", "Power Jelly Boost"],
		["fast", "Fast Start"],
	];
	await element.updateComplete;

	expect(element.selected).toEqual(["fast"]);
	expect(inputs(element).map((input) => input.checked)).toEqual([false, true]);

	element.options = [
		["hp", "HP Extension"],
		["power", "Power Jelly Boost"],
		["fast", "Fast Start"],
	];
	await element.updateComplete;

	expect(element.selected).toEqual(["fast"]);
	expect(inputs(element).map((input) => input.checked)).toEqual([
		false,
		false,
		true,
	]);
});

// `change` does not cross a shadow boundary, so the component has to say so
// itself or the page never hears that a box was ticked. A real tick fires
// *two* native events, `input` then `change` - and unlike `change`, `input`
// is `composed: true`, so it already escapes the shadow root unaided. A
// handler that only listens for `change` lets that first, composed `input`
// leak out with yesterday's state before its own handler ever runs, then
// adds a second, correct one behind it.
test("ticking a box bubbles exactly one input event, carrying the new selection", async () => {
	const element = await mount("boosts", "Boosts");
	const input = inputs(element)[0];
	if (input == null) throw new Error("no checkbox");

	// Asserting from *inside* the listener would not fail this test: happy-dom's
	// default `errorCapture: "tryAndCatch"` catches whatever a listener throws
	// and routes it to the window's own error reporting rather than back to
	// `dispatchEvent`'s caller. So the listener only records what it saw, into
	// a box rather than a bare closured `let` - TypeScript's control-flow
	// narrowing does not follow a `let` that is assigned only inside a
	// closure, so a later direct read of it does not typecheck the way this
	// property read does - and the assertion happens here at test scope,
	// after `dispatchEvent` returns.
	let seen = 0;
	const heard: { value: string[] | null } = { value: null };
	const onInput = () => {
		seen += 1;
		heard.value = element.selected;
	};
	document.body.addEventListener("input", onInput);

	try {
		input.checked = true;
		input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		input.dispatchEvent(new Event("change", { bubbles: true }));

		expect(seen).toBe(1);
		if (heard.value === null) throw new Error("the input listener never fired");
		expect(heard.value).toEqual(["hp"]);
		expect(element.selected).toEqual(["hp"]);
	} finally {
		// document.body outlives this test - replaceChildren() in the next
		// mount() clears its children, not its listeners, so an un-removed one
		// would still fire (against this test's now-stale `element`) on every
		// later test's own dispatched events.
		document.body.removeEventListener("input", onInput);
	}
});
