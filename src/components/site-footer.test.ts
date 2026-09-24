/// <reference lib="dom" />

import { afterEach, expect, test } from "bun:test";

import { REPO_URL } from "#lib/build-info";

import "./site-footer";

import type { SiteFooter } from "./site-footer";

const SHA = "e2c43291f4b0a7c6d5e8f9a0b1c2d3e4f5a6b7c8";

// The component reads the same environment a build inlines into it. Under the
// test runner `process` is real and the variables are unset, so setting one
// here drives the component down exactly the path a deployed page takes.
afterEach(() => {
	delete process.env["BUN_PUBLIC_COMMIT_SHA"];
	delete process.env["BUN_PUBLIC_BUILT_AT"];
});

async function mount(): Promise<SiteFooter> {
	document.body.replaceChildren();
	const element = document.createElement("site-footer") as SiteFooter;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function links(element: SiteFooter): HTMLAnchorElement[] {
	return [...(element.shadowRoot?.querySelectorAll("a") ?? [])];
}

test("the repository is linked whatever else is known", async () => {
	const element = await mount();

	expect(links(element).map((link) => link.href)).toContain(REPO_URL);
});

test("a known commit is a link to that commit", async () => {
	process.env["BUN_PUBLIC_COMMIT_SHA"] = SHA;
	const element = await mount();

	const commit = links(element).find((link) => link.href.includes("/commit/"));
	expect(commit?.href).toBe(`${REPO_URL}/commit/${SHA}`);
	expect(commit?.textContent?.trim()).toBe("e2c4329");
});

test("an unknown commit leaves no commit link behind", async () => {
	const element = await mount();

	expect(links(element).some((link) => link.href.includes("/commit/"))).toBe(
		false,
	);
});

test("a known build time is shown in UTC and carried in the datetime", async () => {
	process.env["BUN_PUBLIC_BUILT_AT"] = "2026-09-24T14:02:11Z";
	const element = await mount();

	const time = element.shadowRoot?.querySelector("time");
	expect(time?.textContent?.trim()).toBe("2026-09-24 14:02 UTC");
	expect(time?.getAttribute("datetime")).toBe("2026-09-24T14:02:11.000Z");
});

test("an unknown build time leaves no time behind", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelector("time")).toBeNull();
});

// What every `bun run dev` and every local build shows, so it has to read as
// a statement rather than as a value that failed to load.
test("a build that knows neither says so", async () => {
	const element = await mount();

	expect(element.shadowRoot?.textContent).toContain("local build");
});

test("a build that knows both says neither", async () => {
	process.env["BUN_PUBLIC_COMMIT_SHA"] = SHA;
	process.env["BUN_PUBLIC_BUILT_AT"] = "2026-09-24T14:02:11Z";
	const element = await mount();

	expect(element.shadowRoot?.textContent).not.toContain("local build");
});
