---
name: adding-a-page
description: Use when adding a new HTML page or tool under src/routes/ (a new src/routes/<slug>/ entry in the TOOLS registry), or when an existing page fails src/lib/tools.test.ts, paints unstyled, never upgrades its custom elements, 404s after deploy, or renders a sidebar whose links point at the wrong directory.
---

# Adding a page

Every page is a tool: a `src/routes/<slug>/index.html` directory with an entry in the `TOOLS` registry. The home pane, `src/routes/index.html`, is the one page that is not.

1. Add an entry to `TOOLS` in `src/lib/tools.ts`.
2. Create `src/routes/<slug>/index.html`: `<a class="skip-link" href="#content">Skip to content</a>` then `<site-nav current="<slug>"></site-nav>` as the first two body children, a `<script id="theme-boot">` block copied from an existing page's head above the stylesheet link, `<link rel="stylesheet" href="./index.css" />`, `<script src="./index.ts" type="module"></script>`, `<main id="content" class="container" tabindex="-1">`, `<site-footer></site-footer>` as the last body child, and the `container` class on `header` too. The skip link matters because the sidebar comes first in the DOM.
3. Create `src/routes/<slug>/index.css` starting with `@import "../base.css";`. That import is what gives the page the reset, the tokens, the body grid, and the sidebar rail; it carries no component styling — each custom element carries its own inside its shadow root. A sheet holding nothing else is fine — the base sheet is its own file, so no route's stylesheet can collide with it.
4. Create `src/routes/<slug>/index.ts` and import the components the page declares, so their `customElements.define` calls run.

5. Use **relative** paths for every asset and link (`./index.css`, `../assets/...`). Bun bundles only what a document references, and relative links keep `dist/` free of any base-path assumption. Cross-page links go through `hrefFor` (see the `ui-components` skill), never a hand-written or root-relative href.
6. Run `bun run build` and confirm the page appears in the build output list, then `bun run preview` (port 4000) and open it. A built page links its chunks relatively, so a wrong link shape loads the HTML unstyled and with no components — the browser is the only check for that.

That is the whole list — no script names a page. See "Nothing has to be added to the build" below.

## What the tests do and don't catch

`src/lib/tools.test.ts` fails until the page exists, links `./index.css`, has a stylesheet that imports the base sheet, hosts `<site-nav>` carrying its own slug as `current`, hosts `<site-footer>`, loads `./index.ts`, and carries the skip link and the theme bootstrap. It fails in the other direction too: a page under `src/routes/` with no entry in `TOOLS` is a page the build ships and no sidebar links to, so step 1 cannot be skipped by writing only the files.

What no test checks is the rest of step 2: a page missing the `container` classes or the `tabindex` on `<main>` is merely ugly, and nothing catches it. The two failures that are silent and total — a page that never upgrades its elements, and a tool page whose sidebar links all point at the wrong directory — are the two the tests above do cover, because the alternative is a green suite and a broken site.

## Nothing has to be added to the build

`bun run build` and `bun run dev` both scan `src/routes/` for HTML, so a new directory is picked up with no edit to either script. `pageEntrypoints()` in `src/lib/tools.ts` still derives the same list from the registry, but only the tests read it — they check the directory and the registry agree. Nothing in any page's markup names another tool, so the registry stays the only list.
