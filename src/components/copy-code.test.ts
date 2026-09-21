/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./copy-code";

import type { CopyCode } from "./copy-code";

async function mount(value: string): Promise<CopyCode> {
	document.body.replaceChildren();
	const element = document.createElement("copy-code") as CopyCode;
	element.setAttribute("value", value);
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function stubClipboard(writeText: () => Promise<void>): void {
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
	});
}

test("the value shows as code", async () => {
	const element = await mount("1S0---000-");

	expect(element.shadowRoot?.querySelector("code")?.textContent).toBe(
		"1S0---000-",
	);
});

test("setting the property updates the code and the attribute", async () => {
	const element = await mount("1S0---000-");

	element.value = "1H0--F000-";
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector("code")?.textContent).toBe(
		"1H0--F000-",
	);
	expect(element.getAttribute("value")).toBe("1H0--F000-");
	expect(element.value).toBe("1H0--F000-");
});

test("copying reports that it worked", async () => {
	const element = await mount("1S0---000-");
	let copied = "";
	stubClipboard(async () => {
		copied = element.value;
	});

	element.shadowRoot?.querySelector("button")?.click();
	await Bun.sleep(0);
	await element.updateComplete;

	expect(copied).toBe("1S0---000-");
	expect(element.shadowRoot?.querySelector(".status")?.textContent).toBe(
		"Copied.",
	);
});

test("a blocked clipboard tells the reader to copy by hand", async () => {
	const element = await mount("1S0---000-");
	stubClipboard(() => Promise.reject(new Error("denied")));

	element.shadowRoot?.querySelector("button")?.click();
	await Bun.sleep(0);
	await element.updateComplete;

	const status = element.shadowRoot?.querySelector(".status");
	expect(status?.textContent).toContain("copy it by hand");
	expect(status?.classList.contains("error")).toBe(true);
});

function hintFor(char: string, group: string) {
	return { char, hint: `${char} is ${group}`, group };
}

test("hints wrap each run of one group in a labelled span", async () => {
	const element = await mount("1S0");
	element.hints = [
		hintFor("1", "version"),
		hintFor("S", "type"),
		hintFor("0", "type"),
	];
	await element.updateComplete;

	const groups = [...(element.shadowRoot?.querySelectorAll("code span") ?? [])];
	expect(groups.map((span) => span.textContent)).toEqual(["1", "S0"]);
	expect(groups[1]?.getAttribute("data-tooltip")).toBe("S is type");
	expect(element.value).toBe("1S0");
});

// The code sits at the top of a sticky panel, so a bubble above it opens off
// the top of the window.
test("hints open below the code, not above it", async () => {
	const element = await mount("1S");
	element.hints = [hintFor("1", "version"), hintFor("S", "type")];
	await element.updateComplete;

	expect(
		[...(element.shadowRoot?.querySelectorAll("code span") ?? [])].map((span) =>
			span.getAttribute("data-placement"),
		),
	).toEqual(["bottom", "bottom"]);
});

test("hints that do not cover the code are ignored rather than misaligned", async () => {
	const element = await mount("1S0");
	element.hints = [hintFor("1", "version")];
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector("code span")).toBeNull();
	expect(element.value).toBe("1S0");
});

// Hints describe the code they were computed from; against a newer one they
// would point at the wrong characters.
test("a new value drops the hints until the page supplies new ones", async () => {
	const element = await mount("1S0");
	element.hints = [
		hintFor("1", "version"),
		hintFor("S", "type"),
		hintFor("0", "episode"),
	];
	await element.updateComplete;

	element.value = "1M0";
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector("code span")).toBeNull();
	expect(element.shadowRoot?.querySelector("code")?.textContent).toBe("1M0");
});

// What the route does on every keystroke: set the code, then immediately the
// hints computed from that same code. Both land before the element renders.
test("hints set in the same tick as the value they describe survive", async () => {
	const element = await mount("1S0");

	element.value = "1M0";
	element.hints = [
		hintFor("1", "version"),
		hintFor("M", "type"),
		hintFor("0", "episode"),
	];
	await element.updateComplete;

	expect(
		[...(element.shadowRoot?.querySelectorAll("code span") ?? [])].map(
			(span) => span.textContent,
		),
	).toEqual(["1", "M", "0"]);
});

// A stale "Copied." next to a code that has since changed is a lie.
test("a new value clears the status", async () => {
	const element = await mount("1S0---000-");
	stubClipboard(async () => {});

	element.shadowRoot?.querySelector("button")?.click();
	await Bun.sleep(0);
	await element.updateComplete;
	element.value = "1H0--F000-";
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector(".status")?.textContent).toBe("");
});

function spansOf(element: CopyCode): HTMLSpanElement[] {
	return [
		...(element.shadowRoot?.querySelectorAll<HTMLSpanElement>("code span") ??
			[]),
	];
}

// A full code has around nine hint runs. Nine tab stops between the top of
// the page and the actual form would be worse than the missing tooltip this
// fixes, so the whole run is one stop and arrow keys move inside it.
test("the run of hints is one tab stop, not one per run", async () => {
	const element = await mount("123456789");
	element.hints = [
		hintFor("1", "a"),
		hintFor("2", "b"),
		hintFor("3", "c"),
		hintFor("4", "d"),
		hintFor("5", "e"),
		hintFor("6", "f"),
		hintFor("7", "g"),
		hintFor("8", "h"),
		hintFor("9", "i"),
	];
	await element.updateComplete;

	const spans = spansOf(element);
	expect(spans).toHaveLength(9);
	expect(spans.map((span) => span.getAttribute("tabindex"))).toEqual([
		"0",
		"-1",
		"-1",
		"-1",
		"-1",
		"-1",
		"-1",
		"-1",
		"-1",
	]);
});

test("arrow keys move the tab stop between runs and clamp at the ends", async () => {
	const element = await mount("123");
	element.hints = [hintFor("1", "a"), hintFor("2", "b"), hintFor("3", "c")];
	await element.updateComplete;

	function press(index: number, key: string): void {
		spansOf(element)[index]?.dispatchEvent(
			new KeyboardEvent("keydown", { key, bubbles: true }),
		);
	}

	expect(spansOf(element).map((span) => span.getAttribute("tabindex"))).toEqual(
		["0", "-1", "-1"],
	);

	press(0, "ArrowRight");
	await element.updateComplete;
	expect(spansOf(element).map((span) => span.getAttribute("tabindex"))).toEqual(
		["-1", "0", "-1"],
	);
	expect(element.shadowRoot?.activeElement).toBe(spansOf(element)[1] ?? null);

	press(1, "ArrowRight");
	await element.updateComplete;
	// Already at the last run: clamps instead of wrapping to the first.
	press(2, "ArrowRight");
	await element.updateComplete;
	expect(spansOf(element).map((span) => span.getAttribute("tabindex"))).toEqual(
		["-1", "-1", "0"],
	);

	press(2, "Home");
	await element.updateComplete;
	expect(spansOf(element).map((span) => span.getAttribute("tabindex"))).toEqual(
		["0", "-1", "-1"],
	);

	// Already at the first run: clamps instead of wrapping to the last.
	press(0, "ArrowLeft");
	await element.updateComplete;
	expect(spansOf(element).map((span) => span.getAttribute("tabindex"))).toEqual(
		["0", "-1", "-1"],
	);

	press(0, "End");
	await element.updateComplete;
	expect(spansOf(element).map((span) => span.getAttribute("tabindex"))).toEqual(
		["-1", "-1", "0"],
	);
});

// The hint lives in data-tooltip, which nothing but a mouse can reach.
// aria-label carries the same text to assistive technology.
test("each run carries its hint as an accessible name", async () => {
	const element = await mount("1S0");
	element.hints = [
		hintFor("1", "version"),
		hintFor("S", "type"),
		hintFor("0", "type"),
	];
	await element.updateComplete;

	const spans = spansOf(element);
	expect(spans.map((span) => span.getAttribute("aria-label"))).toEqual([
		"1 is version",
		"S is type",
	]);
});
