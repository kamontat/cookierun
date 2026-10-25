/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./code-bar";

import type { CharHint, CodeBar } from "./code-bar";

const CODE = "10S0000000";

const POWERS = {
	char: "0",
	hint: "Slots 7-9 · Cookie power+ · None",
	group: "cookiePowers",
};

const HINTS: CharHint[] = [
	{ char: "1", hint: "Slot 1 · Format version", group: "version" },
	{ char: "0", hint: "Slot 2 · Mode · Manual", group: "mode" },
	{ char: "S", hint: "Slot 3 · Goal · Score", group: "goal" },
	{ char: "0", hint: "Slot 4 · Episode · Any", group: "episode" },
	{ char: "0", hint: "Slot 5 · Boosts · None", group: "boosts" },
	{ char: "0", hint: "Slot 6 · Random boost · None", group: "randomBoost" },
	POWERS,
	POWERS,
	POWERS,
	{ char: "0", hint: "Slot 10 · Action · No action", group: "action" },
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
		"0",
		"S",
		"0",
		"0",
		"0",
		"000",
		"0",
	]);
});

// Every character is a cell of one width, so wrapped lines line up as a grid.
// The cells add nothing a copy or a text-content check would see.
test("every character of a run is a cell of its own, without changing its text", async () => {
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
	expect(
		[...(run?.querySelectorAll(".cell") ?? [])].map((cell) => cell.textContent),
	).toEqual([...value]);
});

test("a run carries its hint as a tooltip", async () => {
	const element = await mount();

	element.hints = HINTS;
	await element.updateComplete;

	expect(runs(element)[1]?.getAttribute("data-tooltip")).toBe(
		"Slot 2 · Mode · Manual",
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
	element.value = "1HM0F00000";
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

	runs(element)[3]?.click();

	expect(jumped).toBe("episode");
});

// A run with nothing to jump to — a version character, a reserved slot, a
// slot an episode doesn't use — is drawn as plain text rather than a button,
// so there is nothing to tab to or click.
test("an inert run is drawn as text and does not jump", async () => {
	const element = await mount("1HM3");
	element.hints = [
		{
			char: "1",
			hint: "Slot 1 · Format version",
			group: "version",
			inert: true,
		},
		{ char: "H", hint: "Slot 2 · Mode · Hard", group: "mode" },
		{ char: "M", hint: "Slot 3 · Goal · Mission", group: "goal" },
		{ char: "3", hint: "Slot 4 · Episode · 3", group: "episode" },
	];
	await element.updateComplete;

	const inertRuns = [
		...(element.shadowRoot?.querySelectorAll<HTMLSpanElement>("span.inert") ??
			[]),
	];
	expect(inertRuns).toHaveLength(1);
	expect(runs(element)).toHaveLength(3);
	expect(inertRuns[0]?.getAttribute("data-tooltip")).toBe(
		"Slot 1 · Format version",
	);
	expect(inertRuns[0]?.hasAttribute("tabindex")).toBe(false);

	let jumped = "";
	element.addEventListener("slot-jump", (event) => {
		jumped = (event as CustomEvent<string>).detail;
	});
	inertRuns[0]?.click();

	expect(jumped).toBe("");
});

// The hover bubble is behind a hover query, so on a phone this line is the only
// place the run's meaning is said at all.
test("clicking a run names it under the code", async () => {
	const element = await mount();
	element.hints = HINTS;
	await element.updateComplete;

	runs(element)[3]?.click();
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("Slot 4 · Episode · Any");
	expect(
		element.shadowRoot?.querySelector(".message")?.classList.contains("error"),
	).toBe(false);
});

// A tap jumps to the control, which shows the value, so the line only needs
// to say which slot and field it was.
test("a run with a short name is named by it, not by its whole hint", async () => {
	const element = await mount();
	element.hints = HINTS.map((hint) => ({
		...hint,
		name: hint.hint.split(" · ").slice(0, 2).join(" · "),
	}));
	await element.updateComplete;

	runs(element)[3]?.click();
	await element.updateComplete;

	expect(
		element.shadowRoot?.querySelector(".message")?.textContent?.trim(),
	).toBe("Slot 4 · Episode");
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
	input.value = "1HM32SFW0J";
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));

	expect(drafts).toEqual(["1HM32SFW0J"]);
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
	input.value = "10M";
	element.value = "10M0000000";
	await settle(element);

	expect(field(element)?.value).toBe("10M");
});

test("leaving the editor shows the current value again", async () => {
	const element = await mount();

	element.editing = true;
	await settle(element);
	element.value = "10M0000000";
	element.editing = false;
	await settle(element);

	expect(element.shadowRoot?.querySelector("code")?.textContent?.trim()).toBe(
		"10M0000000",
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
	element.value = "10M0000000";
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

// Whatever the page said about a code being typed stops being true the moment
// the editor closes, however it closes.
test("closing the editor by any path fires code-close", async () => {
	const element = await mount();
	let closed = 0;
	element.addEventListener("code-close", () => {
		closed += 1;
	});
	const input = () => element.shadowRoot?.querySelector("input");

	element.editing = true;
	await element.updateComplete;
	input()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }));
	await element.updateComplete;
	expect(closed).toBe(1);

	element.editing = true;
	await element.updateComplete;
	input()?.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
	await element.updateComplete;
	expect(closed).toBe(2);

	element.editing = true;
	await element.updateComplete;
	element.shadowRoot?.querySelector<HTMLButtonElement>("button.done")?.click();
	await element.updateComplete;
	expect(closed).toBe(3);

	// Opening it again is not a close, and neither is a render while shut.
	element.editing = true;
	await element.updateComplete;
	expect(closed).toBe(3);
});

// A page that offers its own Copy code elsewhere — the combi page's ⋯ menu —
// hides the bar's, so the row does not say Copy twice. Edit stays.
const FULL = "1C00-10S0000000";

const FULL_HINTS: CharHint[] = [
	{ char: "1", hint: "Loadout version", group: "loadoutVersion" },
	{ char: "C", hint: "Cookie", group: "cookie" },
	{ char: "0", hint: "Cookie", group: "cookie" },
	{ char: "0", hint: "Cookie", group: "cookie" },
	{ char: "-", hint: "Loadout · Combi", group: "separator" },
	...HINTS,
];

test("showAfter draws only what follows the marker, hints and all", async () => {
	const element = await mount(FULL);
	element.showAfter = "-";
	element.hints = FULL_HINTS;
	await settle(element);

	expect(
		element.shadowRoot?.querySelector("code")?.textContent?.replace(/\s/g, ""),
	).toBe(CODE);
	const groups = [
		...(element.shadowRoot?.querySelectorAll("code .run") ?? []),
	].map((run) => run.getAttribute("data-group"));
	expect(groups[0]).toBe("version");
	expect(groups).not.toContain("cookie");
	expect(groups).not.toContain("separator");
});

test("showAfter draws the whole value when the marker is absent", async () => {
	const element = await mount(CODE);
	element.showAfter = "-";
	element.hints = HINTS;
	await settle(element);

	expect(
		element.shadowRoot?.querySelector("code")?.textContent?.replace(/\s/g, ""),
	).toBe(CODE);
});

// What is shown is a view of the code; what is edited is the code itself, or
// opening the editor would throw away everything before the marker.
test("the editor opens on the whole value, not the part shown", async () => {
	const element = await mount(FULL);
	element.showAfter = "-";
	await settle(element);

	element.shadowRoot?.querySelector<HTMLButtonElement>(".edit")?.click();
	await settle(element);

	expect(field(element)?.value).toBe(FULL);
});

test("copyable false hides the built-in Copy button and keeps Edit", async () => {
	const element = await mount();
	expect(element.copyable).toBe(true);
	expect(element.shadowRoot?.querySelector("button.copy")).not.toBe(null);

	element.copyable = false;
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector("button.copy")).toBe(null);
	expect(element.shadowRoot?.querySelector("button.edit")).not.toBe(null);
	expect(element.shadowRoot?.querySelector(".buttons slot")).not.toBe(null);
});
