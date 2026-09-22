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

function fire(node: HTMLElement): void {
	node.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Where a component's markup lives: its shadow root, or the element itself for
 * anything that renders into the light DOM. Every component on the site has a
 * shadow root today, so in practice this is the shadow-root accessor - written
 * as a fallback rather than a bare `host.shadowRoot` so that these tests state
 * what they are after, the component's markup, and not which DOM it happens to
 * put it in.
 */
function inside(host: HTMLElement): ParentNode {
	return (host as { shadowRoot?: ShadowRoot | null }).shadowRoot ?? host;
}

/** What a component renders, whichever DOM it renders into. */
function shown(host: HTMLElement): string {
	return inside(host).textContent ?? "";
}

/** Lit renders on a microtask; the route's own handlers are synchronous. */
async function settle(): Promise<void> {
	await Bun.sleep(0);
	await Bun.sleep(0);
}

async function codeText(): Promise<string> {
	await settle();
	return inside(codeOutput).querySelector("code")?.textContent ?? "";
}

async function check(
	hostId: string,
	value: string,
	checked: boolean,
): Promise<void> {
	const input = inside(need(hostId)).querySelector<HTMLInputElement>(
		`input[value="${value}"]`,
	);
	if (input === null)
		throw new Error(`missing ${value} checkbox in #${hostId}`);
	if (input.checked !== checked) input.click();
	await settle();
}

const codeOutput = need("code-output");
const typeSelect = need<HTMLSelectElement>("type");
const episodeSelect = need<HTMLSelectElement>("episode");
const randomBoostSelect = need<HTMLSelectElement>("randomBoost");
const builderVerdict = need("builder-verdict");
const codeInput = need<HTMLInputElement>("code-input");
const readerMessage = need("reader-message");
const readerRows = need("reader-rows");
const readerVerdict = need("reader-verdict");
const loadButton = need<HTMLButtonElement>("load");

test("the builder starts on a valid code", async () => {
	expect(await codeText()).toBe("1S0---000-");
	await settle();
	expect(shown(builderVerdict)).toBe("");
});

test("the builder rewrites the type slot to H once a boost forces manual work", async () => {
	typeSelect.value = "auto";
	fire(typeSelect);
	expect(await codeText()).toBe("1A0---000-");

	await check("boosts", "fastStart", true);

	expect(await codeText()).toBe("1H0--F000-");
	await settle();
	expect(shown(builderVerdict)).toContain("Semi-auto");
	expect(shown(builderVerdict)).toContain("Fast Start");
});

test("the builder folds cookie power+ picks into the hex slots", async () => {
	await check("cookiePowers", "fairy", true);
	await check("cookiePowers", "seaFairy", true);

	expect(await codeText()).toBe("1H0--F014-");

	await check("cookiePowers", "fairy", false);
	await check("cookiePowers", "seaFairy", false);
	await check("boosts", "fastStart", false);
});

test("the reader uppercases what you type and spells the combi out", async () => {
	codeInput.value = "1e3-pf400j";
	fire(codeInput);

	expect(codeInput.value).toBe("1E3-PF400J");
	expect(readerMessage.textContent).toBe("");
	expect(readerRows.textContent).toContain("Episode 3");
	expect(readerRows.textContent).toContain("Revive once with 80 HP");
	expect(loadButton.hidden).toBe(false);
	// Exp is played by hand, so auto vs semi-auto is not a question worth asking.
	await settle();
	expect(shown(readerVerdict)).toBe("");
});

test("the reader counts characters while a code is still short", () => {
	codeInput.value = "1E3";
	fire(codeInput);

	expect(readerMessage.textContent).toBe("3 of 10 characters.");
	expect(readerRows.textContent).toBe("");
	expect(loadButton.hidden).toBe(true);
});

test("the reader reports an unreadable slot instead of guessing", () => {
	codeInput.value = "1Z0---000-";
	fire(codeInput);

	expect(readerMessage.textContent).toContain(
		'slot 2 (type): unknown char "Z"',
	);
	expect(readerMessage.classList.contains("error")).toBe(true);
	expect(loadButton.hidden).toBe(true);
});

test("the reader surfaces a soft warning without refusing the code", async () => {
	codeInput.value = "1A3H-F400-";
	fire(codeInput);

	expect(readerMessage.textContent).toBe("");
	expect(need("reader-warnings").textContent).toContain("slot 2 says Auto");
	await settle();
	expect(shown(readerVerdict)).toContain("Semi-auto");
});

test("loading a code into the builder fills every control", async () => {
	codeInput.value = "1E3-PF400J";
	fire(codeInput);
	loadButton.click();

	expect(typeSelect.value).toBe("exp");
	expect(episodeSelect.value).toBe("episode3");
	expect(randomBoostSelect.value).toBe("revive");
	expect(await codeText()).toBe("1E3-PF400J");
});

const orderSelect = need<HTMLSelectElement>("treasureOrder");

async function clickEntry(hostId: string, value: string): Promise<void> {
	const host = need(hostId);
	const row = inside(host).querySelector<HTMLButtonElement>(
		`button[value="${value}"]`,
	);
	if (row === null) throw new Error(`no entry ${value} in #${hostId}`);
	row.click();
	await settle();
}

// These run against the same page as the tests above, in file order, so the
// combi half is whatever the last test left in the builder: 1E3-PF400J.
test("picking a cookie puts a loadout section in front of the combi code", async () => {
	await clickEntry("cookie", "00");

	expect(await codeText()).toBe("1C00.1E3-PF400J");
});

test("picking treasures writes a slot group, and clearing the cookie drops its group", async () => {
	await clickEntry("treasure1", "000");

	expect(await codeText()).toBe("1C00TU000.1E3-PF400J");

	await clickEntry("cookie", "");

	expect(await codeText()).toBe("1TU000.1E3-PF400J");
});

test("the order select switches the flag once there are two slots", async () => {
	await clickEntry("treasure2", "001");
	orderSelect.value = "ordered";
	fire(orderSelect);

	expect(await codeText()).toBe("1TO000-001.1E3-PF400J");

	orderSelect.value = "any";
	fire(orderSelect);

	expect(await codeText()).toBe("1TU000-001.1E3-PF400J");
});

test("the reader still counts the combi half while a full code is short", () => {
	codeInput.value = "1C00.1S0";
	fire(codeInput);

	expect(readerMessage.textContent).toBe("3 of 10 characters.");
});

test("the reader spells out both sections", () => {
	codeInput.value = "1c00tu000.1s0hpf014-";
	fire(codeInput);

	const rows = [...readerRows.querySelectorAll("dt")].map(
		(term) => term.textContent,
	);
	expect(rows.slice(0, 4)).toEqual(["Cookie", "Relay", "Pet", "Treasures"]);
	expect(readerMessage.textContent).toBe("");
});

test("an unreadable loadout section is reported, not guessed at", () => {
	codeInput.value = "1CZZ.1S0---000-";
	fire(codeInput);

	expect(readerMessage.textContent).toContain('no cookie has id "ZZ"');
});

test("loading a full code into the builder fills the loadout controls too", async () => {
	codeInput.value = "1C01P02TU001.1S0---000-";
	fire(codeInput);
	need<HTMLButtonElement>("load").click();

	expect(await codeText()).toBe("1C01P02TU001.1S0---000-");
});

test("the built code goes into the address bar, so a code is a link", () => {
	expect(location.hash).toBe("#1C01P02TU001.1S0---000-");
});

test("resetting empties every control, builder and loadout alike", async () => {
	need<HTMLButtonElement>("reset").click();

	expect(await codeText()).toBe("1S0---000-");
	expect(need<HTMLSelectElement>("type").value).toBe("score");
	expect(location.hash).toBe("#1S0---000-");
});

// The legend table, applied to the code in front of you.
test("each field of the code is labelled with what it currently says", async () => {
	await settle();
	const spans = [...inside(codeOutput).querySelectorAll("code span")];

	expect(spans.map((span) => span.textContent)).toEqual([
		"1",
		"S",
		"0",
		"-",
		"-",
		"-",
		"0",
		"00",
		"-",
	]);
	expect(spans[1]?.getAttribute("data-tooltip")).toBe("Slot 2 · Type · Score");
	expect(spans[5]?.getAttribute("data-tooltip")).toBe(
		"Slot 6 · Boost · Fast Start: off",
	);
});
