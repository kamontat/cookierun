/// <reference lib="dom" />

import { expect, test } from "bun:test";

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
const warnings = need("warnings");
const resetButton = need<HTMLButtonElement>("reset");

async function codeText(): Promise<string> {
	await settle();
	return inside(codeBar).querySelector("code")?.textContent?.trim() ?? "";
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

function message(): string {
	return inside(codeBar).querySelector(".message")?.textContent?.trim() ?? "";
}

async function reset(): Promise<void> {
	resetButton.click();
	await settle();
}

test("the page opens on a valid code", async () => {
	expect(await codeText()).toBe("1S00000000");
});

test("choosing a type writes it into the code", async () => {
	await choose("type", "money");

	expect(await codeText()).toBe("1M00000000");
	await reset();
});

test("a boost card writes its bit and rewrites the type slot to semi-auto", async () => {
	await choose("type", "auto");
	expect(await codeText()).toBe("1A00000000");

	await choose("boosts", "fastStart");

	expect(await codeText()).toBe("1H04000000");
	expect(shown(summary)).toContain("Semi-auto");
	expect(shown(summary)).toContain("Fast Start");
	await reset();
});

test("Double XP adds its bit and leaves the run on full auto", async () => {
	await choose("type", "auto");
	await choose("boosts", "doubleXp");

	expect(await codeText()).toBe("1A08000000");
	expect(shown(summary)).toContain("Full auto");
	expect(isOn("boosts", "doubleXp")).toBe(true);
	await reset();
});

// Semi-auto is not a choice anyone makes: it is what Fast Start, a random
// boost or a jump action make of an auto run. Offering it as a chip invited
// picking one and getting the other.
test("the type chips do not offer semi-auto", () => {
	expect(() => control("type", "semiauto")).toThrow();
	expect(() => control("type", "auto")).not.toThrow();
});

test("a semi-auto code shows Auto picked, and says semi-auto in words", async () => {
	await typeCode("1H04000000");

	expect(isOn("type", "auto")).toBe(true);
	expect(shown(summary)).toContain("Semi-auto");
	await reset();
});

// The chips carry auto, the code carries H: reading one back must not quietly
// turn it into the other.
test("a semi-auto code re-encodes as itself", async () => {
	await typeCode("1H04000000");

	expect((codeBar as HTMLElement & { value: string }).value).toBe("1H04000000");
	await reset();
});

// The random boost's picker carries a None cell of its own, so going back to
// none is a pick like any other rather than a second click on what is chosen.
test("picking None puts the random boost back to none", async () => {
	await choose("randomBoost", "revive");
	expect(await codeText()).toBe("1S00400000");

	await choose("randomBoost", "");

	expect(await codeText()).toBe("1S00000000");
	await reset();
});

test("clicking the chosen action puts it back to no action", async () => {
	await choose("action", "jumpAtStart");
	expect(await codeText()).toBe("1S00000J00");

	await choose("action", "jumpAtStart");

	expect(await codeText()).toBe("1S00000000");
	await reset();
});

// A type is always something, so the row that holds them does not reset.
test("clicking the chosen type leaves it chosen", async () => {
	await choose("type", "money");
	await choose("type", "money");

	expect(await codeText()).toBe("1M00000000");
	await reset();
});

// The build summary is the board's header now: it is not a card off on its
// own above the sticky code panel, and it is not part of the sticky panel
// either.
test("the build summary sits inside the board, as its header", () => {
	expect(need("build").firstElementChild).toBe(summary);
	expect(summary.closest(".codepanel")).toBe(null);
});

test("a cookie power card writes its bit into the code", async () => {
	await choose("cookiePowers", "cheerleader");

	expect(await codeText()).toBe("1S00001000");
	await reset();
});

test("typing a code moves every control to match it", async () => {
	await typeCode("1M37214J00");

	expect(isOn("type", "money")).toBe(true);
	expect(isOn("episode", "episode3")).toBe(true);
	expect(isOn("boosts", "hpExtension")).toBe(true);
	expect(isOn("boosts", "fastStart")).toBe(true);
	expect(isOn("action", "jumpAtStart")).toBe(true);
	await reset();
});

test("typing a code with a loadout fills the loadout controls too", async () => {
	await typeCode("1C0O-1S00000000");

	expect(shown(need("cookie"))).toContain("Fairy Cookie");
	await reset();
});

// Any sits beside None in all three pickers: a build that works with whatever
// cookie is to hand says so, and that is not the same as saying nothing.
test("picking Any on the cookie, relay and pet writes it into the code", async () => {
	await choose("type", "auto");
	await choose("cookie", "__");
	await choose("relay", "__");
	await choose("pet", "__");

	// The relay writes Semi-auto into slot 2 whichever cookie fills it.
	expect(await codeText()).toBe("1C__R__P__-1H00000000");
	expect(shown(need("cookie"))).toContain("Any cookie");
	expect(shown(need("pet"))).toContain("Any pet");
	await reset();
});

// The picker does not offer the consumable family, but a code written before
// that — or by hand — can still carry one, and dropping it would rewrite
// someone's saved build behind their back.
test("a code carrying a treasure the picker hides keeps it", async () => {
	await typeCode("1TU00Z-1S00000000");

	// The built code, read off the bar rather than off its rendering: the
	// editor is still open, so the rendered code is the field, not the runs.
	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1TU00Z-1S00000000",
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
	await typeCode("1TU00Z-1S00000000");

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

	expect(message()).toBe("4 of 10 characters.");
	await reset();
});

test("an unfinished code leaves the controls where they were", async () => {
	await choose("type", "money");
	await typeCode("1E3H");

	expect(isOn("type", "money")).toBe(true);
	await reset();
});

test("an unreadable code says what is wrong with it", async () => {
	await typeCode("1Q00000000");

	expect(message()).toContain("Q");
	await reset();
});

test("an unreadable code leaves the controls where they were", async () => {
	await choose("type", "money");
	await typeCode("1Q00000000");

	expect(isOn("type", "money")).toBe(true);
	await reset();
});

// Hand-typed codes contradict themselves; the page shows one rather than
// refusing it, and says what it did about it.
test("a code that contradicts itself still loads, with a warning", async () => {
	await typeCode("1A04000000");

	expect(isOn("boosts", "fastStart")).toBe(true);
	expect(warnings.textContent).toContain("Semi-auto");
	await reset();
});

test("the warning goes away once the code stops contradicting itself", async () => {
	await typeCode("1A04000000");
	expect(warnings.textContent).not.toBe("");

	await typeCode("1S00000000");

	expect(warnings.textContent).toBe("");
	await reset();
});

test("pasting a code anywhere on the page loads it", async () => {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "1M30000000" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(isOn("type", "money")).toBe(true);
	expect(await codeText()).toBe("1M30000000");
	await reset();
});

// The line under the code answers a question about the code in front of you,
// so it cannot outlive the code it was about.
test("a message from the last code goes away once a control moves", async () => {
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "1M30000000" },
	});
	document.dispatchEvent(event);
	await settle();
	expect(message()).not.toBe("");

	await choose("type", "exp");

	expect(message()).toBe("");
	await reset();
});

test("pasting something that is not a code is left to the browser", async () => {
	await choose("type", "money");
	const event = new Event("paste", { bubbles: true, cancelable: true });
	Object.defineProperty(event, "clipboardData", {
		value: { getData: () => "hello there" },
	});
	document.dispatchEvent(event);
	await settle();

	expect(isOn("type", "money")).toBe(true);
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
	await choose("type", "box");
	await choose("boosts", "fastStart");

	await reset();

	expect(await codeText()).toBe("1S00000000");
	expect(isOn("boosts", "fastStart")).toBe(false);
});

test("the code is remembered for the next visit", async () => {
	await choose("type", "exp");

	expect(localStorage.getItem("combi-name:code")).toBe("1E00000000");
	await reset();
});

// A link that differs from the open page only by its hash does not reload it,
// so without this the page would ignore the code someone just pasted into the
// address bar — and then overwrite it on the next click.
test("a code arriving in the address bar loads without a reload", async () => {
	location.hash = "#1B50000000";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(isOn("type", "box")).toBe(true);
	expect(isOn("episode", "episode5")).toBe(true);
	await reset();
});

test("a hash the page cannot read leaves the build alone", async () => {
	await choose("type", "money");
	location.hash = "#not-a-code";
	window.dispatchEvent(new Event("hashchange"));
	await settle();

	expect(isOn("type", "money")).toBe(true);
	await reset();
});

/** Runs `body` with the clipboard answering however the test needs it to. */
async function withClipboard(
	writeText: () => Promise<void>,
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

// The confirmation rides on the button, so the line under it stays closed
// unless the clipboard actually refused.
test("copying the link says so on the button, not in the status line", async () => {
	await withClipboard(
		() => Promise.resolve(),
		async () => {
			need<HTMLButtonElement>("copy-link").click();
			await settle();

			expect(
				need("copy-link").querySelector(".swap")?.classList.contains("done"),
			).toBe(true);
			expect(shown(need("link-status")).trim()).toBe("");
		},
	);
});

// A blocked clipboard has an instruction to give, and an instruction does not
// fit on a button.
test("a blocked clipboard writes the instruction into the status line", async () => {
	await withClipboard(
		() => Promise.reject(new Error("blocked")),
		async () => {
			need<HTMLButtonElement>("copy-link").click();
			await settle();

			expect(shown(need("link-status"))).toContain("blocked the clipboard");
		},
	);
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

// One board: what the code says is the control that writes it, so there is no
// second copy of the build to keep in step.
test("the build panels are gone, replaced by the board's own bands", () => {
	expect(need("build").querySelectorAll("details.panel").length).toBe(0);
	expect(need("build").querySelectorAll(".band").length).toBe(3);
});

// The board runs in the order a run is set up — what run, who runs it, what it
// carries — which is not the order the code reads, since the loadout is
// written first. The slot markers are what carry that, so every field has one.
test("every field states the slot or group it writes", () => {
	const fields = [...need("build").querySelectorAll(".field")];

	expect(fields.length).toBe(8);
	for (const field of fields) {
		expect(field.querySelector(".fieldhead h4")?.textContent?.trim()).not.toBe(
			"",
		);
		expect(field.querySelector(".slot")?.textContent?.trim()).not.toBe("");
	}
});

test("the loadout sits between the run and the boosts", () => {
	const bands = [...need("build").querySelectorAll(".band h3")].map((head) =>
		head.textContent?.trim(),
	);

	expect(bands).toEqual(["The run", "Your loadout", "Boosts and start"]);
});

test("picking a cookie in its dialog writes the loadout section", async () => {
	const tile = need("cookie");
	const button = inside(tile).querySelector<HTMLButtonElement>("button.tile");
	button?.click();
	await settle();

	// The grid caps at 50 of the 94 cookies, so the pick is narrowed into view
	// by name rather than assumed to be among the first page of cells.
	const search = inside(tile).querySelector<HTMLInputElement>("input");
	if (search === null) throw new Error("the cookie tile has no search box");
	search.value = "Fairy";
	search.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
	await settle();

	const cell = [
		...inside(tile).querySelectorAll<HTMLButtonElement>("button.entry"),
	].find((entry) => entry.value === "0O");
	cell?.click();
	await settle();

	expect(await codeText()).toBe("1C0O-1S00000000");
	await reset();
});

test("the verdict still follows the flag slots", async () => {
	await choose("type", "auto");
	await choose("boosts", "fastStart");

	expect(shown(summary)).toContain("Semi-auto");
	expect(shown(summary)).toContain("Fast Start");
	await reset();
});

// The switch says what the slots mean, so the slots say it too: a numbered
// slot claims a position the code only carries when the order is exact.
// With two or more slots filled, the code carries the order; with fewer, it does not.
test("the order switch relabels the treasure slots when two are filled", async () => {
	await typeCode("1TU0FZ.00Z-1S00000000");

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
	await typeCode("1TU0FZ-1S00000000");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");

	await choose("treasureOrder", "ordered");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");
	await reset();
});

// Copy link and Reset live in the code bar's own button row, so they share the
// line under the code with Edit and Copy rather than taking a row of their own.
test("the page's buttons ride in the code bar's row", () => {
	expect(need("copy-link").closest("code-bar")?.id).toBe("code");
	expect(need("reset").closest("code-bar")?.id).toBe("code");
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
	await choose("type", "auto");
	expect(await codeText()).toBe("1A00000000");

	await typeCode("1R0O-1A00000000");

	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1R0O-1H00000000",
	);
	expect(shown(summary)).toContain("Semi-auto");
	expect(shown(summary)).toContain("Relay cookie");
	await reset();
});

// The chip says which of the two the build is, rather than which of them was
// clicked: there is one chip, and Auto and Semi-auto are the same click.
test("the Auto chip reads Semi-auto once something forces manual work", async () => {
	await choose("type", "auto");

	expect(control("type", "auto").textContent?.trim()).toBe("Auto");

	await choose("boosts", "fastStart");

	expect(control("type", "auto").textContent?.trim()).toBe("Semi-auto");
	await reset();
});
