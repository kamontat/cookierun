import { expect, test } from "bun:test";

import { pageEntrypoints, TOOLS } from "./tools.ts";

const root = new URL("../", import.meta.url);

test("tool slugs are unique", () => {
	const slugs = TOOLS.map((tool) => tool.slug);
	expect(new Set(slugs).size).toBe(slugs.length);
});

// The build takes this list, so a registered tool with no page here is a
// sidebar link to a page that was never written.
test("every page the build asks for exists on disk", async () => {
	const entrypoints = pageEntrypoints();
	expect(entrypoints).toContain("routes/index.html");
	expect(entrypoints.length).toBe(TOOLS.length + 1);

	for (const path of entrypoints) {
		expect(await Bun.file(new URL(path, root)).exists()).toBe(true);
	}
});

// scripts/build.ts takes its entrypoints from this function. A hand-maintained
// list slipped back in there would pass the rest of the suite today, which
// defeats the reason the derivation exists.
test("the build script takes its entrypoints from the registry", async () => {
	expect(await Bun.file(new URL("scripts/build.ts", root)).text()).toContain(
		"pageEntrypoints()",
	);
});

// The dev server serves what it imports, so a tool missing from scripts/dev.ts
// is a 404 in development even though the build ships it. The
// Record<ToolSlug> in that file makes typecheck fail too; this catches it at
// test time.
test("every tool page is imported by the dev server", async () => {
	const devServer = await Bun.file(new URL("scripts/dev.ts", root)).text();

	for (const { slug } of TOOLS) {
		expect(devServer).toContain(`../routes/${slug}/index.html`);
	}
});

test("the home page is served like the tools are", async () => {
	const devServer = await Bun.file(new URL("scripts/dev.ts", root)).text();

	expect(devServer).toContain("../routes/index.html");
	expect(devServer).toContain('"/": home');
});

// Every link the pages carry has to resolve in development too, or the dev
// server is a different site from the one that ships.
test("the dev server routes every URL form the pages link to", async () => {
	const devServer = await Bun.file(new URL("scripts/dev.ts", root)).text();

	expect(devServer).toContain('"/index.html": home');
	for (const suffix of ["", "/", "/index.html"]) {
		expect(devServer).toContain(`\`/\${slug}${suffix}\``);
	}
});

async function pages(): Promise<string[]> {
	return Promise.all(
		pageEntrypoints().map((path) => Bun.file(new URL(path, root)).text()),
	);
}

// Navigation lives in the sidebar every page renders from this registry, so a
// page without the element is a page you cannot leave.
test("every page hosts the sidebar", async () => {
	for (const page of await pages()) {
		expect(page).toContain("<site-nav");
	}
});

// A tool page built by copying routes/index.html - which is what the
// add-a-tool checklist tells you to do - carries a bare
// <site-nav></site-nav> unless this is checked. Without `current`, hrefFor
// treats the page as the home pane and writes "./" and "./combi-name/",
// which one directory down resolve to the page itself and to
// "/combi-name/combi-name/".
test("every tool page marks itself current with its own slug", async () => {
	const [, ...toolEntrypoints] = pageEntrypoints();

	for (const [index, tool] of TOOLS.entries()) {
		const page = await Bun.file(new URL(toolEntrypoints[index]!, root)).text();
		expect(page).toContain(`current="${tool.slug}"`);
	}
});

// The sidebar is the first thing in the DOM, so without this every page opens
// with a keyboard walk through the navigation before reaching the content.
test("every page offers a skip link to its content", async () => {
	for (const page of await pages()) {
		expect(page).toContain('href="#content"');
		expect(page).toContain('id="content"');
	}
});

// The module scripts are deferred, so a page without this paints in the
// system theme and flips once the saved choice is read.
test("every page applies a saved theme before it paints", async () => {
	for (const page of await pages()) {
		expect(page).toContain('id="theme-boot"');
		expect(page).toContain('localStorage.getItem("theme")');
	}
});

test("every page links its own stylesheet", async () => {
	for (const page of await pages()) {
		expect(page).toContain('href="./index.css"');
	}
});

// Without this the page renders every custom element as an empty tag and
// reports nothing anywhere - there is no error, just a page that never
// upgrades past its markup.
test("every page loads its own module script", async () => {
	for (const page of await pages()) {
		expect(page).toContain('src="./index.ts"');
	}
});

// Every route's own sheet opens by importing routes/base.css, which is what
// gives that page Pico, the sidebar rail, the body grid, and every component's
// rules. Delete that line and the page is spectacularly broken while the rest
// of the suite stays green, so check it directly. The home pane sits beside
// the base sheet and the rest sit one directory below it, so the prefix is the
// only thing that differs.
test("every route stylesheet imports the base sheet", async () => {
	const [home, ...tools] = pageEntrypoints();

	for (const [entrypoint, prefix] of [
		[home!, "./"],
		...tools.map((entrypoint) => [entrypoint, "../"] as const),
	] as const) {
		const stylesheet = entrypoint.replace(/index\.html$/, "index.css");
		expect(await Bun.file(new URL(stylesheet, root)).text()).toContain(
			`@import "${prefix}base.css";`,
		);
	}
});

test("the home page hosts the tool index", async () => {
	const [home] = await pages();
	expect(home).toContain("<tool-index");
});
