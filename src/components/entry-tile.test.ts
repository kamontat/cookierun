/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-tile";

import type { EntryTile } from "./entry-tile";

const COOKIES = [
	["0A", "Adventurer Cookie", "../assets/cookies/ch38.png"],
	["0B", "Brave Cookie", "../assets/cookies/ch01.png"],
	["0C", "Cheerleader Cookie", null],
] as const;

async function mount(label = "Cookie"): Promise<EntryTile> {
	document.body.replaceChildren();
	const element = document.createElement("entry-tile") as EntryTile;
	element.setAttribute("label", label);
	document.body.append(element);
	element.options = COOKIES;
	await element.updateComplete;
	return element;
}

function entries(element: EntryTile): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button.entry",
		) ?? []),
	];
}

function search(element: EntryTile): HTMLInputElement | null {
	return element.shadowRoot?.querySelector("input") ?? null;
}

async function settle(element: EntryTile): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

test("the label names the control", async () => {
	const element = await mount("Relay");

	expect(element.shadowRoot?.querySelector(".label")?.textContent?.trim()).toBe(
		"Relay",
	);
});

// A closed control still has to say what it holds.
test("with nothing picked the tile says None", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector(".pick")?.textContent?.trim()).toBe(
		"None",
	);
});

test("the picked entry shows its name and its portrait on the tile", async () => {
	const element = await mount();

	element.value = "0A";
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector(".pick")?.textContent?.trim()).toBe(
		"Adventurer Cookie",
	);
	expect(
		element.shadowRoot?.querySelector(".pick img")?.getAttribute("src"),
	).toBe("../assets/cookies/ch38.png");
});

test("a picked entry with no art falls back to a lettered tile", async () => {
	const element = await mount();

	element.value = "0C";
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector(".pick img")).toBe(null);
	expect(
		element.shadowRoot?.querySelector(".pick .glyph")?.textContent?.trim(),
	).toBe("CC");
});

test("an entry is rendered per option, after the None row", async () => {
	const element = await mount();

	expect(entries(element).map((entry) => entry.value)).toEqual([
		"",
		"0A",
		"0B",
		"0C",
	]);
});

test("clicking an entry reads back as the value", async () => {
	const element = await mount();

	entries(element)[2]?.click();
	await settle(element);

	expect(element.value).toBe("0B");
});

test("clicking an entry dispatches exactly one input event from the host", async () => {
	const element = await mount();
	let seen = 0;
	element.addEventListener("input", (event) => {
		seen += 1;
		expect(event.target).toBe(element);
	});

	entries(element)[1]?.click();
	await settle(element);

	expect(seen).toBe(1);
});

test("the None row clears the pick", async () => {
	const element = await mount();

	element.value = "0A";
	await element.updateComplete;
	entries(element)[0]?.click();
	await settle(element);

	expect(element.value).toBeNull();
});

test("a value the options do not contain is refused", async () => {
	const element = await mount();

	element.value = "ZZ";
	await element.updateComplete;

	expect(element.value).toBeNull();
});

// Options and the pick are two separate writes, so a list replaced under a
// pick has to prune at render too, not only in the setter.
test("a pick the replaced options no longer contain is dropped", async () => {
	const element = await mount();

	element.value = "0A";
	element.options = [["0B", "Brave Cookie", null]];
	await element.updateComplete;

	expect(element.value).toBeNull();
});

test("typing in the search box narrows the list", async () => {
	const element = await mount();
	const box = search(element);
	if (box === null) throw new Error("no search box");

	box.value = "brave";
	box.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await element.updateComplete;

	expect(entries(element).map((entry) => entry.value)).toEqual(["", "0B"]);
});

// Filtering the list is not a change of this control's value, so that event
// must never reach the page.
test("the search box's own event does not escape the shadow root", async () => {
	const element = await mount();
	let escaped = 0;
	element.addEventListener("input", () => {
		escaped += 1;
	});

	search(element)?.dispatchEvent(
		new Event("input", { bubbles: true, composed: true }),
	);
	await element.updateComplete;

	expect(escaped).toBe(0);
});

test("the picked entry stays on the list even when the filter excludes it", async () => {
	const element = await mount();

	element.value = "0A";
	await element.updateComplete;
	const box = search(element);
	if (box === null) throw new Error("no search box");
	box.value = "brave";
	box.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await element.updateComplete;

	expect(entries(element).map((entry) => entry.value)).toContain("0A");
});

test("only the picked entry is tabbable", async () => {
	const element = await mount();

	element.value = "0B";
	await element.updateComplete;

	expect(entries(element).map((entry) => entry.tabIndex)).toEqual([
		-1, -1, 0, -1,
	]);
});

// The grid of faces wants more room than the closed tile occupies, and the
// page can only widen the control it can see is open.
test("the host says whether its list is open", async () => {
	const element = await mount();
	const details = element.shadowRoot?.querySelector("details");
	if (details == null) throw new Error("the control has no details");

	details.open = true;
	details.dispatchEvent(new Event("toggle"));
	await element.updateComplete;
	expect(element.hasAttribute("open")).toBe(true);

	details.open = false;
	details.dispatchEvent(new Event("toggle"));
	await element.updateComplete;
	expect(element.hasAttribute("open")).toBe(false);
});

test("an arrow walks to the next entry", async () => {
	const element = await mount();

	entries(element)[0]?.focus();
	entries(element)[0]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(entries(element)[1] ?? null);
});

// Clamped rather than wrapped: an arrow that jumps from the last entry to the
// first reads as a lost keypress.
test("an arrow on the last entry stays there", async () => {
	const element = await mount();

	entries(element)[3]?.focus();
	entries(element)[3]?.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(entries(element)[3] ?? null);
});

test("focus follows the picked entry into the next render", async () => {
	const element = await mount();

	entries(element)[2]?.click();
	await settle(element);

	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("0B");
});
