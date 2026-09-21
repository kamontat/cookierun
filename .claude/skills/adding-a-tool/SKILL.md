---
name: adding-a-tool
description: Use when adding a new tool page (a new src/routes/<slug>/ entry in the TOOLS registry), or when an existing page fails src/lib/tools.test.ts, paints unstyled, or renders a sidebar whose links point at the wrong directory.
---

# Adding a tool

1. Add an entry to `TOOLS` in `src/lib/tools.ts`.
2. Create `src/routes/<slug>/index.html`: `<a class="skip-link" href="#content">Skip to content</a>` then `<site-nav current="<slug>"></site-nav>` as the first two body children, a `<script id="theme-boot">` block copied from an existing page's head above the stylesheet link, `<link rel="stylesheet" href="./index.css" />`, `<script src="./index.ts" type="module"></script>`, `<main id="content" class="container" tabindex="-1">`, and Pico's `container` class on `header` and `footer` too. The skip link matters because the sidebar comes first in the DOM.
3. Create `src/routes/<slug>/index.css` starting with `@import "../base.css";`. That import is what gives the page Pico, the body grid, the sidebar rail, and every component's rules. A sheet holding nothing else is fine — the base sheet is its own file, so no route's stylesheet can collide with it.
4. Create `src/routes/<slug>/index.ts` and import the components the page declares, so their `customElements.define` calls run.

That is the whole list — no script names a page. See "Nothing has to be added to the build" below.

## What the tests do and don't catch

`src/lib/tools.test.ts` fails until the page exists, links `./index.css`, has a stylesheet that imports the base sheet, hosts `<site-nav>` carrying its own slug as `current`, loads `./index.ts`, and carries the skip link and the theme bootstrap. It fails in the other direction too: a page under `src/routes/` with no entry in `TOOLS` is a page the build ships and no sidebar links to, so step 1 cannot be skipped by writing only the files.

What no test checks is the rest of step 2: a page missing the `container` classes or the `tabindex` on `<main>` is merely ugly, and nothing catches it. The two failures that are silent and total — a page that never upgrades its elements, and a tool page whose sidebar links all point at the wrong directory — are the two the tests above do cover, because the alternative is a green suite and a broken site.

## Nothing has to be added to the build

`bun run build` and `bun run dev` both scan `src/routes/` for HTML, so a new directory is picked up with no edit to either script. `pageEntrypoints()` in `src/lib/tools.ts` still derives the same list from the registry, but only the tests read it — they check the directory and the registry agree. Nothing in any page's markup names another tool, so the registry stays the only list.
