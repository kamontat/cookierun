/// <reference lib="dom" />

import { expect, test } from "bun:test";

import type { NoticeBar } from "#components/notice-bar";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();
const body = page.slice(
	page.indexOf("<body>") + "<body>".length,
	page.indexOf("</body>"),
);

document.body.innerHTML = body;

// Dynamic, and kept below the assignment: importing the page script runs it,
// and it looks every element up at module scope.
const { need } = await import("./index");

/**
 * Where a component's markup lives: its shadow root, or the element itself for
 * anything that renders into the light DOM. Written as a fallback rather than a
 * bare `host.shadowRoot` so these tests state what they are after — the
 * component's markup — and not which DOM it happens to put it in.
 */
function inside(host: HTMLElement): ParentNode {
	return (host as { shadowRoot?: ShadowRoot | null }).shadowRoot ?? host;
}

function shown(host: HTMLElement): string {
	return inside(host).textContent ?? "";
}

/** Lit renders on a microtask; the route's own handlers are synchronous. */
async function settle(): Promise<void> {
	await Bun.sleep(0);
	await Bun.sleep(0);
}

const codeBar = need("code");
const summary = need("summary");
const verdict = need("verdict");
const resetButton = need<HTMLButtonElement>("reset");

/** The whole code the page holds — loadout, dash and the ten characters. */
async function codeText(): Promise<string> {
	await settle();
	return (codeBar as HTMLElement & { value: string }).value;
}

/** What the code bar draws: only the ten characters the game takes. */
async function shownCode(): Promise<string> {
	await settle();
	return (
		inside(codeBar).querySelector("code")?.textContent?.replace(/\s/g, "") ?? ""
	);
}

/**
 * Values are bound as properties rather than attributes — a chip's value is
 * data the route handed over, not markup — so the button is found by reading
 * them back rather than by an attribute selector.
 */
function control(hostId: string, value: string): HTMLButtonElement {
	const buttons = [
		...inside(need(hostId)).querySelectorAll<HTMLButtonElement>("button"),
		// A button that holds a value says so with a role — option, radio,
		// checkbox. The ones without are the furniture a picker needs to open and
		// close, and a bare <button> reads its value back as "", which is exactly
		// the value a "none" cell carries.
	].filter((button) => button.hasAttribute("role"));
	const found = buttons.find((button) => button.value === value);
	if (found === undefined) {
		throw new Error(`#${hostId} has no control for ${value}`);
	}
	return found;
}

async function choose(hostId: string, value: string): Promise<void> {
	control(hostId, value).click();
	await settle();
}

function isOn(hostId: string, value: string): boolean {
	const button = control(hostId, value);
	return (
		button.getAttribute("aria-checked") === "true" ||
		button.getAttribute("aria-selected") === "true"
	);
}

/** Types into the code bar the way someone pasting a code by hand would. */
async function typeCode(text: string): Promise<void> {
	(codeBar as HTMLElement & { editing: boolean }).editing = true;
	await settle();
	const input = inside(codeBar).querySelector("input");
	if (input === null) throw new Error("the code bar has no editor");
	input.value = text;
	input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await settle();
}

/** What the page's one notification banner is showing, if anything. */
/** Whether the note is open on a saved entry: its label says so. */
function isEditing(): boolean {
	return need("note-label").textContent === "Note · editing a saved code";
}

function notice(): { type: string | null; text: string } {
	const bar = need<NoticeBar>("notice");
	return { type: bar.type, text: bar.text };
}

async function reset(): Promise<void> {
	resetButton.click();
	await settle();
}

/** One of the three light-DOM role cards above the Cookies tab's grid. */
function roleCard(role: "cookie" | "relay" | "pet"): HTMLButtonElement {
	const card = need("roles").querySelector<HTMLButtonElement>(
		`button[data-role="${role}"]`,
	);
	if (card === null) throw new Error(`no ${role} card`);
	return card;
}

const tabs = () => need("tabs");

type TabOptions = {
	options: readonly (readonly [string, string, string, string | null])[];
};

function tabOptions(): TabOptions["options"] {
	return (tabs() as HTMLElement & TabOptions).options;
}

async function pickTab(value: string): Promise<void> {
	await settle();
	const tab = [
		...inside(tabs()).querySelectorAll<HTMLButtonElement>("button[role=tab]"),
	].find((button) => button.value === value);
	if (tab === undefined) throw new Error(`no ${value} tab`);
	tab.click();
	await settle();
}

/** The ids of the panels on screen — exactly one, when the page is right. */
function shownPanels(): string[] {
	return [...need("build").querySelectorAll<HTMLElement>("[role=tabpanel]")]
		.filter((panel) => !panel.hidden)
		.map((panel) => panel.id);
}

type Hints = { hints: readonly { group: string; inert?: boolean }[] };

function hints(): Hints["hints"] {
	return (codeBar as HTMLElement & Hints).hints;
}

/** Closes the editor `typeCode` leaves open, so the built code shows. */
async function closeEditor(): Promise<void> {
	(codeBar as HTMLElement & { editing: boolean }).editing = false;
	await settle();
}

// Content blockers hide cookie-consent banners with generic cosmetic rules,
// and EasyList Cookie, Fanboy's Cookiemonster and Annoyance lists and AdGuard's
// cookie-notice list all carry ###panel-cookies — so a Cookies tab panel with
// that id painted as nothing at all under uBlock Origin, AdGuard or Brave. A
// region of the page must not be named like a consent banner.
test("no region of the page is named for cookies, which blockers hide", () => {
	const regions = [
		...document.querySelectorAll<HTMLElement>(
			"[role=tabpanel], section, dialog, form, aside, header, main",
		),
	];
	expect(regions.length).toBeGreaterThan(0);
	for (const region of regions) {
		expect(region.id).not.toMatch(/cookie/i);
	}
});

test("the page opens on a valid code", async () => {
	expect(await codeText()).toBe("10S0000000");
});

test("choosing a goal writes it into the code", async () => {
	await choose("goal", "money");

	expect(await codeText()).toBe("10M0000000");
	await reset();
});

test("a boost card writes its set and rewrites the mode slot to semi-auto", async () => {
	await choose("mode", "auto");
	// Score is played by hand, so an auto run falls to Any, its first goal.
	expect(await codeText()).toBe("1A00000000");

	await choose("boosts", "fastStart");

	expect(await codeText()).toBe("1H00F00000");
	expect(verdict.textContent).toBe("Plays as semi-auto because of Fast Start.");
	await reset();
});

test("Double XP is its own letter and leaves the run on full auto", async () => {
	await choose("mode", "auto");
	await choose("boosts", "doubleXp");

	expect(await codeText()).toBe("1A00X00000");
	expect(verdict.textContent).toBe("Plays itself all the way: full auto.");
	expect(isOn("boosts", "doubleXp")).toBe(true);
	await reset();
});

// Semi-auto is not a choice anyone makes: it is what Fast Start, a random
// boost or a jump action make of an auto run. Offering it as a chip invited
// picking one and getting the other.
test("the mode chips do not offer semi-auto", () => {
	expect(() => control("mode", "semiauto")).toThrow();
	expect(() => control("mode", "auto")).not.toThrow();
});

test("a semi-auto code shows Auto picked, and says semi-auto in words", async () => {
	await typeCode("1HM0F00000");

	expect(isOn("mode", "auto")).toBe(true);
	expect(verdict.textContent).toContain("semi-auto");
	await reset();
});

// The chips carry auto, the code carries H: reading one back must not quietly
// turn it into the other.
test("a semi-auto code re-encodes as itself", async () => {
	await typeCode("1HM0F00000");

	expect((codeBar as HTMLElement & { value: string }).value).toBe("1HM0F00000");
	await reset();
});

// The random boost's chips lead with None, so going back to none is a pick
// like any other — and, the row being resettable, so is clicking the chosen one.
test("the random boost chips write slot 6 and None puts it back to 0", async () => {
	await choose("randomBoost", "revive");
	expect(await codeText()).toBe("10S00R0000");

	await choose("randomBoost", "");
	expect(await codeText()).toBe("10S0000000");

	await choose("randomBoost", "revive");
	await choose("randomBoost", "revive");
	expect(await codeText()).toBe("10S0000000");
	await reset();
});

test("clicking the chosen action puts it back to no action", async () => {
	await choose("mode", "auto");
	await choose("action", "jumpAtStart");
	expect(await codeText()).toBe("1H0000000J");

	await choose("action", "jumpAtStart");

	expect(await codeText()).toBe("1A00000000");
	await reset();
});

// A goal is always something, so the row that holds them does not reset.
test("clicking the chosen goal leaves it chosen", async () => {
	await choose("goal", "money");
	await choose("goal", "money");

	expect(await codeText()).toBe("10M0000000");
	await reset();
});

// The summary is drawn from the code the page just wrote, and a row of it
// asks for the control behind it the way a letter of the code does.
test("the summary follows the build and a row leads to its control", async () => {
	type Rows = { rows: readonly { label: string }[]; hint: string | null };
	expect((summary as HTMLElement & Rows).rows.map((row) => row.label)).toEqual([
		"Run",
	]);
	expect((summary as HTMLElement & Rows).hint).not.toBe(null);

	await choose("mode", "auto");
	await choose("boosts", "fastStart");
	expect((summary as HTMLElement & Rows).rows.map((row) => row.label)).toEqual([
		"Run",
		"Boosts",
	]);

	summary.dispatchEvent(
		new CustomEvent("summary-jump", { detail: "boosts", bubbles: true }),
	);
	expect(document.activeElement).toBe(need("boosts"));
	await reset();
});

// A manual run is played by hand anyway: auto vs semi-auto means nothing.
test("a manual run says no verdict", async () => {
	expect(verdict.textContent).toBe("");
});

test("a cookie power card writes its letter into the code", async () => {
	await choose("cookiePowers", "cheerleader");

	expect(await codeText()).toBe("10S000C000");
	await reset();
});

test("typing a code moves every control to match it", async () => {
	await typeCode("1HM32S000J");

	expect(isOn("goal", "money")).toBe(true);
	expect(isOn("mode", "auto")).toBe(true);
	expect(isOn("episode", "episode3")).toBe(true);
	expect(isOn("boosts", "hpExtension")).toBe(true);
	expect(isOn("boosts", "fastStart")).toBe(true);
	expect(isOn("action", "jumpAtStart")).toBe(true);
	await reset();
});

test("typing a code with a loadout fills the loadout controls too", async () => {
	await typeCode("1C0O-10S0000000");

	expect(roleCard("cookie").textContent).toContain("Fairy Cookie");
	expect(isOn("cookie", "0O")).toBe(true);
	await reset();
});

// Any sits beside None in all three pickers: a build that works with whatever
// cookie is to hand says so, and that is not the same as saying nothing.
test("picking Any on the cookie, relay and pet writes it into the code", async () => {
	await choose("mode", "auto");
	await choose("cookie", "__");
	await choose("relay", "__");
	await choose("pet", "__");

	// The relay writes Semi-auto into slot 3 whichever cookie fills it.
	expect(await codeText()).toBe("1C__R__P__-1H00000000");
	expect(roleCard("cookie").textContent).toContain("Any cookie");
	expect(roleCard("pet").textContent).toContain("Any pet");
	await reset();
});

// The picker does not offer the consumable family, but a code written before
// that — or by hand — can still carry one, and dropping it would rewrite
// someone's saved build behind their back.
test("a code carrying a treasure the picker hides keeps it", async () => {
	await typeCode("1TU00Z-10S0000000");

	// The built code, read off the bar rather than off its rendering: the
	// editor is still open, so the rendered code is the field, not the runs.
	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1TU00Z-10S0000000",
	);
	expect(shown(need("treasure1"))).toContain("XP-Elixir");
	await reset();
});

// An evolved treasure and its blessed form share a picture and all but a
// prefix of a name, so every cell says which of the three it is.
test("every treasure cell carries its kind", async () => {
	const cells = [
		...inside(need("treasure1")).querySelectorAll<HTMLElement>("button.entry"),
	];

	expect(cells.length).toBeGreaterThan(0);
	for (const cell of cells) {
		expect([cell.dataset["kind"], cell.textContent?.trim()]).toEqual([
			expect.stringMatching(/^(base|evolved|blessed)$/) as unknown as string,
			cell.textContent?.trim(),
		]);
	}
});

// The kind travels with a carried id the same way its name does — the picker
// appends this one itself, so it is a second place the kind has to be written.
test("a treasure the picker hides still says which kind it is", async () => {
	await typeCode("1TU00Z-10S0000000");

	expect(
		inside(need("treasure1")).querySelector<HTMLElement>(".chip")?.dataset[
			"kind"
		],
	).toBe("base");
	await reset();
});

// A half-typed code is not an error, so it says how far along it is rather
// than complaining.
test("an unfinished code reports how many characters are in it", async () => {
	await typeCode("1M3H");

	expect(notice()).toEqual({ type: "info", text: "4 of 10 characters." });
	await reset();
});

// Progress stays up for as long as someone is typing — an info message would
// otherwise clear itself mid-word — and is let go once the editor shuts.
test("typing progress is held while the editor is open and let go when it closes", async () => {
	const bar = need<NoticeBar>("notice");
	const was = bar.infoFor;
	bar.infoFor = 10;
	try {
		await typeCode("1M3");
		await Bun.sleep(30);
		expect(notice()).toEqual({ type: "info", text: "3 of 10 characters." });

		await closeEditor();
		await Bun.sleep(30);
		expect(notice().type).toBe(null);
	} finally {
		bar.infoFor = was;
	}
	await reset();
});

test("an unfinished code leaves the controls where they were", async () => {
	await choose("goal", "money");
	await typeCode("1E3H");

	expect(isOn("goal", "money")).toBe(true);
	await reset();
});

test("an unreadable code says what is wrong with it", async () => {
	await typeCode("10Q0000000");

	expect(notice().type).toBe("error");
	expect(notice().text).toContain("Q");
	// The bar's own line is left to the bar: the page says nothing there.
	expect((codeBar as HTMLElement & { message: string }).message).toBe("");
	await reset();
});

// Once the editor shuts, the bar shows the built code again, so an error
// about the draft that never applied is about nothing on screen.
test("closing the editor on an unreadable code takes its error down", async () => {
	await typeCode("10Q0000000");
	expect(notice().type).toBe("error");

	await closeEditor();

	expect(notice().type).toBe(null);
	await reset();
});

test("an unreadable code leaves the controls where they were", async () => {
	await choose("goal", "money");
	await typeCode("10Q0000000");

	expect(isOn("goal", "money")).toBe(true);
	await reset();
});

// Hand-typed codes contradict themselves; the page shows one rather than
// refusing it, and says what it did about it.
test("a contradicting code shows its warnings in the banner, and they go again", async () => {
	expect(notice().type).toBe(null);

	await typeCode("1AM0F00000");

	expect(isOn("boosts", "fastStart")).toBe(true);
	expect(notice().type).toBe("warn");
	expect(notice().text).toContain("Read with changes");
	expect(notice().text).toContain("Semi-auto");

	await typeCode("10S0000000");

	expect(notice().type).toBe(null);
	await reset();
});

// Warnings are about the code that produced them: the next build change
// clears them, just as typing a clean code does.
test("a decode warning clears on the next build change", async () => {
	await typeCode("1AM0F00000");
	await closeEditor();
	expect(notice().type).toBe("warn");

	await choose("goal", "exp");

	expect(notice().type).toBe(null);
	await reset();
});

test("pasting a code anywhere on the page loads it", async () => {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "10M3000000" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(isOn("goal", "money")).toBe(true);
	expect(await codeText()).toBe("10M3000000");
	expect(notice()).toEqual({ type: "info", text: "Code pasted." });
	await reset();
});

// A message about a code answers a question about the code in front of you,
// so it cannot outlive the code it was about.
test("a message from the last code goes away once a control moves", async () => {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "10M3000000" },
	});
	document.dispatchEvent(event);
	await settle();
	expect(notice().type).not.toBe(null);

	await choose("goal", "exp");

	expect(notice().type).toBe(null);
	await reset();
});

test("pasting something that is not a code is left to the browser", async () => {
	await choose("goal", "money");
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "hello there" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(isOn("goal", "money")).toBe(true);
	expect(event.defaultPrevented).toBe(false);
	await reset();
});

test("clicking a run of the code moves focus to the control that writes it", async () => {
	const runs = [
		...inside(codeBar).querySelectorAll<HTMLButtonElement>("code button"),
	];
	const episode = runs.find(
		(run) => run.getAttribute("data-group") === "episode",
	);
	episode?.click();
	await settle();

	expect(document.activeElement).toBe(need("episode"));
	await reset();
});

test("reset goes back to the code the page opened on", async () => {
	await choose("goal", "box");
	await choose("boosts", "fastStart");

	await reset();

	expect(await codeText()).toBe("10S0000000");
	expect(isOn("boosts", "fastStart")).toBe(false);
});

test("the code is remembered for the next visit", async () => {
	await choose("goal", "exp");

	expect(localStorage.getItem("combi-name:code")).toBe("10E0000000");
	await reset();
});

// A link that differs from the open page only by its hash does not reload it,
// so without this the page would ignore the code someone just pasted into the
// address bar — and then overwrite it on the next click.
test("a code arriving in the address bar loads without a reload", async () => {
	location.hash = "#10B5000000";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(isOn("goal", "box")).toBe(true);
	expect(isOn("episode", "episode5")).toBe(true);
	await reset();
});

test("a hash the page cannot read leaves the build alone", async () => {
	await choose("goal", "money");
	location.hash = "#not-a-code";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(isOn("goal", "money")).toBe(true);
	await reset();
});

/** Runs `body` with the clipboard answering however the test needs it to. */
async function withClipboard(
	writeText: (text: string) => Promise<void>,
	body: () => Promise<void>,
): Promise<void> {
	const real = navigator.clipboard;
	Object.defineProperty(navigator, "clipboard", {
		configurable: true,
		value: { writeText },
	});
	try {
		await body();
	} finally {
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: real,
		});
	}
}

// The menu has closed by the time the clipboard answers, so the word goes in
// the banner rather than on the button.
test("Copy link in the menu copies the page's address and says so", async () => {
	let written = "";
	await withClipboard(
		(text) => {
			written = text;
			return Promise.resolve();
		},
		async () => {
			need<HTMLButtonElement>("copy-link").click();
			await settle();
		},
	);

	expect(written).toBe(location.href);
	expect(notice()).toEqual({ type: "info", text: "Copied the link." });
	await reset();
});

// The game takes ten characters; the loadout before the dash is the summary's
// to show, and still rides in the link, the saves and the editor.
test("the code bar shows only the ten characters the game takes", async () => {
	await typeCode("1C0O-10S0000000");
	await closeEditor();

	expect(await codeText()).toBe("1C0O-10S0000000");
	expect(await shownCode()).toBe("10S0000000");

	inside(codeBar).querySelector<HTMLButtonElement>(".edit")?.click();
	await settle();
	expect(inside(codeBar).querySelector<HTMLInputElement>("input")?.value).toBe(
		"1C0O-10S0000000",
	);
	await closeEditor();
	await reset();
});

// The full code is one menu pick away, and the pick is remembered.
test("the menu shows the full code and back, and Copy code copies what is shown", async () => {
	await typeCode("1C0O-10M0000000");
	await closeEditor();
	const toggle = need<HTMLButtonElement>("code-full");
	expect(toggle.textContent?.trim()).toBe("Show full code");
	expect(toggle.getAttribute("aria-pressed")).toBe("false");

	toggle.click();
	await settle();
	expect(await shownCode()).toBe("1C0O-10M0000000");
	expect(toggle.textContent?.trim()).toBe("Show game code only");
	expect(toggle.getAttribute("aria-pressed")).toBe("true");
	expect(localStorage.getItem("combi-name:full-code")).toBe("1");

	let written = "";
	await withClipboard(
		(text) => {
			written = text;
			return Promise.resolve();
		},
		async () => {
			need<HTMLButtonElement>("copy-code").click();
			await settle();
		},
	);
	expect(written).toBe("1C0O-10M0000000");

	toggle.click();
	await settle();
	expect(await shownCode()).toBe("10M0000000");
	expect(localStorage.getItem("combi-name:full-code")).toBe("0");
	await reset();
});

test("Copy code copies the ten characters the game takes, not the loadout", async () => {
	await typeCode("1C0O-10M0000000");
	await closeEditor();
	let written = "";
	await withClipboard(
		(text) => {
			written = text;
			return Promise.resolve();
		},
		async () => {
			need<HTMLButtonElement>("copy-code").click();
			await settle();
		},
	);

	expect(written).toBe("10M0000000");
	expect(notice()).toEqual({ type: "info", text: "Copied 10M0000000." });
	await reset();
});

test("Copy code in the menu copies the code itself and says so", async () => {
	await choose("goal", "money");
	let written = "";
	await withClipboard(
		(text) => {
			written = text;
			return Promise.resolve();
		},
		async () => {
			need<HTMLButtonElement>("copy-code").click();
			await settle();
		},
	);

	expect(written).toBe("10M0000000");
	expect(notice()).toEqual({ type: "info", text: "Copied 10M0000000." });
	await reset();
});

// A blocked clipboard has an instruction to give, so it stays up as an error.
test("a blocked clipboard says so in the banner", async () => {
	await withClipboard(
		() => Promise.reject(new Error("blocked")),
		async () => {
			need<HTMLButtonElement>("copy-link").click();
			await settle();
			expect(notice()).toEqual({
				type: "error",
				text: "The browser blocked the clipboard. Copy the address bar by hand.",
			});

			need<HTMLButtonElement>("copy-code").click();
			await settle();
			expect(notice()).toEqual({
				type: "error",
				text: "The browser blocked the clipboard. Select the code and copy it by hand.",
			});
		},
	);
	await reset();
});

test("every character of the code carries a hint", async () => {
	await settle();
	const runs = [
		...inside(codeBar).querySelectorAll<HTMLButtonElement>("code button"),
	];

	expect(runs.length).toBeGreaterThan(0);
	for (const run of runs) {
		expect(run.getAttribute("data-tooltip")).not.toBe("");
	}
});

// The tabs run in the order a run is set up — what run, who runs it, what it
// carries — which is not the order the code reads, since the loadout is
// written first. The slot markers are what carry that, so every field has one.
test("every field states the slot or group it writes", () => {
	const fields = [...need("build").querySelectorAll(".field")];

	expect(fields.length).toBe(10);
	for (const field of fields) {
		expect(field.querySelector(".fieldhead h4")?.textContent?.trim()).not.toBe(
			"",
		);
		expect(field.querySelector(".slot")?.textContent?.trim()).not.toBe("");
	}
});

test("picking a cookie in its grid writes the loadout section", async () => {
	await choose("cookie", "0O");

	expect(await codeText()).toBe("1C0O-10S0000000");
	await reset();
});

test("the verdict still follows the flag slots", async () => {
	await choose("mode", "auto");
	await choose("boosts", "fastStart");

	expect(verdict.textContent).toBe("Plays as semi-auto because of Fast Start.");
	await reset();
});

// The switch says what the slots mean, so the slots say it too: a numbered
// slot claims a position the code only carries when the order is exact.
// With two or more slots filled, the code carries the order; with fewer, it does not.
test("the order switch relabels the treasure slots when two are filled", async () => {
	await typeCode("1TU0FZ.00Z-10S0000000");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");
	expect(need("treasure2").getAttribute("legend")).toBe("Any slot");

	await choose("treasureOrder", "ordered");

	expect(need("treasure1").getAttribute("legend")).toBe("Slot 1");
	expect(need("treasure2").getAttribute("legend")).toBe("Slot 2");

	await choose("treasureOrder", "any");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");
	expect(need("treasure2").getAttribute("legend")).toBe("Any slot");
	await reset();
});

// With only one slot filled, the code cannot carry an order, even when the
// switch says "Exact order", because order requires at least two treasures to matter.
test("a single filled treasure slot shows Any slot even with Exact order", async () => {
	await typeCode("1TU0FZ-10S0000000");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");

	await choose("treasureOrder", "ordered");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");
	await reset();
});

// Three buttons on the panel and nothing else: the bar's own Edit, then Save
// and the menu slotted into the same row. The bar's own Copy is off, since
// Copy code is in the menu.
test("the code panel shows Edit, Save and the menu, and nothing else", async () => {
	await settle();
	expect([...codeBar.children].map((child) => child.id)).toEqual([
		"save",
		"code-menu",
	]);
	expect((codeBar as HTMLElement & { copyable: boolean }).copyable).toBe(false);
	const own = [
		...inside(codeBar).querySelectorAll<HTMLButtonElement>(".buttons button"),
	].map((button) => button.textContent?.trim());
	expect(own).toEqual(["Edit"]);
});

// A code mid-edit is not the code those buttons act on: copying a link to it,
// or resetting away from it, would act on something other than what is shown.
// happy-dom resolves no slot assignment, so this holds the slot that renders
// them rather than asking the buttons which slot took them.
test("opening the editor takes the page's buttons off the panel", async () => {
	(codeBar as HTMLElement & { editing: boolean }).editing = true;
	await settle();

	expect(inside(codeBar).querySelector("slot")).toBe(null);

	(codeBar as HTMLElement & { editing: boolean }).editing = false;
	await settle();

	expect(inside(codeBar).querySelector("slot")).not.toBe(null);
});

// A relay cookie is swapped in by hand, so the run it belongs to is semi-auto
// however the rest of the build reads — and the code says so in slot 2.
test("a relay turns an auto build semi-auto, code and all", async () => {
	await choose("mode", "auto");
	expect(await codeText()).toBe("1A00000000");

	await typeCode("1R0O-1AM0000000");

	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1R0O-1HM0000000",
	);
	expect(verdict.textContent).toBe(
		"Plays as semi-auto because of Relay cookie.",
	);
	await reset();
});

// The chip says which of the two the build is, rather than which of them was
// clicked: there is one chip, and Auto and Semi-auto are the same click.
test("the Auto chip reads Semi-auto once something forces manual work", async () => {
	await choose("mode", "auto");

	expect(control("mode", "auto").textContent?.trim()).toBe("Auto");

	await choose("boosts", "fastStart");

	expect(control("mode", "auto").textContent?.trim()).toBe("Semi-auto");
	await reset();
});

function levelsOf(slotId: string, treasure: string): string[] {
	const row = inside(need(slotId)).querySelector<HTMLElement>(
		`.chip[data-value="${treasure}"]`,
	);
	if (row === null) throw new Error(`no row for ${treasure}`);
	return [
		...row.querySelectorAll<HTMLButtonElement>(
			'button.level[aria-pressed="true"]',
		),
	].map((button) => button.getAttribute("data-level") ?? "");
}

test("a code's treasure levels land on the level buttons", async () => {
	await typeCode("1TU0FZ02_0FZ59_0RB58.0QQ9-10S0000000");

	expect(levelsOf("treasure1", "0FZ")).toEqual([
		"0",
		"1",
		"2",
		"5",
		"6",
		"7",
		"8",
		"9",
	]);
	expect(levelsOf("treasure1", "0RB")).toEqual(["5", "6", "7", "8"]);
	expect(levelsOf("treasure2", "0QQ")).toEqual(["9"]);
	await reset();
});

test("toggling a level rewrites the code", async () => {
	await typeCode("1TU0FZ-10S0000000");
	(codeBar as HTMLElement & { editing: boolean }).editing = false;
	await settle();

	inside(need("treasure1"))
		.querySelector<HTMLButtonElement>(
			'.chip[data-value="0FZ"] button.level[data-level="9"]',
		)
		?.click();
	await settle();

	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1TU0FZ_0FZ9-10S0000000",
	);
	await reset();
});

// A reversed copy does not decode, and a code that does not decode leaves the
// controls exactly where they were.
test("a code with a backwards level range changes nothing", async () => {
	await typeCode("1TU0FZ9-10S0000000");
	await typeCode("1TU0FZ95-10S0000000");

	expect(levelsOf("treasure1", "0FZ")).toEqual(["9"]);
	await reset();
});

// Only the tower has floors, so the floor box is on the board only there.
test("the tower shows a floor box, and the floor lands in slots 5-7", async () => {
	const field = need("field-floor");
	const floor = need<HTMLInputElement>("floor");
	expect(field.hidden).toBe(true);

	await typeCode("1AMT042000");
	// Typing leaves the editor open, and the built code shows once it closes.
	(codeBar as HTMLElement & { editing: boolean }).editing = false;
	await settle();
	expect(field.hidden).toBe(false);
	expect(floor.value).toBe("42");

	floor.value = "7";
	floor.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await settle();
	expect(await codeText()).toBe("1AMT007000");

	floor.value = "";
	floor.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await settle();
	expect(await codeText()).toBe("1AMT000000");
	await reset();
});

// The controls keep what they hold: switching back brings the boosts back.
test("a special episode takes boosts and the relay off the board, not out of the controls", async () => {
	await typeCode("1C00R0O-1HM3H00000");
	// Clicking a cell blurs the editor in a browser, but not in happy-dom.
	await closeEditor();
	expect(need("field-boosts").hasAttribute("data-off")).toBe(false);
	expect(roleCard("relay").disabled).toBe(false);

	await choose("episode", "special1");
	expect(await codeText()).toBe("1C00-1AMC000000");
	expect(need("field-boosts").hasAttribute("data-off")).toBe(true);
	expect(need("field-cookiePowers").hasAttribute("data-off")).toBe(true);
	expect(roleCard("relay").disabled).toBe(true);
	expect(need("relay-note").hidden).toBe(false);

	await choose("episode", "episode3");
	expect(await codeText()).toBe("1C00R0O-1HM3H00000");
	await reset();
});

test("the exp episode takes the treasures off the board too", async () => {
	await typeCode("1TU000-1AM3000000");
	await closeEditor();
	expect(need("field-treasures").hasAttribute("data-off")).toBe(false);

	await choose("episode", "specialExp");
	expect(need("field-treasures").hasAttribute("data-off")).toBe(true);
	expect(await codeText()).toBe("1AMX000000");
	await reset();
});

test("a manual run takes the action off the board", async () => {
	expect(need("field-action").hasAttribute("data-off")).toBe(true);

	await choose("mode", "auto");
	expect(need("field-action").hasAttribute("data-off")).toBe(false);
	await reset();
});

test("an auto run is offered Any instead of Score", async () => {
	expect(() => control("goal", "score")).not.toThrow();
	expect(() => control("goal", "any")).toThrow();

	await choose("mode", "auto");
	expect(() => control("goal", "score")).toThrow();
	expect(isOn("goal", "any")).toBe(true);
	await reset();
});

// Any number of powers can be on, and each group of the seven has a slot.
test("every cookie power can be on at once", async () => {
	for (const power of [
		"cheerleader",
		"specialForce",
		"fairy",
		"cheesecake",
		"seaFairy",
		"serenadeOfLove",
		"expParty",
	]) {
		await choose("cookiePowers", power);
	}
	expect(await codeText()).toBe("10S0004110");
	await reset();
});

test("picking a tab shows its panel and remembers it", async () => {
	expect(shownPanels()).toEqual(["panel-main"]);

	await pickTab("boosts");

	expect(shownPanels()).toEqual(["panel-boosts"]);
	expect(localStorage.getItem("combi-name:tab")).toBe("boosts");
	await pickTab("main");
});

test("clicking a summary row opens its tab and focuses the control", async () => {
	await typeCode("1TU0FZ-10S0000000");
	await closeEditor();

	inside(summary)
		.querySelector<HTMLButtonElement>(
			'.row[data-target="treasures"] button.open',
		)
		?.click();
	await settle();

	expect(shownPanels()).toEqual(["panel-treasures"]);
	expect(document.activeElement).toBe(need("treasure1"));
	await reset();
	await pickTab("main");
});

test("clicking a run of the code opens the tab that holds its control", async () => {
	codeBar.dispatchEvent(
		new CustomEvent("slot-jump", { detail: "randomBoost", bubbles: true }),
	);
	await settle();

	expect(shownPanels()).toEqual(["panel-boosts"]);
	expect(document.activeElement).toBe(need("randomBoost"));
	await pickTab("main");
});

// The stored choice outlives the episode that took it away, so switching back
// reopens it — and the fallback never writes "main" over it.
test("a special episode disables the boosts tab, shows Main, and reopens Boosts when the episode changes back", async () => {
	await pickTab("boosts");

	await choose("episode", "special1");

	expect(shownPanels()).toEqual(["panel-main"]);
	expect(localStorage.getItem("combi-name:tab")).toBe("boosts");
	expect(tabOptions().find(([value]) => value === "boosts")?.[3]).toBe(
		"Special Episode 1 takes no boosts.",
	);
	// A jump to a disabled tab does nothing at all.
	codeBar.dispatchEvent(
		new CustomEvent("slot-jump", { detail: "boosts", bubbles: true }),
	);
	expect(shownPanels()).toEqual(["panel-main"]);

	await choose("episode", "episode3");

	expect(shownPanels()).toEqual(["panel-boosts"]);
	await reset();
	await pickTab("main");
});

test("the Exp episode disables the treasures tab", async () => {
	await choose("episode", "specialExp");

	expect(tabOptions().find(([value]) => value === "treasures")?.[3]).toBe(
		"Special Exp Episode takes no treasures.",
	);
	await reset();
	expect(tabOptions().every(([, , , disabled]) => disabled === null)).toBe(
		true,
	);
});

test("a code's unused parts are not clickable", async () => {
	await typeCode("1C00-1AMC000000");
	const dead = ["boosts", "randomBoost", "cookiePowers", "reserved"];
	const unused = hints().filter(
		(hint) =>
			dead.includes(hint.group) ||
			hint.group === "version" ||
			hint.group === "loadoutVersion",
	);
	expect(unused.map((hint) => hint.group)).toContain("reserved");
	expect(unused.map((hint) => hint.group)).toContain("loadoutVersion");
	for (const hint of unused) expect(hint.inert).toBe(true);
	expect(hints().find((hint) => hint.group === "cookie")?.inert).toBe(false);

	await typeCode("1C00-1AM3H00000");
	expect(hints().find((hint) => hint.group === "boosts")?.inert).toBe(false);
	await closeEditor();
	await reset();
});

test("a role card picks which grid the Cookies tab shows, and a pick writes the code", async () => {
	const grids = () =>
		["cookie", "relay", "pet"].filter((id) => !need(id).hidden);
	expect(grids()).toEqual(["cookie"]);
	expect(roleCard("cookie").getAttribute("aria-pressed")).toBe("true");

	roleCard("relay").click();
	await settle();

	expect(grids()).toEqual(["relay"]);
	expect(roleCard("relay").getAttribute("aria-pressed")).toBe("true");
	expect(roleCard("cookie").getAttribute("aria-pressed")).toBe("false");

	await choose("relay", "0O");

	expect(await codeText()).toBe("1R0O-10S0000000");
	expect(roleCard("relay").textContent).toContain("Fairy Cookie");
	await reset();
	roleCard("cookie").click();
	await settle();
});

test("the relay card is off where the episode takes none", async () => {
	roleCard("relay").click();
	await choose("episode", "special1");

	expect(roleCard("relay").disabled).toBe(true);
	expect(roleCard("relay").textContent).toContain("No relay here");
	// The grid falls back to the cookie's while the relay has no room.
	expect(need("relay").hidden).toBe(true);
	expect(need("cookie").hidden).toBe(false);

	roleCard("relay").click();
	await settle();
	expect(need("relay").hidden).toBe(true);
	await reset();
	roleCard("cookie").click();
	await settle();
});

test("Clear empties the selected role", async () => {
	const clear = need<HTMLButtonElement>("role-clear");
	expect(clear.hidden).toBe(true);

	await choose("cookie", "0O");
	expect(await codeText()).toBe("1C0O-10S0000000");
	expect(clear.hidden).toBe(false);

	clear.click();
	await settle();

	expect(await codeText()).toBe("10S0000000");
	expect(roleCard("cookie").textContent).toContain("None");
	expect(clear.hidden).toBe(true);
	await reset();
});

test("the tab badges count what is set", async () => {
	expect(tabOptions().map(([, , badge]) => badge)).toEqual(["", "", "0/3", ""]);

	await typeCode("1C0OP10TU0FZ.0RB-1HM31RFW00");

	expect(tabOptions().map(([, , badge]) => badge)).toEqual([
		"",
		"2",
		"2/3",
		"5",
	]);
	await closeEditor();
	await reset();
});

test("the relay is not counted where the episode takes none", async () => {
	await typeCode("1C0OR10P10-1HM3000000");
	await closeEditor();
	expect(tabOptions()[1]?.[2]).toBe("3");

	await choose("episode", "special1");

	expect(tabOptions()[1]?.[2]).toBe("2");
	await reset();
});

test("the summary follows the code", async () => {
	const runRow = () =>
		inside(summary).querySelector('.row[data-target="mode"]')?.textContent ??
		"";
	await settle();
	expect(runRow()).toContain("Score");

	await choose("goal", "money");

	expect(runRow()).toContain("Money");
	await reset();
});

test("the verdict sits under the mode chips", () => {
	expect(need("mode").nextElementSibling).toBe(verdict);
	expect(verdict.closest("[role=tabpanel]")?.id).toBe("panel-main");
});

function savedRows(): HTMLLIElement[] {
	return [...need("saved-list").querySelectorAll("li")];
}

function savedButtonFor(
	code: string,
	action: "load" | "copy" | "share" | "delete",
) {
	const button = need("saved-list").querySelector<HTMLButtonElement>(
		`button[data-action="${action}"][data-code="${code}"]`,
	);
	if (button === null) throw new Error(`no ${action} button for ${code}`);
	return button;
}

/** Writes the note and presses Save (or Update) in the code panel. */
async function saveCurrent(description: string): Promise<void> {
	need<HTMLTextAreaElement>("save-description").value = description;
	need<HTMLButtonElement>("save").click();
	await settle();
}

// Nothing failed when there is nothing to move: a warning says what to do
// instead, and error is kept for what the browser or a code refused.
test("exporting or importing nothing is a warning, not an error", async () => {
	expect(need("saved-empty").hidden).toBe(false);

	need<HTMLButtonElement>("export-copy").click();
	await settle();
	expect(notice()).toEqual({
		type: "warn",
		text: "Nothing saved to export yet.",
	});

	need<HTMLTextAreaElement>("import-text").value = "";
	need<HTMLButtonElement>("import").click();
	await settle();
	expect(notice()).toEqual({ type: "warn", text: "Nothing to import." });
	need<NoticeBar>("notice").clear();
});

// Save sits in the code panel, outside the form it submits, so it reaches the
// note through its form attribute.
test("the save button in the code panel submits the note", async () => {
	expect(need("saved-empty").hidden).toBe(false);
	await choose("goal", "money");

	await saveCurrent("Coin farm\nuse Fairy");

	const [row] = savedRows();
	expect(row?.querySelector(".description")?.textContent).toBe(
		"Coin farm\nuse Fairy",
	);
	expect(row?.textContent).toContain("10M0000000");
	expect(row?.getAttribute("aria-current")).toBe("true");
	expect(need("saved-empty").hidden).toBe(true);
	expect(need<HTMLTextAreaElement>("save-description").value).toBe("");
	expect(localStorage.getItem("combi-name:saved")).toContain("Coin farm");

	await reset();
	expect(savedRows()[0]?.getAttribute("aria-current")).toBe("false");
});

const savedDrawer = () => need<HTMLDialogElement>("saved-drawer");
const helpDrawer = () => need<HTMLDialogElement>("help-drawer");

function closeButton(drawer: HTMLDialogElement): HTMLButtonElement {
	const button = drawer.querySelector<HTMLButtonElement>("button[data-close]");
	if (button === null) throw new Error(`#${drawer.id} has no Close button`);
	return button;
}

async function openSavedDrawer(): Promise<void> {
	need<HTMLButtonElement>("open-saved").click();
	await settle();
}

test("Saved opens a drawer that lists the saved codes, and its count follows the list", async () => {
	expect(savedDrawer().open).toBe(false);
	expect(helpDrawer().open).toBe(false);
	expect(need("saved-count").textContent).toBe("1");
	expect(savedDrawer().contains(need("saved-list"))).toBe(true);
	expect(savedDrawer().contains(need("saved-empty"))).toBe(true);

	await openSavedDrawer();
	expect(savedDrawer().open).toBe(true);
	closeButton(savedDrawer()).click();
	await settle();
	expect(savedDrawer().open).toBe(false);

	// A press that starts inside the sheet and ends on the backdrop is a drag,
	// not a dismiss; one that starts and ends on the backdrop closes it.
	await openSavedDrawer();
	need("saved-heading").dispatchEvent(
		new Event("pointerdown", { bubbles: true }),
	);
	savedDrawer().dispatchEvent(new MouseEvent("click", { bubbles: true }));
	expect(savedDrawer().open).toBe(true);
	savedDrawer().dispatchEvent(new Event("pointerdown", { bubbles: true }));
	savedDrawer().dispatchEvent(new MouseEvent("click", { bubbles: true }));
	expect(savedDrawer().open).toBe(false);

	await reset();
	await saveCurrent("Score run");
	expect(need("saved-count").textContent).toBe("2");
	savedButtonFor("10S0000000", "delete").click();
	await settle();
	expect(need("saved-count").textContent).toBe("1");
});

// A drawer is modal, so everything behind it is inert and half hidden. The
// page keeps one banner and carries it into whichever drawer is open.
test("the one banner moves into an open drawer, under its header, and back", async () => {
	const bar = need<NoticeBar>("notice");
	// Home is inside the sticky code panel, right after the code bar, so a
	// message is in view wherever the page is scrolled to.
	const home = () =>
		bar.parentElement?.classList.contains("codepanel") === true &&
		bar.previousElementSibling === codeBar;
	expect(home()).toBe(true);

	bar.show("warn", "Still here.");
	await openSavedDrawer();
	expect(savedDrawer().contains(bar)).toBe(true);
	expect(bar.previousElementSibling?.tagName).toBe("HEADER");
	expect(notice()).toEqual({ type: "warn", text: "Still here." });

	closeButton(savedDrawer()).click();
	await settle();
	expect(home()).toBe(true);
	expect(notice()).toEqual({ type: "warn", text: "Still here." });

	need<HTMLButtonElement>("open-help").click();
	await settle();
	expect(helpDrawer().contains(bar)).toBe(true);
	expect(bar.previousElementSibling?.tagName).toBe("HEADER");
	// Escape closes a native dialog without a click; the close event is what
	// every way out shares.
	helpDrawer().close();
	await settle();
	expect(home()).toBe(true);
	bar.clear();
});

/** Focuses the banner's ✕ and presses it, the way a keyboard user would. */
async function dismissFromKeyboard(): Promise<void> {
	await settle();
	const button = inside(need("notice")).querySelector<HTMLButtonElement>(
		"button.dismiss",
	);
	if (button === null) throw new Error("the banner has no ✕");
	button.focus();
	button.click();
	await settle();
}

// The ✕ leaves with the message, so focus on it would fall to <body>.
test("dismissing from the keyboard hands focus to Save, or to the drawer's Close", async () => {
	const bar = need<NoticeBar>("notice");
	bar.show("error", "Refused.");
	await dismissFromKeyboard();
	expect(bar.type).toBe(null);
	expect(document.activeElement).toBe(need("save"));

	await openSavedDrawer();
	bar.show("error", "Refused.");
	await dismissFromKeyboard();
	expect(document.activeElement).toBe(closeButton(savedDrawer()));
	closeButton(savedDrawer()).click();
	await settle();
});

// "Skipped line 2." is about an import, not the build a Load is about to put
// on screen: it must neither swallow "Loaded X." nor linger beside it.
test("a stale warning from elsewhere does not swallow Loaded", async () => {
	need<HTMLTextAreaElement>("import-text").value = "10M0000000\nnope";
	need<HTMLButtonElement>("import").click();
	await settle();
	expect(notice().type).toBe("warn");

	await openSavedDrawer();
	savedButtonFor("10M0000000", "load").click();
	await settle();

	expect(notice()).toEqual({ type: "info", text: "Loaded Coin farm." });
	// Announced from the page, not from inside the dialog that just closed.
	expect(savedDrawer().contains(need("notice"))).toBe(false);
	await reset();
});

// One action, not Load beside Edit: the two differed only in whether saving
// afterwards wrote back, and that is a choice the save box already offers.
test("loading from the drawer closes it and opens the entry in the note", async () => {
	expect(await codeText()).toBe("10S0000000");
	await pickTab("boosts");
	await openSavedDrawer();

	savedButtonFor("10M0000000", "load").click();

	expect(savedDrawer().open).toBe(false);

	expect(await codeText()).toBe("10M0000000");
	// Opening a saved code keeps the tab someone was on.
	expect(shownPanels()).toEqual(["panel-boosts"]);
	await pickTab("main");
	expect(isOn("goal", "money")).toBe(true);
	expect(notice()).toEqual({ type: "info", text: "Loaded Coin farm." });
	// The banner already says what was loaded, and the label and Update say
	// an entry is open: no second message under the note repeats them.
	expect(isEditing()).toBe(true);
	expect(document.querySelectorAll("#save-editing")).toHaveLength(0);
	expect(need<HTMLTextAreaElement>("save-description").value).toBe(
		"Coin farm\nuse Fairy",
	);
	expect(need("save").textContent?.trim()).toBe("Update");
});

// Reset is starting over, so Update must not be left aimed at the entry.
test("resetting the board closes the entry it was opened from", async () => {
	await reset();

	expect(isEditing()).toBe(false);
	expect(need("save").textContent?.trim()).toBe("Save");
	expect(need<HTMLTextAreaElement>("save-description").value).toBe("");
});

// A saved code a later format cannot read. Behind a modal the note's line
// would go unseen, so the drawer stays up and says so itself.
test("a saved code that no longer reads keeps the drawer open and says so inside it", async () => {
	const stored = JSON.parse(
		localStorage.getItem("combi-name:saved") ?? "[]",
	) as unknown[];
	localStorage.setItem(
		"combi-name:saved",
		JSON.stringify([
			{ code: "1ZZZZZZZZZ", description: "", savedAt: Date.now() },
			...stored,
		]),
	);
	// Re-importing a saved code adds nothing but redraws the list.
	need<HTMLTextAreaElement>("import-text").value = "10M0000000";
	need<HTMLButtonElement>("import").click();
	await settle();
	need<NoticeBar>("notice").clear();

	await openSavedDrawer();
	savedButtonFor("1ZZZZZZZZZ", "load").click();
	await settle();

	expect(savedDrawer().open).toBe(true);
	expect(notice().type).toBe("error");
	expect(notice().text).toContain("1ZZZZZZZZZ no longer reads");
	// The one banner went into the drawer with it, so the message is seen.
	expect(savedDrawer().contains(need("notice"))).toBe(true);
	expect(isEditing()).toBe(false);
	expect(await codeText()).toBe("10S0000000");

	savedButtonFor("1ZZZZZZZZZ", "delete").click();
	await settle();
	closeButton(savedDrawer()).click();
	await settle();
});

test("the note's label says when a saved entry is open", async () => {
	expect(need("note-label").textContent?.trim()).toBe("Note · new code");

	savedButtonFor("10M0000000", "load").click();
	await settle();
	expect(need("note-label").textContent?.trim()).toBe(
		"Note · editing a saved code",
	);

	await reset();
	expect(need("note-label").textContent?.trim()).toBe("Note · new code");
});

test("the code panel's menu holds Copy code, Copy link, Reset, Save as new and Cancel, in that order", async () => {
	expect(
		[...need("code-menu").querySelectorAll(".menu button")].map(
			(button) => button.id,
		),
	).toEqual([
		"code-full",
		"copy-code",
		"copy-link",
		"reset",
		"save-new",
		"save-cancel",
	]);
	expect(need("save-new").hidden).toBe(true);
	expect(need("save-cancel").hidden).toBe(true);

	savedButtonFor("10M0000000", "load").click();
	await settle();
	expect(need("save-new").hidden).toBe(false);
	expect(need("save-cancel").hidden).toBe(false);

	await reset();
	expect(need("save-new").hidden).toBe(true);
	expect(need("save-cancel").hidden).toBe(true);
});

// Built and closed like a saved row's menu: a pick, Escape (focus back to its
// summary) and a click elsewhere each close it.
test("picking from the code menu closes it", async () => {
	const menu = need<HTMLDetailsElement>("code-menu");
	const open = () => {
		menu.open = true;
		menu.dispatchEvent(new Event("toggle"));
	};

	open();
	await reset();
	expect(menu.open).toBe(false);

	savedButtonFor("10M0000000", "load").click();
	await settle();
	open();
	need<HTMLButtonElement>("save-cancel").click();
	await settle();
	expect(menu.open).toBe(false);
	expect(isEditing()).toBe(false);

	open();
	menu
		.querySelector("summary")
		?.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
	expect(menu.open).toBe(false);
	expect(document.activeElement).toBe(menu.querySelector("summary"));

	open();
	need("saved-heading").click();
	expect(menu.open).toBe(false);
});

test("deleting a saved code takes it off the list and out of storage", async () => {
	await openSavedDrawer();
	savedButtonFor("10M0000000", "delete").click();
	await settle();

	expect(savedRows()).toHaveLength(0);
	expect(need("saved-empty").hidden).toBe(false);
	expect(localStorage.getItem("combi-name:saved")).toBe("[]");
	expect(notice()).toEqual({ type: "info", text: "Deleted 10M0000000." });
	expect(need("saved-count").textContent).toBe("0");
});

// The note sits behind the modal, so focus cannot go back to it.
test("deleting the last entry moves focus to the drawer's Close button", async () => {
	expect(savedRows()).toHaveLength(0);
	expect(savedDrawer().open).toBe(true);
	expect(document.activeElement).toBe(closeButton(savedDrawer()));
	closeButton(savedDrawer()).click();
	await settle();
});

function savedCodes(): string[] {
	return savedRows().map((row) => row.getAttribute("data-code") ?? "");
}

test("Update writes the board and the note into the loaded entry in place", async () => {
	await choose("goal", "money");
	await saveCurrent("Coin farm");
	await reset();
	await saveCurrent("Score run");
	expect(savedCodes()).toEqual(["10S0000000", "10M0000000"]);

	savedButtonFor("10M0000000", "load").click();
	await settle();

	expect(await codeText()).toBe("10M0000000");
	expect(isEditing()).toBe(true);
	expect(need<HTMLTextAreaElement>("save-description").value).toBe("Coin farm");
	expect(savedRows()[1]?.hasAttribute("data-editing")).toBe(true);

	await choose("goal", "box");
	const edited = await codeText();
	await saveCurrent("Box farm");

	expect(savedCodes()).toEqual(["10S0000000", edited]);
	expect(savedRows()[1]?.querySelector(".description")?.textContent).toBe(
		"Box farm",
	);
	expect(isEditing()).toBe(false);
	expect(need("save").textContent?.trim()).toBe("Save");
	expect(need<HTMLTextAreaElement>("save-description").value).toBe("");
	expect(notice()).toEqual({ type: "info", text: "Updated Box farm." });
	await reset();
});

test("an update onto a code saved elsewhere is refused and the edit stays open until cancelled", async () => {
	const [, edited = ""] = savedCodes();
	savedButtonFor(edited, "load").click();
	await settle();

	await typeCode("10S0000000");
	await saveCurrent("Box farm");

	expect(notice().text).toContain("already saved");
	expect(notice().type).toBe("error");
	expect(savedCodes()).toEqual(["10S0000000", edited]);
	expect(isEditing()).toBe(true);

	need<HTMLButtonElement>("save-cancel").click();
	await settle();
	expect(isEditing()).toBe(false);
	expect(need<HTMLTextAreaElement>("save-description").value).toBe("");
	expect(savedRows()[1]?.hasAttribute("data-editing")).toBe(false);
});

test("saving as new while editing keeps the entry being edited", async () => {
	const [, edited = ""] = savedCodes();
	savedButtonFor(edited, "load").click();
	await settle();
	await choose("goal", "money");

	need<HTMLTextAreaElement>("save-description").value = "Coin farm";
	need<HTMLButtonElement>("save-new").click();
	await settle();

	expect(savedCodes()).toEqual(["10M0000000", "10S0000000", edited]);
	expect(isEditing()).toBe(false);
	await reset();
});

// "Coin farm" as base64url.
const COIN_FARM_LINK = `${location.href.split("#")[0]}#10M0000000?note=Q29pbiBmYXJt`;

test("copying an entry's link reports inside the drawer", async () => {
	let written = "";
	await withClipboard(
		(text) => {
			written = text;
			return Promise.resolve();
		},
		async () => {
			savedButtonFor("10M0000000", "copy").click();
			await settle();
		},
	);

	expect(written).toBe(COIN_FARM_LINK);
	// The menu it sits in closes on the click, so the word goes in the line.
	expect(notice()).toEqual({
		type: "info",
		text: "Copied the link to Coin farm.",
	});
});

function rowFor(code: string): HTMLLIElement {
	const row = savedRows().find(
		(item) => item.getAttribute("data-code") === code,
	);
	if (row === undefined) throw new Error(`no row for ${code}`);
	return row;
}

// Five buttons a row was a wall. Load is what a row is for; the rest is one
// tap further, behind the row's own menu.
test("a row shows Load and a menu, and the rest of its actions sit in the menu", () => {
	const row = rowFor("10M0000000");
	const menu = row.querySelector<HTMLDetailsElement>("details.more");
	if (menu === null) throw new Error("the row has no menu");

	const outside = [
		...row.querySelectorAll<HTMLButtonElement>("button[data-action]"),
	].filter((button) => !menu.contains(button));
	expect(outside.map((button) => button.getAttribute("data-action"))).toEqual([
		"load",
	]);
	expect(
		[...menu.querySelectorAll<HTMLButtonElement>("button[data-action]")].map(
			(button) => button.getAttribute("data-action"),
		),
	).toEqual(["copy", "delete"]);
	expect(menu.querySelector("summary")?.getAttribute("aria-label")).toBe(
		"More for Coin farm",
	);
});

test("a row's menu closes on a pick, on Escape, on a click elsewhere, and when another opens", async () => {
	const menuOf = (code: string) =>
		rowFor(code).querySelector<HTMLDetailsElement>(
			"details.more",
		) as HTMLDetailsElement;

	menuOf("10M0000000").open = true;
	menuOf("10M0000000").dispatchEvent(new Event("toggle"));
	await withClipboard(
		() => Promise.resolve(),
		async () => {
			savedButtonFor("10M0000000", "copy").click();
			await settle();
		},
	);
	expect(menuOf("10M0000000").open).toBe(false);

	menuOf("10M0000000").open = true;
	menuOf("10M0000000").dispatchEvent(new Event("toggle"));
	menuOf("10M0000000")
		.querySelector("summary")
		?.dispatchEvent(
			new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
		);
	expect(menuOf("10M0000000").open).toBe(false);
	expect(document.activeElement).toBe(
		menuOf("10M0000000").querySelector("summary"),
	);

	menuOf("10M0000000").open = true;
	menuOf("10M0000000").dispatchEvent(new Event("toggle"));
	need("saved-heading").click();
	expect(menuOf("10M0000000").open).toBe(false);

	menuOf("10M0000000").open = true;
	menuOf("10M0000000").dispatchEvent(new Event("toggle"));
	menuOf("10S0000000").open = true;
	menuOf("10S0000000").dispatchEvent(new Event("toggle"));
	expect(menuOf("10M0000000").open).toBe(false);
	menuOf("10S0000000").open = false;
	await reset();
});

// Safari can leave focus outside an open row menu, so Escape reaches the
// dialog rather than the menu: the drawer closes and the menu must go with it,
// or the next opening shows it still hanging open.
test("closing the drawer closes a row menu left open inside it", async () => {
	await openSavedDrawer();
	const menu = rowFor("10M0000000").querySelector<HTMLDetailsElement>(
		"details.more",
	) as HTMLDetailsElement;
	menu.open = true;
	menu.dispatchEvent(new Event("toggle"));

	savedDrawer().close();
	await settle();

	expect(savedDrawer().open).toBe(false);
	expect(menu.open).toBe(false);
});

// Without a share sheet, Share could only do what Copy link already does.
test("an entry offers Share only where the browser has a share sheet", async () => {
	expect(typeof navigator.share).not.toBe("function");
	expect(() => savedButtonFor("10M0000000", "share")).toThrow();

	let shared: ShareData | undefined;
	Object.defineProperty(navigator, "share", {
		configurable: true,
		value: (data: ShareData) => {
			shared = data;
			return Promise.resolve();
		},
	});
	try {
		// Re-importing a saved code adds nothing but redraws the list.
		need<HTMLTextAreaElement>("import-text").value = "10M0000000";
		need<HTMLButtonElement>("import").click();
		await settle();

		savedButtonFor("10M0000000", "share").click();
		await settle();

		expect(shared).toEqual({
			title: "Coin farm",
			text: "Coin farm",
			url: COIN_FARM_LINK,
		});
	} finally {
		Reflect.deleteProperty(navigator, "share");
	}
});

test("exporting copies the whole list as text", async () => {
	let written = "";
	await withClipboard(
		(text) => {
			written = text;
			return Promise.resolve();
		},
		async () => {
			need<HTMLButtonElement>("export-copy").click();
			await settle();
		},
	);

	const [, , edited] = savedCodes();
	expect(written).toBe(
		`10M0000000\n> Coin farm\n\n10S0000000\n> Score run\n\n${edited}\n> Box farm\n`,
	);
});

test("importing text adds the new codes on top, keeps saved notes, and names the lines it skipped", async () => {
	need<HTMLTextAreaElement>("import-text").value =
		"10M5000000\n> imported\n10M0000000\n> not mine\nnope";
	need<HTMLButtonElement>("import").click();
	await settle();

	expect(savedCodes()[0]).toBe("10M5000000");
	expect(savedCodes()).toHaveLength(4);
	expect(savedRows()[1]?.querySelector(".description")?.textContent).toBe(
		"Coin farm",
	);
	// A skipped line is something to look at, so it is a warning, not news.
	expect(notice()).toEqual({
		type: "warn",
		text: "Added 1 code. 1 was already saved. Skipped line 5.",
	});
	expect(need<HTMLTextAreaElement>("import-text").value).toBe("");
});

test("a link that carries a note offers it in the save box", async () => {
	// "From a friend" as base64url.
	location.hash = "#10B5000000?note=RnJvbSBhIGZyaWVuZA";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(await codeText()).toBe("10B5000000");
	expect(need<HTMLTextAreaElement>("save-description").value).toBe(
		"From a friend",
	);
	expect(notice().type).toBe("info");
	expect(notice().text).toContain("came with a note");
	// The page's own hash goes back to being the build alone.
	expect(location.hash).toBe("#10B5000000");

	need<HTMLTextAreaElement>("save-description").value = "";
	await reset();
});

// A link can carry a code that reads with changes and a note. Both have to
// be seen: the note offer joins the warning rather than replacing it.
test("a link with a contradicting code and a note keeps its warning and mentions the note", async () => {
	// "From a friend" as base64url.
	location.hash = "#1AM0F00000?note=RnJvbSBhIGZyaWVuZA";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(notice().type).toBe("warn");
	expect(notice().text).toContain("Read with changes");
	expect(notice().text).toContain("Semi-auto");
	expect(notice().text).toContain("came with a note");
	expect(need<HTMLTextAreaElement>("save-description").value).toBe(
		"From a friend",
	);

	need<HTMLTextAreaElement>("save-description").value = "";
	await reset();
});

test("the top bar's Help button reads ? and keeps its name", () => {
	const help = need<HTMLButtonElement>("open-help");
	expect(help.textContent?.trim()).toBe("?");
	expect(help.getAttribute("aria-label")).toBe("Help");
	expect(help.getAttribute("title")).toBe("Help");
});

test("Help holds the slot reference and the page intro", async () => {
	need<HTMLButtonElement>("open-help").click();
	await settle();
	expect(helpDrawer().open).toBe(true);
	expect(helpDrawer().querySelector("pre.diagram")).not.toBe(null);
	expect(helpDrawer().textContent).toContain(
		"A combi name holds 10 characters",
	);
	expect(helpDrawer().querySelector(".tip")).not.toBe(null);
	expect(document.querySelector(".masthead p")).toBe(null);
	expect(document.querySelector("details.reference")).toBe(null);
	closeButton(helpDrawer()).click();
	await settle();
	expect(helpDrawer().open).toBe(false);
});

// A pick hides the button it was made with, and a hidden button cannot hold
// focus: the browser would drop it to <body>, a keyboard user's start of page.
test("a pick from the code menu hands focus back to the menu's toggle", async () => {
	const menu = need<HTMLDetailsElement>("code-menu");
	const toggle = menu.querySelector("summary");

	menu.open = true;
	resetButton.focus();
	resetButton.click();
	await settle();
	expect(menu.open).toBe(false);
	expect(document.activeElement === toggle).toBe(true);

	// An entry to open, so Save as new and Cancel are on offer.
	await saveCurrent("Focus check");
	const [first = ""] = savedCodes();
	savedButtonFor(first, "load").click();
	await settle();
	menu.open = true;
	const saveNew = need<HTMLButtonElement>("save-new");
	saveNew.focus();
	saveNew.click();
	await settle();
	expect(menu.open).toBe(false);
	expect(document.activeElement === toggle).toBe(true);

	// Cancel already sends focus to the note, and keeps it there.
	savedButtonFor(first, "load").click();
	await settle();
	menu.open = true;
	const cancel = need<HTMLButtonElement>("save-cancel");
	cancel.focus();
	cancel.click();
	await settle();
	expect(document.activeElement?.id).toBe("save-description");

	need<HTMLTextAreaElement>("save-description").value = "";
	await reset();
});

test("Clear hands focus to the role card it emptied", async () => {
	await choose("cookie", "0O");
	const clear = need<HTMLButtonElement>("role-clear");
	clear.focus();
	clear.click();
	await settle();

	expect(clear.hidden).toBe(true);
	expect(document.activeElement?.getAttribute("data-role")).toBe("cookie");
	await reset();
});

// The verdict is a live region: rewriting it with the same words would read
// them out again on every click.
test("the verdict is rewritten only when its words change", async () => {
	await choose("mode", "auto");
	await choose("goal", "money");
	expect(verdict.textContent).not.toBe("");
	let writes = 0;
	const watcher = new MutationObserver((records) => {
		writes += records.length;
	});
	watcher.observe(verdict, {
		childList: true,
		characterData: true,
		subtree: true,
	});
	await choose("goal", "box");
	await settle();
	watcher.disconnect();

	expect(writes).toBe(0);
	await reset();
});

test("the tab stays put when a code arrives in the address bar", async () => {
	await pickTab("boosts");
	location.hash = "#10M0000000";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(await codeText()).toBe("10M0000000");
	expect(shownPanels()).toEqual(["panel-boosts"]);
	await pickTab("main");
	await reset();
});

// A drawer makes the page behind it inert, so a code pasted there must not
// change a board nobody can see.
test("pasting a code while a drawer is open is left alone", async () => {
	await openSavedDrawer();
	expect(savedDrawer().open).toBe(true);

	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "10M3000000" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(event.defaultPrevented).toBe(false);
	expect(await codeText()).toBe("10S0000000");
	closeButton(savedDrawer()).click();
	await settle();
	await reset();
});

// Enter in the floor box submits the form it sits in; with nowhere to submit
// to, the browser would reload the page and lose the build.
test("submitting the build form goes nowhere", () => {
	const event = new Event("submit", { bubbles: true, cancelable: true });

	expect(need("build").dispatchEvent(event)).toBe(false);
	expect(event.defaultPrevented).toBe(true);
});
