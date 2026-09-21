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
