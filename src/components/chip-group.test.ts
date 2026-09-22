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

// Some of these rows have a "none" of their own sitting first — no random
// boost, no action — and clicking the chip you already picked is the obvious
// way to go back to it, rather than hunting for the None chip.
test("clicking the chosen chip on a resettable group goes back to the first option", async () => {
	const element = await mount();
	element.resettable = true;
	element.value = "exp";
	await element.updateComplete;

	chips(element)[2]?.click();
	await element.updateComplete;

	expect(element.value).toBe("score");
});

test("resetting dispatches exactly one input event from the host", async () => {
	const element = await mount();
	element.resettable = true;
	element.value = "exp";
	await element.updateComplete;
	let seen = 0;
	element.addEventListener("input", () => {
		seen += 1;
	});

	chips(element)[2]?.click();
	await element.updateComplete;

	expect(seen).toBe(1);
});

// Nothing changed, so nothing is announced: the first chip is already what a
// reset would land on.
test("clicking the first chip on a resettable group changes nothing and says nothing", async () => {
	const element = await mount();
	element.resettable = true;
	await element.updateComplete;
	let seen = 0;
	element.addEventListener("input", () => {
		seen += 1;
	});

	chips(element)[0]?.click();
	await element.updateComplete;

	expect(element.value).toBe("score");
	expect(seen).toBe(0);
});

// A type or an episode has no "none" to go back to, so the chip you picked
// stays picked however many times you click it.
test("clicking the chosen chip does nothing when the group is not resettable", async () => {
	const element = await mount();
	element.value = "exp";
	await element.updateComplete;
	let seen = 0;
	element.addEventListener("input", () => {
		seen += 1;
	});

	chips(element)[2]?.click();
	await element.updateComplete;

	expect(element.value).toBe("exp");
	expect(seen).toBe(0);
});

// The arrow walk is how you move along the row, and it clamps at the ends —
// so an arrow that lands on the chip already chosen must not reset it.
test("an arrow onto the chosen chip does not reset a resettable group", async () => {
	const element = await mount();
	element.resettable = true;
	element.value = "exp";
	await element.updateComplete;

	chips(element)[2]?.focus();
	chips(element)[2]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.value).toBe("exp");
});

test("the group carries the radiogroup role and its label", async () => {
	const element = await mount("Episode");

	const group = element.shadowRoot?.querySelector("[role='radiogroup']");
	expect(group?.getAttribute("aria-label")).toBe("Episode");
	expect(chips(element)[0]?.getAttribute("role")).toBe("radio");
});

// A row with art and a row without are the same element: the third field is
// optional, and a chip given nothing for it is the bare chip it always was.
test("a chip draws the thumbnail its option carries, and none otherwise", async () => {
	const element = await mount("Episode");
	element.options = [
		["any", "Any"],
		["episode1", "Episode 1", "../assets/episodes/ep1.png"],
		["episode2", "Episode 2", null],
	];
	await element.updateComplete;

	const thumbnails = chips(element).map(
		(chip) => chip.querySelector("img.thumb")?.getAttribute("src") ?? null,
	);

	expect(thumbnails).toEqual([null, "../assets/episodes/ep1.png", null]);
	// The label is still the chip's text whether or not a picture sits beside it.
	expect(chips(element).map((chip) => chip.textContent?.trim())).toEqual([
		"Any",
		"Episode 1",
		"Episode 2",
	]);
});

// Decoration, not content: the name beside it already says which episode this
// is, so a screen reader reading the picture too would say it twice.
test("a chip thumbnail is empty-alt and lazy", async () => {
	const element = await mount("Episode");
	element.options = [["episode1", "Episode 1", "../assets/episodes/ep1.png"]];
	await element.updateComplete;

	const image = chips(element)[0]?.querySelector("img.thumb");
	expect(image?.getAttribute("alt")).toBe("");
	expect(image?.getAttribute("loading")).toBe("lazy");
});
