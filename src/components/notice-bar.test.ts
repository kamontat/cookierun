/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./notice-bar";

import type { NoticeBar } from "./notice-bar";

async function mount(): Promise<NoticeBar> {
	document.body.replaceChildren();
	const element = document.createElement("notice-bar") as NoticeBar;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

/** The text of the live region with this role, whitespace collapsed. */
function region(element: NoticeBar, role: "status" | "alert"): string {
	return (
		element.shadowRoot
			?.querySelector(`[role="${role}"]`)
			?.textContent?.replace(/\s+/g, " ")
			.trim() ?? ""
	);
}

function dismiss(element: NoticeBar): HTMLButtonElement | null {
	return (
		element.shadowRoot?.querySelector<HTMLButtonElement>("button.dismiss") ??
		null
	);
}

test("it starts empty, with nothing to dismiss", async () => {
	const element = await mount();

	expect(element.type).toBe(null);
	expect(element.text).toBe("");
	expect(element.hasAttribute("type")).toBe(false);
	expect(dismiss(element)).toBe(null);
});

// Both regions are always in the tree, so a screen reader is already
// listening when a message arrives in one of them.
test("info and warn speak politely, an error as an alert", async () => {
	const element = await mount();

	element.show("info", "Saved 10S0000000.");
	await element.updateComplete;
	expect(element.type).toBe("info");
	expect(element.getAttribute("type")).toBe("info");
	expect(region(element, "status")).toBe("Saved 10S0000000.");
	expect(region(element, "alert")).toBe("");

	element.show("warn", "Careful.");
	await element.updateComplete;
	expect(element.getAttribute("type")).toBe("warn");
	expect(region(element, "status")).toBe("Careful.");
	expect(region(element, "alert")).toBe("");

	element.show("error", "The browser refused.");
	await element.updateComplete;
	expect(element.getAttribute("type")).toBe("error");
	expect(region(element, "status")).toBe("");
	expect(region(element, "alert")).toBe("The browser refused.");
});

test("a list of lines is drawn as a list under its title", async () => {
	const element = await mount();

	element.show("warn", ["Slot 2 read as Semi-auto.", "Slot 10 dropped."], {
		title: "Read with changes",
	});
	await element.updateComplete;

	const items = [...(element.shadowRoot?.querySelectorAll("li") ?? [])].map(
		(item) => item.textContent?.trim(),
	);
	expect(items).toEqual(["Slot 2 read as Semi-auto.", "Slot 10 dropped."]);
	expect(element.shadowRoot?.querySelector("strong")?.textContent).toBe(
		"Read with changes",
	);
	expect(element.text).toBe(
		"Read with changes\nSlot 2 read as Semi-auto.\nSlot 10 dropped.",
	);
});

test("info clears itself; warn and error stay", async () => {
	const element = await mount();
	element.infoFor = 10;

	element.show("info", "Copied.");
	await Bun.sleep(30);
	await element.updateComplete;
	expect(element.type).toBe(null);
	expect(element.hasAttribute("type")).toBe(false);

	element.show("warn", "Careful.");
	await Bun.sleep(30);
	expect(element.type).toBe("warn");

	element.show("error", "Refused.");
	await Bun.sleep(30);
	expect(element.type).toBe("error");
});

// A message replacing an info message is not cut short by the old timer.
test("a newer message is not cleared by an older one's timer", async () => {
	const element = await mount();
	element.infoFor = 20;

	element.show("info", "First.");
	await Bun.sleep(10);
	element.show("error", "Second.");
	await Bun.sleep(30);

	expect(element.type).toBe("error");
	expect(element.text).toBe("Second.");
});

// Typing progress stays while the editor is open, and goes once it closes.
test("a held info message waits until it is released", async () => {
	const element = await mount();
	element.infoFor = 10;

	element.show("info", "4 of 10 characters.", { hold: true });
	await Bun.sleep(30);
	expect(element.type).toBe("info");

	element.release();
	await Bun.sleep(30);
	expect(element.type).toBe(null);
});

test("the dismiss button clears whatever is showing", async () => {
	const element = await mount();
	element.show("error", "Refused.");
	await element.updateComplete;

	const button = dismiss(element);
	expect(button?.getAttribute("aria-label")).toBe("Dismiss");
	button?.click();
	await element.updateComplete;

	expect(element.type).toBe(null);
	expect(region(element, "alert")).toBe("");
	expect(dismiss(element)).toBe(null);
});

// The ✕ goes with the message, so focus on it would fall to <body>. The page
// hears which case it is and puts focus somewhere that still exists.
test("dismissing fires notice-dismiss, saying whether the ✕ had focus", async () => {
	const element = await mount();
	const seen: boolean[] = [];
	element.addEventListener("notice-dismiss", (event) => {
		seen.push((event as CustomEvent<{ focused: boolean }>).detail.focused);
	});

	element.show("error", "Refused.");
	await element.updateComplete;
	dismiss(element)?.click();
	await element.updateComplete;

	element.show("error", "Refused again.");
	await element.updateComplete;
	const button = dismiss(element);
	button?.focus();
	button?.click();
	await element.updateComplete;

	expect(seen).toEqual([false, true]);
});

test("clear empties it", async () => {
	const element = await mount();
	element.show("warn", "Careful.");
	element.clear();
	await element.updateComplete;

	expect(element.type).toBe(null);
	expect(element.text).toBe("");
});

// The page moves the one banner into an open drawer and back. Moving an
// element disconnects it, which must not leave an info message up for good.
test("an info message moved to another parent still clears itself", async () => {
	const element = await mount();
	element.infoFor = 20;
	element.show("info", "Copied.");

	const elsewhere = document.createElement("div");
	document.body.append(elsewhere);
	elsewhere.append(element);
	await Bun.sleep(50);

	expect(element.type).toBe(null);
});
