/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-set";

import type { EntrySet } from "./entry-set";

/**
 * A click handler that restores focus awaits its own `updateComplete` before
 * doing so, so one await here can land before the handler's. Two settles the
 * element and everything it queued.
 */
async function settle(element: EntrySet): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

async function mount(): Promise<EntrySet> {
	document.body.replaceChildren();
	const element = document.createElement("entry-set") as EntrySet;
	element.setAttribute("legend", "Treasure slot 1");
	document.body.append(element);
	element.options = [
		["000", "Acorn", "treasures/tr_ga034.png"],
		["001", "Mushroom", null],
		["002", "Slate", null],
	];
	await element.updateComplete;
	return element;
}

function addRows(element: EntrySet): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".entry") ??
			[]),
	];
}

function chips(element: EntrySet): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(".chip") ?? []),
	];
}

test("the summary names the slot and what is in it", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector("summary")?.textContent).toContain(
		"Treasure slot 1",
	);
	expect(element.shadowRoot?.querySelector("summary")?.textContent).toContain(
		"None",
	);

	element.selected = ["000", "002"];
	await settle(element);

	expect(element.shadowRoot?.querySelector("summary")?.textContent).toContain(
		"Acorn or Slate",
	);
});

// Three of these open at once is a wall of scrolling lists; closed, a slot
// reads as one line.
test("the list starts closed", async () => {
	const element = await mount();
	expect(element.shadowRoot?.querySelector("details")?.open).toBe(false);
});

test("the list is named for the slot it fills", async () => {
	const element = await mount();
	expect(
		element.shadowRoot?.querySelector(".entries")?.getAttribute("aria-label"),
	).toBe("Treasure slot 1");
});

test("nothing is picked to begin with", async () => {
	const element = await mount();
	expect(element.selected).toEqual([]);
	expect(chips(element)).toHaveLength(0);
});

test("clicking a row adds it as a chip and bubbles an input event", async () => {
	const element = await mount();
	let seen = 0;
	const onInput = () => {
		seen += 1;
	};
	document.body.addEventListener("input", onInput);

	try {
		addRows(element)[1]?.click();
		await settle(element);

		expect(element.selected).toEqual(["001"]);
		expect(chips(element).map((chip) => chip.value)).toEqual(["001"]);
		expect(seen).toBe(1);
	} finally {
		document.body.removeEventListener("input", onInput);
	}
});

test("clicking a chip removes it and bubbles an input event", async () => {
	const element = await mount();
	element.selected = ["000", "002"];
	await settle(element);

	let seen = 0;
	const onInput = () => {
		seen += 1;
	};
	document.body.addEventListener("input", onInput);

	try {
		chips(element)[0]?.click();
		await settle(element);

		expect(element.selected).toEqual(["002"]);
		expect(seen).toBe(1);
	} finally {
		document.body.removeEventListener("input", onInput);
	}
});

// This is the wire format: alternatives are written in id order, so reading
// back in click order would produce a different code for the same slot.
test("selected reads back in option order, not the order clicked", async () => {
	const element = await mount();

	addRows(element)[2]?.click();
	await settle(element);
	addRows(element)[0]?.click();
	await settle(element);

	expect(element.selected).toEqual(["000", "002"]);
});

test("adding the same entry twice is a no-op", async () => {
	const element = await mount();

	addRows(element)[0]?.click();
	await settle(element);
	addRows(element)[0]?.click();
	await settle(element);

	expect(element.selected).toEqual(["000"]);
});

test("a value that is not an option is ignored rather than invented", async () => {
	const element = await mount();

	element.selected = ["000", "nonsense"];
	await settle(element);

	expect(element.selected).toEqual(["000"]);
});

// aria-selected is only valid on option/tab/row/gridcell/treeitem roles; a
// plain button ignores it, so assistive technology needs both roles present.
// aria-multiselectable also has to be on the listbox, since this one accepts
// several picks.
test("the list and its rows carry the roles that make aria-selected valid", async () => {
	const element = await mount();
	const list = element.shadowRoot?.querySelector(".entries");

	expect(list?.getAttribute("role")).toBe("listbox");
	expect(list?.getAttribute("aria-multiselectable")).toBe("true");
	for (const row of addRows(element)) {
		expect(row.getAttribute("role")).toBe("option");
	}
});

// Re-render replaces the button the click landed on, so something has to put
// focus back or it drops to the shadow root's owner document.
test("adding an entry keeps focus on the row that was added", async () => {
	const element = await mount();

	addRows(element)[1]?.click();
	await settle(element);

	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("001");
});

// 50 rows in each of three slots is 150 tab stops in the loadout alone. A
// listbox is one stop, and arrows move inside it.
test("the list is a single tab stop, on the first picked row", async () => {
	const element = await mount();
	element.selected = ["002"];
	await settle(element);

	expect(addRows(element).map((row) => row.tabIndex)).toEqual([-1, -1, 0]);
});

test("with nothing picked the first row is the one tab stop", async () => {
	const element = await mount();
	expect(addRows(element).map((row) => row.tabIndex)).toEqual([0, -1, -1]);
});

function press(element: EntrySet, key: string): void {
	element.shadowRoot
		?.querySelector(".entries")
		?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

test("the arrow keys walk the rows and End jumps to the last", async () => {
	const element = await mount();
	addRows(element)[0]?.focus();

	press(element, "ArrowDown");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("001");

	press(element, "End");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("002");

	press(element, "ArrowDown");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("002");
});

test("clicking a chip to remove it also returns focus to the search input", async () => {
	const element = await mount();
	element.selected = ["000", "002"];
	await settle(element);
	const search =
		element.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
	if (search === undefined || search === null)
		throw new Error("no search input");

	chips(element)[0]?.click();
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(search);
});

test("an already-picked row is marked so", async () => {
	const element = await mount();
	element.selected = ["001"];
	await settle(element);

	expect(
		addRows(element).map((row) => row.getAttribute("aria-selected")),
	).toEqual(["false", "true", "false"]);
});

test("typing filters the rows", async () => {
	const element = await mount();
	const search =
		element.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
	if (search === undefined || search === null)
		throw new Error("no search input");

	search.value = "sla";
	search.dispatchEvent(new Event("input", { bubbles: true }));
	await settle(element);

	expect(addRows(element).map((row) => row.value)).toEqual(["002"]);
});

// The search box's native `input` event is `bubbles: true, composed: true` -
// it escapes the shadow root unaided. Filtering is not a change of the
// slot's value, and must never be read as one by a page-level listener.
test("typing in the search box does not bubble an input event", async () => {
	const element = await mount();
	const search =
		element.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
	if (search === undefined || search === null)
		throw new Error("no search input");

	let seen = 0;
	const onInput = () => {
		seen += 1;
	};
	document.body.addEventListener("input", onInput);

	try {
		search.value = "sla";
		search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		await settle(element);

		expect(seen).toBe(0);
	} finally {
		document.body.removeEventListener("input", onInput);
	}
});

test("only the first rows are rendered, with a count of what is hidden", async () => {
	const element = await mount();
	element.options = Array.from(
		{ length: 120 },
		(_, n) => [String(n).padStart(3, "0"), `Treasure ${n}`, null] as const,
	);
	await settle(element);

	expect(addRows(element)).toHaveLength(50);
	expect(element.shadowRoot?.querySelector(".more")?.textContent).toBe(
		"Showing 50 of 120. Type to narrow the list.",
	);
});
