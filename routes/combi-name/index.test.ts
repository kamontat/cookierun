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
const { need } = await import("./index.ts");

function fire(node: HTMLElement): void {
	node.dispatchEvent(new Event("input", { bubbles: true }));
}

function check(hostId: string, value: string, checked: boolean): void {
	const input = need(hostId).querySelector<HTMLInputElement>(
		`input[value="${value}"]`,
	);
	if (input === null)
		throw new Error(`missing ${value} checkbox in #${hostId}`);
	input.checked = checked;
	fire(input);
}

const codeOutput = need("code-output");
const code = codeOutput.querySelector("code")!;
const typeSelect = need<HTMLSelectElement>("type");
const episodeSelect = need<HTMLSelectElement>("episode");
const randomBoostSelect = need<HTMLSelectElement>("randomBoost");
const builderVerdict = need("builder-verdict");
const codeInput = need<HTMLInputElement>("code-input");
const readerMessage = need("reader-message");
const readerRows = need("reader-rows");
const readerVerdict = need("reader-verdict");
const loadButton = need<HTMLButtonElement>("load");

test("the builder starts on a valid code", () => {
	expect(code.textContent).toBe("1S0---000-");
	expect(builderVerdict.textContent).toBe("");
});

test("the builder rewrites the type slot to H once a boost forces manual work", () => {
	typeSelect.value = "auto";
	fire(typeSelect);
	expect(code.textContent).toBe("1A0---000-");

	check("boosts", "fastStart", true);

	expect(code.textContent).toBe("1H0--F000-");
	expect(builderVerdict.textContent).toContain("Semi-auto");
	expect(builderVerdict.textContent).toContain("Fast Start");
});

test("the builder folds cookie power+ picks into the hex slots", () => {
	check("cookiePowers", "fairy", true);
	check("cookiePowers", "seaFairy", true);

	expect(code.textContent).toBe("1H0--F014-");

	check("cookiePowers", "fairy", false);
	check("cookiePowers", "seaFairy", false);
	check("boosts", "fastStart", false);
});

test("the reader uppercases what you type and spells the combi out", () => {
	codeInput.value = "1e3-pf400j";
	fire(codeInput);

	expect(codeInput.value).toBe("1E3-PF400J");
	expect(readerMessage.textContent).toBe("");
	expect(readerRows.textContent).toContain("Episode 3");
	expect(readerRows.textContent).toContain("Revive once with 80 HP");
	expect(loadButton.hidden).toBe(false);
	// Exp is played by hand, so auto vs semi-auto is not a question worth asking.
	expect(readerVerdict.textContent).toBe("");
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

test("the reader surfaces a soft warning without refusing the code", () => {
	codeInput.value = "1A3H-F400-";
	fire(codeInput);

	expect(readerMessage.textContent).toBe("");
	expect(need("reader-warnings").textContent).toContain("slot 2 says Auto");
	expect(readerVerdict.textContent).toContain("Semi-auto");
});

test("loading a code into the builder fills every control", () => {
	codeInput.value = "1E3-PF400J";
	fire(codeInput);
	loadButton.click();

	expect(typeSelect.value).toBe("exp");
	expect(episodeSelect.value).toBe("episode3");
	expect(randomBoostSelect.value).toBe("revive");
	expect(code.textContent).toBe("1E3-PF400J");
});

const orderSelect = need<HTMLSelectElement>("treasureOrder");

function clickEntry(hostId: string, value: string): void {
	const host = need(hostId);
	const row = host.querySelector<HTMLButtonElement>(`button[value="${value}"]`);
	if (row === null) throw new Error(`no entry ${value} in #${hostId}`);
	row.click();
}

// These run against the same page as the tests above, in file order, so the
// combi half is whatever the last test left in the builder: 1E3-PF400J.
test("picking a cookie puts a loadout section in front of the combi code", () => {
	clickEntry("cookie", "00");

	expect(code.textContent).toBe("1C00.1E3-PF400J");
});

test("picking treasures writes a slot group, and clearing the cookie drops its group", () => {
	clickEntry("treasure1", "000");

	expect(code.textContent).toBe("1C00TU000.1E3-PF400J");

	clickEntry("cookie", "");

	expect(code.textContent).toBe("1TU000.1E3-PF400J");
});

test("the order select switches the flag once there are two slots", () => {
	clickEntry("treasure2", "001");
	orderSelect.value = "ordered";
	fire(orderSelect);

	expect(code.textContent).toBe("1TO000-001.1E3-PF400J");

	orderSelect.value = "any";
	fire(orderSelect);

	expect(code.textContent).toBe("1TU000-001.1E3-PF400J");
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

test("loading a full code into the builder fills the loadout controls too", () => {
	codeInput.value = "1C01P02TU001.1S0---000-";
	fire(codeInput);
	need<HTMLButtonElement>("load").click();

	expect(code.textContent).toBe("1C01P02TU001.1S0---000-");
});
