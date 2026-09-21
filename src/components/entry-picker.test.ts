/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-picker";

import type { EntryPicker } from "./entry-picker";

/**
 * A click handler that restores focus awaits its own `updateComplete` before
 * doing so, so one await here can land before the handler's. Two settles the
 * element and everything it queued.
 */
async function settle(element: EntryPicker): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

async function mount(): Promise<EntryPicker> {
	document.body.replaceChildren();
	const element = document.createElement("entry-picker") as EntryPicker;
	element.setAttribute("label", "Cookie");
	document.body.append(element);
	element.options = [
		["00", "GingerBrave", "cookies/ch01.png"],
		["01", "Strawberry Cookie", "cookies/ch02.png"],
		["02", "Wizard Cookie", null],
	];
	await element.updateComplete;
	return element;
}

function rows(element: EntryPicker): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"button[value]",
		) ?? []),
	];
}

test("the summary names the control and what is picked", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector("summary")?.textContent).toContain(
		"Cookie",
	);
	expect(element.shadowRoot?.querySelector("summary")?.textContent).toContain(
		"None",
	);

	element.value = "01";
	await settle(element);

	expect(element.shadowRoot?.querySelector("summary")?.textContent).toContain(
		"Strawberry Cookie",
	);
});

// Six of these open at once is a wall of scrolling lists; closed, the loadout
// reads as six lines.
test("the list starts closed", async () => {
	const element = await mount();
	expect(element.shadowRoot?.querySelector("details")?.open).toBe(false);
});

test("the search input is named even though the label is now a summary", async () => {
	const element = await mount();
	const search = element.shadowRoot?.querySelector("input[type=search]");

	expect(search?.getAttribute("aria-label")).toBe("Filter Cookie");
});

test("one row per option plus a None row, in the order given", async () => {
	const element = await mount();
	expect(rows(element).map((row) => row.value)).toEqual(["", "00", "01", "02"]);
});

test("an option with an icon renders an image, one without does not", async () => {
	const element = await mount();
	const images = [...(element.shadowRoot?.querySelectorAll("img") ?? [])];

	expect(images).toHaveLength(2);
	expect(images[0]?.getAttribute("src")).toBe("cookies/ch01.png");
	expect(images[0]?.getAttribute("loading")).toBe("lazy");
});

test("clicking a row sets the value and bubbles an input event", async () => {
	const element = await mount();
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	rows(element)[2]?.click();
	await settle(element);

	expect(element.value).toBe("01");
	expect(seen).toBe(1);
});

test("clicking the None row clears the value", async () => {
	const element = await mount();
	element.value = "01";
	await settle(element);

	rows(element)[0]?.click();
	await settle(element);

	expect(element.value).toBeNull();
});

// aria-selected is only valid on option/tab/row/gridcell/treeitem roles; a
// plain button ignores it, so assistive technology needs both roles present.
test("the list and its rows carry the roles that make aria-selected valid", async () => {
	const element = await mount();

	expect(
		element.shadowRoot?.querySelector(".entries")?.getAttribute("role"),
	).toBe("listbox");
	for (const row of rows(element)) {
		expect(row.getAttribute("role")).toBe("option");
	}
});

// A pick re-renders, and Lit may or may not reuse the row node the click
// landed on; either way something has to put focus back or it drops to the
// shadow root's owner document.
test("picking keeps focus on the row that was picked", async () => {
	const element = await mount();

	rows(element)[2]?.click();
	await settle(element);

	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("01");
});

test("clearing the pick keeps focus on the None row", async () => {
	const element = await mount();
	element.value = "01";
	await settle(element);

	rows(element)[0]?.click();
	await settle(element);

	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("");
	expect(element.value).toBeNull();
});

// `#pick` sets `picked` and dispatches its `input` event synchronously,
// *then* awaits its own render before moving focus - so a caller can react
// to that dispatch (still inside the same synchronous turn, before
// `.click()` even returns) by pulling the picked value out of `options`
// altogether. The selected-row pin in `#matches` only saves a value that
// still exists in `options`; once it does not, `willUpdate` drops the pick
// before render, so the clicked row never comes back at all. That is the one
// case with nothing to return focus to, and the search input - the one
// element every render leaves in place - takes it instead.
test("picking a row whose option disappears before the render lands moves focus to the search input", async () => {
	const element = await mount();
	const search =
		element.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
	if (search === undefined || search === null)
		throw new Error("no search input");

	rows(element)[2]?.click();
	// Still inside the synchronous gap `#pick` leaves open before its `await`:
	// `picked` is already "01", but Lit has not rendered it yet.
	element.options = element.options.filter(([value]) => value !== "01");
	await settle(element);

	expect(element.value).toBeNull();
	expect(rows(element).map((row) => row.value)).not.toContain("01");
	expect(element.shadowRoot?.activeElement).toBe(search);
});

// 50 rows in each of six pickers is 300 tab stops between the loadout and the
// rest of the page. A listbox is one stop, and arrows move inside it.
test("the list is a single tab stop, on the selected row", async () => {
	const element = await mount();
	element.value = "01";
	await settle(element);

	expect(rows(element).map((row) => row.tabIndex)).toEqual([-1, -1, 0, -1]);
});

test("with nothing picked the first row is the one tab stop", async () => {
	const element = await mount();
	expect(rows(element).map((row) => row.tabIndex)).toEqual([0, -1, -1, -1]);
});

function press(element: EntryPicker, key: string): void {
	element.shadowRoot
		?.querySelector(".entries")
		?.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

test("the arrow keys walk the rows and Home and End jump to the ends", async () => {
	const element = await mount();
	rows(element)[0]?.focus();

	press(element, "ArrowDown");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("00");

	press(element, "ArrowUp");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("");

	press(element, "End");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("02");

	press(element, "Home");
	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("");
});

test("the arrows stop at the ends rather than wrapping around", async () => {
	const element = await mount();
	rows(element)[0]?.focus();

	press(element, "ArrowUp");

	expect(
		(element.shadowRoot?.activeElement as HTMLButtonElement | null)?.value,
	).toBe("");
});

test("setting the value marks that row as the selected one", async () => {
	const element = await mount();
	element.value = "02";
	await settle(element);

	expect(rows(element).map((row) => row.getAttribute("aria-selected"))).toEqual(
		["false", "false", "false", "true"],
	);
});

test("setting a value that is not an option is ignored rather than invented", async () => {
	const element = await mount();
	element.value = "nonsense";
	await settle(element);

	expect(element.value).toBeNull();
});

test("typing filters the rows to matching labels, case-insensitively", async () => {
	const element = await mount();
	const search =
		element.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
	if (search === undefined || search === null)
		throw new Error("no search input");

	search.value = "wiz";
	search.dispatchEvent(new Event("input", { bubbles: true }));
	await settle(element);

	expect(rows(element).map((row) => row.value)).toEqual(["", "02"]);
});

test("the selected row stays visible even when the filter excludes it", async () => {
	const element = await mount();
	element.value = "00";
	await settle(element);
	const search =
		element.shadowRoot?.querySelector<HTMLInputElement>("input[type=search]");
	if (search === undefined || search === null)
		throw new Error("no search input");

	search.value = "wiz";
	search.dispatchEvent(new Event("input", { bubbles: true }));
	await settle(element);

	expect(rows(element).map((row) => row.value)).toContain("00");
});

// 1,144 treasures cannot all be in the DOM of three pickers at once.
test("only the first rows are rendered, with a count of what is hidden", async () => {
	const element = await mount();
	element.options = Array.from(
		{ length: 120 },
		(_, n) => [String(n).padStart(3, "0"), `Treasure ${n}`, null] as const,
	);
	await settle(element);

	expect(rows(element)).toHaveLength(51);
	expect(element.shadowRoot?.querySelector(".more")?.textContent).toBe(
		"Showing 50 of 120. Type to narrow the list.",
	);
});

// The search box's native `input` event is `bubbles: true, composed: true` -
// it escapes the shadow root unaided. Filtering is not a change of the
// control's value, and must never be read as one by a page-level listener.
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
		search.value = "wiz";
		search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
		await settle(element);

		expect(seen).toBe(0);
	} finally {
		document.body.removeEventListener("input", onInput);
	}
});

// A picked row, by contrast, deliberately dispatches its own `input` from the
// host - this is the one case where the control's value really did change.
test("picking a row bubbles an input event carrying the new value", async () => {
	const element = await mount();

	let seen = 0;
	const heard: { value: string | null } = { value: "unset" };
	const onInput = () => {
		seen += 1;
		heard.value = element.value;
	};
	document.body.addEventListener("input", onInput);

	try {
		rows(element)[2]?.click();
		await settle(element);

		expect(seen).toBe(1);
		expect(heard.value).toBe("01");
	} finally {
		document.body.removeEventListener("input", onInput);
	}
});
