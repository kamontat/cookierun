/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./chip-group";

import type { ChipGroup } from "./chip-group";

async function mount(label = "Type"): Promise<ChipGroup> {
	document.body.replaceChildren();
	const element = document.createElement("chip-group") as ChipGroup;
	element.setAttribute("label", label);
	document.body.append(element);
	element.options = [
		["score", "Score"],
		["money", "Money"],
		["exp", "Exp"],
	];
	await element.updateComplete;
	return element;
}

function chips(element: ChipGroup): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button.chip",
		) ?? []),
	];
}

/**
 * A handler that restores focus awaits its own `updateComplete` first, so a
 * test watching where focus lands has to settle twice: once for its own await,
 * which resumes after the handler's, and again to observe the result.
 */
async function settle(element: ChipGroup): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

test("the label names the group", async () => {
	const element = await mount("Type");

	expect(element.shadowRoot?.querySelector(".label")?.textContent).toBe("Type");
});

test("a chip is rendered per option, in the order given", async () => {
	const element = await mount();

	expect(chips(element).map((chip) => chip.value)).toEqual([
		"score",
		"money",
		"exp",
	]);
});

// The same fallback a native, untouched <select> reads as, which is what the
// control this replaces did: the route sets options and value separately.
test("value falls back to the first option when nothing is chosen", async () => {
	const element = await mount();

	expect(element.value).toBe("score");
});

test("value falls back to the first option when the chosen value is not on the list", async () => {
	const element = await mount();

	element.value = "nowhere";
	await element.updateComplete;

	expect(element.value).toBe("score");
});

test("setting value checks exactly that chip", async () => {
	const element = await mount();

	element.value = "exp";
	await element.updateComplete;

	expect(
		chips(element).map((chip) => chip.getAttribute("aria-checked")),
	).toEqual(["false", "false", "true"]);
});

test("clicking a chip reads back as the value", async () => {
	const element = await mount();

	chips(element)[1]?.click();
	await element.updateComplete;

	expect(element.value).toBe("money");
});

test("clicking a chip dispatches exactly one input event from the host", async () => {
	const element = await mount();
	let seen = 0;
	element.addEventListener("input", (event) => {
		seen += 1;
		expect(event.target).toBe(element);
	});

	chips(element)[1]?.click();
	await element.updateComplete;

	expect(seen).toBe(1);
});

// One tab stop for the whole group, the same rule the entry lists follow.
test("only the checked chip is tabbable", async () => {
	const element = await mount();

	element.value = "money";
	await element.updateComplete;

	expect(chips(element).map((chip) => chip.tabIndex)).toEqual([-1, 0, -1]);
});

test("a right arrow moves to the next chip and chooses it", async () => {
	const element = await mount();

	chips(element)[0]?.focus();
	chips(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.value).toBe("money");
	expect(element.shadowRoot?.activeElement).toBe(chips(element)[1] ?? null);
});

// Clamped rather than wrapped: an arrow that jumps from the last chip to the
// first reads as a lost keypress.
test("a right arrow on the last chip stays there", async () => {
	const element = await mount();

	element.value = "exp";
	await element.updateComplete;
	chips(element)[2]?.focus();
	chips(element)[2]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await element.updateComplete;

	expect(element.value).toBe("exp");
});

test("Home chooses the first chip and End the last", async () => {
	const element = await mount();

	chips(element)[0]?.focus();
	chips(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "End", bubbles: true }),
	);
	await element.updateComplete;
	expect(element.value).toBe("exp");

	chips(element)[2]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Home", bubbles: true }),
	);
	await element.updateComplete;
	expect(element.value).toBe("score");
});

test("the group carries the radiogroup role and its label", async () => {
	const element = await mount("Episode");

	const group = element.shadowRoot?.querySelector("[role='radiogroup']");
	expect(group?.getAttribute("aria-label")).toBe("Episode");
	expect(chips(element)[0]?.getAttribute("role")).toBe("radio");
});
