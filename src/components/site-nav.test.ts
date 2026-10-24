/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools";

import "./site-nav";

import type { SiteNav } from "./site-nav";

// Connecting the element is what renders it, so every case mounts one. The
// default protocol under happy-dom is http:, which is the served form.
async function mount(current: string | null): Promise<ShadowRoot> {
	document.body.replaceChildren();
	const nav = document.createElement("site-nav") as SiteNav;
	if (current !== null) nav.setAttribute("current", current);
	document.body.append(nav);
	await nav.updateComplete;
	if (nav.shadowRoot === null) throw new Error("no shadow root");
	return nav.shadowRoot;
}

function switcher(root: ShadowRoot): HTMLDetailsElement {
	const details = root.querySelector<HTMLDetailsElement>("details.switcher");
	if (details === null) throw new Error("no tool menu");
	return details;
}

function summaryOf(root: ShadowRoot): HTMLElement {
	const summary = switcher(root).querySelector("summary");
	if (summary === null) throw new Error("no summary");
	return summary;
}

function navLinks(root: ShadowRoot): HTMLAnchorElement[] {
	return [...root.querySelectorAll<HTMLAnchorElement>("nav a")];
}

// happy-dom's HTMLAnchorElement fires a real window.open on a click whose
// default was not prevented - exactly what a production nav link should do,
// so the handler under test must not call preventDefault. The test stubs the
// window instead of the handler, and puts it back when it is done.
function withoutNavigating(run: () => void): void {
	const original = window.open;
	window.open = () => null;
	try {
		run();
	} finally {
		window.open = original;
	}
}

test("renders the brand, the tool menu and the theme toggle in one bar", async () => {
	const root = await mount(null);

	const order = [...root.children].map((el) => el.tagName.toLowerCase());
	expect(order).toEqual(["a", "details", "slot", "theme-toggle"]);

	expect(root.querySelector("a.brand")).not.toBeNull();
	// The icon is a named slot inside the brand link, not an attribute: Bun's
	// bundler rewrites an <img src> written in a page's own markup, but not one
	// handed to a custom element as an attribute.
	expect(root.querySelector("a.brand slot[name='icon']")).not.toBeNull();
	expect(root.querySelector("details.switcher")).not.toBeNull();
	expect(root.querySelector("theme-toggle")).not.toBeNull();
});

test("the tool menu names the current tool, and All tools on the home pane", async () => {
	expect(summaryOf(await mount(null)).textContent).toContain("All tools");
	expect(summaryOf(await mount("combi-name")).textContent).toContain(
		"Combi name codes",
	);
});

test("the menu lists All tools then every registered tool with its tagline, the current one marked", async () => {
	const root = await mount("combi-name");
	const links = navLinks(root);

	expect(links.length).toBe(TOOLS.length + 1);

	expect(links[0]?.textContent).toContain("All tools");
	expect(links[0]?.getAttribute("aria-current")).toBeNull();

	for (const [index, tool] of TOOLS.entries()) {
		const link = links[index + 1];
		expect(link?.textContent).toContain(tool.name);
		expect(link?.textContent).toContain(tool.tagline);
		expect(link?.getAttribute("aria-current")).toBe(
			tool.slug === "combi-name" ? "page" : null,
		);
	}
});

test("on the home pane, All tools carries aria-current and no tool does", async () => {
	const links = navLinks(await mount(null));

	expect(links[0]?.getAttribute("aria-current")).toBe("page");
	for (const link of links.slice(1)) {
		expect(link.getAttribute("aria-current")).toBeNull();
	}
});

test("the menu closes on Escape and returns focus to its button", async () => {
	const root = await mount("combi-name");
	const details = switcher(root);
	const summary = summaryOf(root);

	details.open = true;
	summary.dispatchEvent(
		new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
	);

	expect(details.open).toBe(false);
	expect(root.activeElement).toBe(summary);
});

test("the menu closes when a link inside it is clicked", async () => {
	const root = await mount("combi-name");
	const details = switcher(root);
	details.open = true;

	withoutNavigating(() => {
		navLinks(root)[0]?.click();
	});

	expect(details.open).toBe(false);
});

test("the menu closes on a click outside the host", async () => {
	await mount("combi-name");
	const nav = document.querySelector("site-nav") as SiteNav;
	const details =
		nav.shadowRoot?.querySelector<HTMLDetailsElement>("details.switcher");
	if (details === undefined || details === null) throw new Error("no menu");

	details.open = true;
	document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));

	expect(details.open).toBe(false);
});

test("a click inside the host does not close the menu", async () => {
	const root = await mount("combi-name");
	const details = switcher(root);
	details.open = true;

	// The divider, not the summary: clicking the summary again is a native
	// close of its own, no different from the outside-click handler being
	// exercised here.
	const divider = root.querySelector(".divider");
	if (divider === null) throw new Error("no divider");
	divider.dispatchEvent(
		new MouseEvent("click", { bubbles: true, composed: true }),
	);

	expect(details.open).toBe(true);
});

test("slotted page actions render inside the bar", async () => {
	document.body.replaceChildren();
	const nav = document.createElement("site-nav") as SiteNav;
	const button = document.createElement("button");
	nav.append(button);
	document.body.append(nav);
	await nav.updateComplete;
	if (nav.shadowRoot === null) throw new Error("no shadow root");

	// The default slot, not the named "icon" one nested inside the brand link -
	// the icon slot sits first in the shadow tree since the brand renders first.
	const slot =
		nav.shadowRoot.querySelector<HTMLSlotElement>("slot:not([name])");
	if (slot === null) throw new Error("no default slot");
	expect(slot.assignedElements()).toContain(button);
});

test("links from the home page stay in the current directory", async () => {
	const links = navLinks(await mount(null));

	expect(links[0]?.getAttribute("href")).toBe("./");
	expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});

test("links from a tool page climb out of it first", async () => {
	const links = navLinks(await mount("combi-name"));

	expect(links[0]?.getAttribute("href")).toBe("../");
	expect(links[1]?.getAttribute("href")).toBe("../combi-name/");
});

// A slug that was never registered - a typo copied from another page, or a
// tool that got renamed - used to pass straight through an `as ToolSlug`
// cast. That handed hrefFor a non-null `from`, which writes `../`-prefixed
// links: a root-level page would get links that climb out of the site
// entirely instead of merely landing on the home pane.
test("an unregistered current value is treated as the home pane", async () => {
	const root = await mount("not-a-real-tool");

	expect(summaryOf(root).textContent).toContain("All tools");

	const links = navLinks(root);
	expect(links[0]?.getAttribute("aria-current")).toBe("page");
	expect(links[0]?.getAttribute("href")).toBe("./");
	expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});
