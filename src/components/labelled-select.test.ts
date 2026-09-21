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
// leave the component. A real pick fires *two* native events, `input` then
// `change` - and unlike `change`, `input` is `composed: true`, so it already
// escapes the shadow root unaided. A handler that only listens for `change`
// lets that first, composed `input` leak out with yesterday's state before
// its own handler ever runs, then adds a second, correct one behind it.
test("choosing an option bubbles exactly one input event, carrying the new value", async () => {
	const element = await mount("type", "Type");
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	await element.updateComplete;

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
	const heard: { value: string | null } = { value: null };
	const onInput = () => {
		seen += 1;
		heard.value = element.value;
	};
	document.body.addEventListener("input", onInput);

	try {
		const select = element.shadowRoot?.querySelector("select");
		if (select == null) throw new Error("no select");
		select.value = "b";
		select.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		select.dispatchEvent(new Event("change", { bubbles: true }));

		expect(seen).toBe(1);
		if (heard.value === null) throw new Error("the input listener never fired");
		expect(heard.value).toBe("b");
	} finally {
		// document.body outlives this test - replaceChildren() in the next
		// mount() clears its children, not its listeners, so an un-removed one
		// would still fire (against this test's now-stale `element`) on every
		// later test's own dispatched events.
		document.body.removeEventListener("input", onInput);
	}
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

// Per the HTML spec's "pick an option" algorithm, a real user pick marks the
// picked option dirty; once dirty, adding or removing its `selected` content
// attribute no longer moves it. The route hits this on every Load and every
// Reset: `writeForm` assigns `.value` straight from a decoded code, and
// nothing stops that value from being an option the user already picked once
// before.
test("assigning value after real picks still moves the rendered select back", async () => {
	document.body.replaceChildren();
	const element = document.createElement("labelled-select") as LabelledSelect;
	element.id = "type";
	element.setAttribute("label", "Type");
	document.body.append(element);
	element.options = [
		["a", "Alpha"],
		["b", "Beta"],
	];
	await element.updateComplete;

	const select = element.shadowRoot?.querySelector("select");
	if (select == null) throw new Error("no select");

	function pick(target: HTMLSelectElement, value: string): void {
		target.value = value;
		target.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		target.dispatchEvent(new Event("change", { bubbles: true }));
	}

	// Dirty both options: pick "a" (already showing, but the pick itself is
	// what dirties it), then pick "b".
	pick(select, "a");
	await element.updateComplete;
	pick(select, "b");
	await element.updateComplete;
	expect(select.value).toBe("b");

	// A Load/Reset-style programmatic write, back to an option already picked
	// once above.
	element.value = "a";
	await element.updateComplete;

	expect(element.value).toBe("a");
	expect(select.value).toBe("a");
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
