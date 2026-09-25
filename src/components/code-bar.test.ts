/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./code-bar";

import type { CharHint, CodeBar } from "./code-bar";

const CODE = "1S00000000";

const HINTS: CharHint[] = [
	{ char: "1", hint: "Slot 1 · Format version", group: "version" },
	{ char: "S", hint: "Slot 2 · Type · Score", group: "type" },
	{ char: "0", hint: "Slot 3 · Episode · Any", group: "episode" },
	{ char: "0", hint: "Slot 4 · Boosts · None", group: "boosts" },
	{ char: "0", hint: "Slot 5 · Random boost · None", group: "randomBoost" },
	{
		char: "0",
		hint: "Slots 6-7 · Cookie power+ · None",
		group: "cookiePowers",
	},
	{
		char: "0",
		hint: "Slots 6-7 · Cookie power+ · None",
		group: "cookiePowers",
	},
	{ char: "0", hint: "Slot 8 · Action · No action", group: "action" },
	{ char: "0", hint: "Slots 9-10 · Reserved", group: "reserved" },
	{ char: "0", hint: "Slots 9-10 · Reserved", group: "reserved" },
];

async function mount(value = CODE): Promise<CodeBar> {
	document.body.replaceChildren();
	const element = document.createElement("code-bar") as CodeBar;
	element.setAttribute("value", value);
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function runs(element: CodeBar): HTMLButtonElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
			"code button",
		) ?? []),
	];
}

function field(element: CodeBar): HTMLInputElement | null {
	return element.shadowRoot?.querySelector("input") ?? null;
}

function press(node: Element, key: string): void {
	node.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
}

async function settle(element: CodeBar): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

function stubClipboard(writeText: () => Promise<void>): void {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
}

test("the value shows as code", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector("code")?.textContent?.trim()).toBe(
		CODE,
	);
});

test("characters sharing a group are drawn as one run", async () => {
	const element = await mount();

	element.hints = HINTS;
	await element.updateComplete;

	expect(runs(element).map((run) => run.textContent?.trim())).toEqual([
		"1",
		"S",
		"0",
		"0",
		"0",
		"00",
		"0",
		"00",
	]);
});

// The loadout run is one unbreakable word by design — word-wise selection is
// the point — so a break opportunity is the only other way to keep a long run
// from widening the page. It must add nothing a copy or a text-content check
// would see.
test("a run gets a break opportunity after each underscore and dot, without changing its text", async () => {
	const value = "AB_CD.EF";
	const element = await mount(value);
	element.hints = [...value].map((char) => ({
		char,
		hint: "Loadout",
		group: "loadout",
	}));
	await element.updateComplete;

	const run = runs(element)[0];
	expect(run?.textContent).toBe(value);
	expect(run?.querySelectorAll("wbr")).toHaveLength(2);
	expect(run?.innerHTML).toContain("_<wbr>");
	expect(run?.innerHTML).toContain(".<wbr>");
});

test("a run carries its hint as a tooltip", async () => {
	const element = await mount();

	element.hints = HINTS;
	await element.updateComplete;

	expect(runs(element)[1]?.getAttribute("data-tooltip")).toBe(
		"Slot 2 · Type · Score",
	);
});

// A hint list that does not line up labels the wrong characters, which is
// worse than labelling none of them.
test("a hint list of the wrong length is dropped whole", async () => {
	const element = await mount();

	element.hints = HINTS.slice(0, 3);
	await element.updateComplete;

	expect(runs(element)).toHaveLength(0);
});

test("a new value drops hints that described the old one", async () => {
	const element = await mount();

	element.hints = HINTS;
	await element.updateComplete;
	element.value = "1H04000000";
	await element.updateComplete;

	expect(runs(element)).toHaveLength(0);
});

test("clicking a run asks the page to jump to the control that owns it", async () => {
	const element = await mount();
	element.hints = HINTS;
	await element.updateComplete;
	let jumped = "";
	element.addEventListener("slot-jump", (event) => {
		jumped = (event as CustomEvent<string>).detail;
	});

	runs(element)[2]?.click();

	expect(jumped).toBe("episode");
});

// The hover bubble is behind a hover query, so on a phone this line is the only
// place the run's meaning is said at all.
test("clicking a run names it under the code", async () => {
	const element = await mount();
	element.hints = HINTS;
	await element.updateComplete;

	runs(element)[2]?.click();
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("Slot 3 · Episode · Any");
	expect(
		element.shadowRoot?.querySelector(".message")?.classList.contains("error"),
	).toBe(false);
});

// The page's line answers a question being asked right now; the name answers
// one asked a moment ago, and an error is never displaced by a label.
test("a decode error outranks the name of a clicked run", async () => {
	const element = await mount();
	element.hints = HINTS;
	element.message = "Unknown character Q in slot 2.";
	element.invalid = true;
	await element.updateComplete;

	runs(element)[2]?.click();
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("Unknown character Q in slot 2.");
});

test("clicking the code opens it for editing, prefilled", async () => {
	const element = await mount();

	element.shadowRoot?.querySelector<HTMLButtonElement>(".edit")?.click();
	await settle(element);

	expect(field(element)?.value).toBe(CODE);
});

test("typing a code reports the draft to the page", async () => {
	const element = await mount();
	const drafts: string[] = [];
	element.addEventListener("code-draft", (event) => {
		drafts.push((event as CustomEvent<string>).detail);
	});

	element.editing = true;
	await settle(element);
	const input = field(element);
	if (input === null) throw new Error("no input");
	input.value = "1M35S14J00";
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

	expect(drafts).toEqual(["1M35S14J00"]);
});

// Filtering-style noise must not reach the page's form listener as a change of
// the built code: the draft event is the only thing the page should hear.
test("the input's own event does not escape the shadow root", async () => {
	const element = await mount();
	let escaped = 0;
	element.addEventListener("input", () => {
		escaped += 1;
	});

	element.editing = true;
	await settle(element);
	field(element)?.dispatchEvent(
		new Event("input", { bubbles: true, composed: true }),
	);

	expect(escaped).toBe(0);
});

test("Escape closes the editor and tells the page to put the code back", async () => {
	const element = await mount();
	let cancelled = 0;
	element.addEventListener("code-cancel", () => {
		cancelled += 1;
	});

	element.editing = true;
	await settle(element);
	const input = field(element);
	if (input === null) throw new Error("no input");
	press(input, "Escape");
	await settle(element);

	expect(element.editing).toBe(false);
	expect(cancelled).toBe(1);
});

test("Enter closes the editor without cancelling", async () => {
	const element = await mount();
	let cancelled = 0;
	element.addEventListener("code-cancel", () => {
		cancelled += 1;
	});

	element.editing = true;
	await settle(element);
	const input = field(element);
	if (input === null) throw new Error("no input");
	press(input, "Enter");
	await settle(element);

	expect(element.editing).toBe(false);
	expect(cancelled).toBe(0);
});

// The page decodes the draft as it is typed, so the value under the editor
// changes while someone is still typing into it.
test("a value set while editing leaves the typed text alone", async () => {
	const element = await mount();

	element.editing = true;
	await settle(element);
	const input = field(element);
	if (input === null) throw new Error("no input");
	input.value = "1M3";
	element.value = "1M00000000";
	await settle(element);

	expect(field(element)?.value).toBe("1M3");
});

test("leaving the editor shows the current value again", async () => {
	const element = await mount();

	element.editing = true;
	await settle(element);
	element.value = "1M00000000";
	element.editing = false;
	await settle(element);

	expect(element.shadowRoot?.querySelector("code")?.textContent?.trim()).toBe(
		"1M00000000",
	);
});

test("the message from the page shows under the code", async () => {
	const element = await mount();

	element.message = "7 of 10 characters.";
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("7 of 10 characters.");
});

test("an invalid message is marked as an error", async () => {
	const element = await mount();

	element.message = "Unknown character Q in slot 2.";
	element.invalid = true;
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".message")?.classList.contains("error"),
	).toBe(true);
});

// The button says it, not the line under the code: an empty line held open for
// a message this brief costs the panel its height all the time.
test("copying reports that it worked, on the button", async () => {
	const element = await mount();
	let copied = "";
	stubClipboard(async () => {
		copied = element.value;
	});

	element.shadowRoot?.querySelector<HTMLButtonElement>(".copy")?.click();
	await settle(element);

	expect(copied).toBe(CODE);
	expect(
		element.shadowRoot
			?.querySelector(".copy .swap")
			?.classList.contains("done"),
	).toBe(true);
	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("");
});

test("a blocked clipboard says so instead", async () => {
	const element = await mount();
	stubClipboard(() => Promise.reject(new Error("blocked")));

	element.shadowRoot?.querySelector<HTMLButtonElement>(".copy")?.click();
	await settle(element);

	expect(
		element.shadowRoot?.querySelector(".message")?.classList.contains("error"),
	).toBe(true);
});

// A button still saying "Copied" beside a code that has since changed is a lie.
test("a new value puts the copy button back", async () => {
	const element = await mount();
	stubClipboard(async () => {});

	element.shadowRoot?.querySelector<HTMLButtonElement>(".copy")?.click();
	await settle(element);
	element.value = "1M00000000";
	await settle(element);

	expect(
		element.shadowRoot
			?.querySelector(".copy .swap")
			?.classList.contains("done"),
	).toBe(false);
	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("");
});

// A blocked clipboard has an instruction to give, and an instruction does not
// fit on a button.
test("a blocked clipboard leaves the button alone and speaks in the line", async () => {
	const element = await mount();
	stubClipboard(() => Promise.reject(new Error("blocked")));

	element.shadowRoot?.querySelector<HTMLButtonElement>(".copy")?.click();
	await settle(element);

	expect(
		element.shadowRoot
			?.querySelector(".copy .swap")
			?.classList.contains("done"),
	).toBe(false);
	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toContain("blocked the clipboard");
});

// The page puts its own buttons in the bar's row, so the code keeps a line to
// itself and everything acting on it shares the line below.
test("the button row takes whatever the page slots into it", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector(".buttons slot")).not.toBe(null);
});

// A code being typed is not the code those buttons act on, so they go away
// with the display rather than offering to copy or reset something else.
test("the editor renders no slot, so the page's buttons go with it", async () => {
	const element = await mount();

	element.editing = true;
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector("slot")).toBe(null);
});
