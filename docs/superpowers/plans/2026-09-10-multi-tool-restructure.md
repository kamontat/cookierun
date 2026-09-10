# Multi-tool restructure implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn a single-tool site into a dashboard at `/` that lists tools, with the combi encoder moved to `/combi-name/` and its code moved from `src/` to `lib/combi-name/`.

**Architecture:** Six sequential tasks, each ending with a green test run and a commit. Files move with `git mv` so history follows them. A registry in `lib/shared/tools.ts` is the single source of truth for what tools exist; the dashboard and a consistency test both read it. Imports cross directories through a `#lib/*` subpath map declared in `package.json`.

**Tech Stack:** Bun 1.4.2 (runtime, test runner, bundler), TypeScript (`tsc --noEmit` only), happy-dom for DOM tests, Pico CSS 2.x for styling. No frameworks, no React.

**Spec:** `docs/superpowers/specs/2026-09-10-multi-tool-restructure-design.md`

## Global Constraints

- Default to Bun for everything: `bun test`, `bun run typecheck`, `bun run build`. Never npm, yarn, pnpm, node, jest, or vitest.
- Every page must stay a standalone HTML file that works offline from `file://`. Links between pages use `./<slug>/index.html` and `../index.html`, never directory-only URLs.
- The codec's wire format does not change. Do not touch `VERSION`, the character tables, or the hardcoded counts in the exhaustive test (1,769,472 combinations, 1,474,560 distinct codes).
- Cross-directory imports use `#lib/...`. Imports within one directory stay relative (`./codec.ts`).
- Tool slug is the one identifier: directory `web/<slug>/`, library namespace `lib/<slug>/`, URL `/<slug>/`. The slug for the existing tool is `combi-name`.
- Both `dev` and `build` scripts in `package.json` list every page entrypoint explicitly. Never use a glob — `sh` expands `**` as `*`, which silently drops `web/index.html`.
- `bunfig.toml` preloads `happydom.ts` for all tests, so `document` and `window` exist in every test file. Do not add per-file DOM setup.
- After every task: `bun test` and `bun run typecheck` both pass before committing.

---

### Task 1: Subpath imports and `src` → `lib/combi-name`

Pure move plus import rewrites. No behavior changes, so no new test — the existing 35 tests are the check, and they only pass if every import resolves.

**Files:**
- Modify: `package.json` (add `imports`, repoint `module`)
- Move: `src/` → `lib/combi-name/` (all 7 files)
- Modify: `web/main.ts:16,17,25` (three import specifiers)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `#lib/combi-name/codec.ts`, `#lib/combi-name/describe.ts`, `#lib/combi-name/labels.ts` resolve from anywhere in the repository. Every export keeps its current name and signature.

- [ ] **Step 1: Confirm the baseline is green before moving anything**

```bash
bun test
bun run typecheck
```

Expected: `35 pass`, `0 fail`; typecheck silent.

- [ ] **Step 2: Add the subpath import map to `package.json`**

Add an `imports` field and repoint `module`. The file becomes:

```json
{
  "name": "demo-cookierun-encode",
  "module": "lib/combi-name/codec.ts",
  "type": "module",
  "private": true,
  "packageManager": "bun@1.4.2",
  "imports": {
    "#lib/*": "./lib/*"
  },
  "scripts": {
    "dev": "bun web/index.html",
    "fetch-assets": "bun scripts/fetch-assets.ts",
    "build": "bun build --compile --target=browser web/index.html --outdir=dist --minify",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@happy-dom/global-registrator": "^20.14.3",
    "@types/bun": "latest"
  },
  "peerDependencies": {
    "typescript": "^7"
  }
}
```

No `tsconfig.json` change is needed. `moduleResolution: "bundler"` already reads `imports`.

- [ ] **Step 3: Move the directory**

```bash
mkdir -p lib
git mv src lib/combi-name
```

Imports *within* `lib/combi-name/` are relative (`./codec.ts`, `./labels.ts`) and stay exactly as they are.

- [ ] **Step 4: Repoint the three imports in `web/main.ts`**

Replace `"../src/codec.ts"` with `"#lib/combi-name/codec.ts"`, `"../src/describe.ts"` with `"#lib/combi-name/describe.ts"`, and `"../src/labels.ts"` with `"#lib/combi-name/labels.ts"`. Nothing else in that file changes.

- [ ] **Step 5: Verify the whole suite and the build**

```bash
bun test
bun run typecheck
bun run build
```

Expected: `35 pass`, `0 fail`; typecheck silent; build writes `dist/index.html`.

If a test fails with `Cannot find module "../src/..."`, a stale relative import was missed — grep for it:

```bash
grep -rn "src/" --include="*.ts" --include="*.html" lib web
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move the codec to lib/combi-name behind a #lib import map"
```

---

### Task 2: Move the combi page to `web/combi-name/`

The page keeps working exactly as it does today, at a new path. Note that with a single entrypoint the build still writes `dist/index.html` — Bun derives the output structure from the longest common prefix of the entrypoints, which is now `web/combi-name/`. Task 4 adds the dashboard entrypoint, and that is what pushes the tool page down to `dist/combi-name/index.html`.

**Files:**
- Move: `web/index.html`, `web/main.ts`, `web/main.test.ts` → `web/combi-name/`
- Move: `web/styles.css` → `web/shared/styles.css`
- Modify: `web/combi-name/index.html:15` (stylesheet href)
- Modify: `package.json` (`dev` and `build` entrypoints)

**Interfaces:**
- Consumes: `#lib/combi-name/*` from Task 1.
- Produces: the tool page at `web/combi-name/index.html`, and `web/shared/styles.css` as the one stylesheet both pages will link.

- [ ] **Step 1: Move the files**

```bash
mkdir -p web/combi-name web/shared
git mv web/index.html web/main.ts web/main.test.ts web/combi-name/
git mv web/styles.css web/shared/styles.css
```

`web/combi-name/main.test.ts` reads its page through `new URL("./index.html", import.meta.url)`, which is relative to the test file, so it needs no edit. `main.ts` imports through `#lib/...` after Task 1, so it needs no edit either.

- [ ] **Step 2: Run the tests to confirm the move alone broke nothing**

```bash
bun test
```

Expected: still `35 pass`. The tests assert DOM behavior, not CSS, so a wrong stylesheet path will not fail them. This is why the next step is verified by the build instead.

- [ ] **Step 3: Repoint the stylesheet in `web/combi-name/index.html`**

Line 15 becomes:

```html
    <link rel="stylesheet" href="../shared/styles.css" />
```

- [ ] **Step 4: Update both scripts in `package.json`**

```json
    "dev": "bun web/combi-name/index.html",
    "build": "bun build --compile --target=browser web/combi-name/index.html --outdir=dist --minify",
```

- [ ] **Step 5: Verify the build inlines the stylesheet from its new home**

```bash
bun test
bun run typecheck
bun run build
grep -c "code-output" dist/index.html
```

Expected: `35 pass`; typecheck silent; build succeeds; the grep prints a non-zero count, proving the CSS was found and inlined. A wrong path would make `bun build` fail outright with a resolution error, so a clean build is the real signal.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move the combi page to web/combi-name"
```

---

### Task 3: Tool registry

**Files:**
- Create: `lib/shared/tools.ts`
- Test: `lib/shared/tools.test.ts`

**Interfaces:**
- Consumes: the page location established in Task 2 (`web/combi-name/index.html`) and the script entrypoints from Task 2.
- Produces:
  - `type Tool = { readonly slug: string; readonly name: string; readonly tagline: string }`
  - `TOOLS: readonly Tool[]` — one entry per tool, currently just `combi-name`
  - `toolHref(slug: string): string` — returns `./<slug>/index.html`

- [ ] **Step 1: Write the failing test**

Create `lib/shared/tools.test.ts`:

```ts
import { expect, test } from "bun:test";

import { TOOLS, toolHref } from "./tools.ts";

const root = new URL("../../", import.meta.url);

test("tool slugs are unique", () => {
  const slugs = TOOLS.map((tool) => tool.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test("every registered tool has a page on disk", async () => {
  for (const { slug } of TOOLS) {
    const page = Bun.file(new URL(`web/${slug}/index.html`, root));
    expect(await page.exists()).toBe(true);
  }
});

// A registered tool that no script builds would ship as a dashboard card
// pointing at a page that was never written.
test("every tool page is an entrypoint of both the dev and build scripts", async () => {
  const { scripts } = (await Bun.file(new URL("package.json", root)).json()) as {
    scripts: Record<string, string>;
  };

  for (const { slug } of TOOLS) {
    const entrypoint = `web/${slug}/index.html`;
    expect(scripts.dev).toContain(entrypoint);
    expect(scripts.build).toContain(entrypoint);
  }
});

test("toolHref names the page file so file:// resolves it too", () => {
  expect(toolHref("combi-name")).toBe("./combi-name/index.html");
});
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
bun test lib/shared/tools.test.ts
```

Expected: FAIL, `Cannot find module './tools.ts'`.

- [ ] **Step 3: Write the registry**

Create `lib/shared/tools.ts`:

```ts
/**
 * The one place that knows what tools exist. The slug drives the library
 * namespace (`lib/<slug>/`), the page directory (`web/<slug>/`), and the URL,
 * so a tool cannot be registered under one name and served under another.
 */
export type Tool = {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
};

export const TOOLS = [
  {
    slug: "combi-name",
    name: "Combi name codes",
    tagline:
      "Pack a run configuration - type, episode, boosts, random boost, cookie power+, and action - into a 10-character combi name.",
  },
] as const satisfies readonly Tool[];

/**
 * Pages link to `./<slug>/index.html` rather than `./<slug>/`. A server
 * resolves both, but only the explicit filename works when the standalone
 * build is opened from the filesystem.
 */
export function toolHref(slug: string): string {
  return `./${slug}/index.html`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
bun test lib/shared/tools.test.ts
bun test
bun run typecheck
```

Expected: 4 new tests pass; the full suite reports `39 pass`, `0 fail`; typecheck silent.

- [ ] **Step 5: Commit**

```bash
git add lib/shared/tools.ts lib/shared/tools.test.ts
git commit -m "Add a tool registry as the source of truth for what the site serves"
```

---

### Task 4: Dashboard page

**Files:**
- Create: `web/index.html`, `web/dashboard.ts`
- Test: `web/dashboard.test.ts`
- Modify: `web/combi-name/index.html` (back link in the masthead)
- Modify: `lib/shared/tools.test.ts` (add the back-link assertion)
- Modify: `package.json` (add the dashboard entrypoint to both scripts)

**Interfaces:**
- Consumes: `TOOLS` and `toolHref` from `#lib/shared/tools.ts` (Task 3).
- Produces: `dist/index.html` (dashboard) and `dist/combi-name/index.html` (tool) from one build.

- [ ] **Step 1: Write the failing test**

Create `web/dashboard.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/shared/tools.ts";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();
const body = page.slice(
  page.indexOf("<body>") + "<body>".length,
  page.indexOf("</body>"),
);

// Append rather than replace: every test file shares one happy-dom document,
// and web/combi-name/main.test.ts looks its elements up by id at test time.
const holder = document.createElement("div");
holder.innerHTML = body;
document.body.append(holder);

await import("./dashboard.ts");

const cards = holder.querySelectorAll("#tools article");

test("the dashboard renders one card per registered tool", () => {
  expect(cards.length).toBe(TOOLS.length);
});

test("each card links to its tool page and carries its name and tagline", () => {
  TOOLS.forEach((tool, index) => {
    const card = cards[index];
    const link = card?.querySelector("a");

    expect(link?.getAttribute("href")).toBe(`./${tool.slug}/index.html`);
    expect(link?.textContent).toBe(tool.name);
    expect(card?.textContent).toContain(tool.tagline);
  });
});
```

- [ ] **Step 2: Run it to make sure it fails**

```bash
bun test web/dashboard.test.ts
```

Expected: FAIL — the file `web/index.html` does not exist, so `Bun.file(...).text()` rejects with `ENOENT`.

- [ ] **Step 3: Write the dashboard markup**

Create `web/index.html`. Containers stay empty on purpose; `dashboard.ts` fills them from the registry:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cookie Run tools</title>
    <meta
      name="description"
      content="Small browser tools for Cookie Run. Everything runs in your browser and works offline."
    />
    <link
      rel="icon"
      href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>%F0%9F%8D%AA</text></svg>"
    />
    <link rel="stylesheet" href="./shared/styles.css" />
    <script src="./dashboard.ts" type="module"></script>
  </head>
  <body>
    <header class="masthead">
      <h1>Cookie Run tools</h1>
      <p>
        Small tools for things the game does not write down for you. Each one
        runs entirely in your browser - nothing is sent anywhere, and every page
        works offline.
      </p>
    </header>

    <main>
      <div id="tools" class="tools"></div>
    </main>

    <footer>
      <p>Built with Bun. No network calls, no analytics.</p>
    </footer>
  </body>
</html>
```

- [ ] **Step 4: Write the dashboard script**

Create `web/dashboard.ts`:

```ts
import { TOOLS, toolHref } from "#lib/shared/tools.ts";

function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}

const toolsHost = need("tools");

toolsHost.replaceChildren(
  ...TOOLS.map(({ slug, name, tagline }) => {
    const link = document.createElement("a");
    link.href = toolHref(slug);
    link.textContent = name;

    const heading = document.createElement("h2");
    heading.append(link);

    const description = document.createElement("p");
    description.textContent = tagline;

    const card = document.createElement("article");
    card.append(heading, description);
    return card;
  }),
);
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun test web/dashboard.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Add the back link to the tool page**

In `web/combi-name/index.html`, inside `<header class="masthead">`, add a link as the first child, above the `<h1>`:

```html
    <header class="masthead">
      <p class="backlink"><a href="../index.html">&larr; All tools</a></p>
      <h1>Cookie Run combi codes</h1>
```

- [ ] **Step 7: Assert the back link exists, in `lib/shared/tools.test.ts`**

Append this test to the file:

```ts
test("every tool page links back to the dashboard", async () => {
  for (const { slug } of TOOLS) {
    const page = await Bun.file(
      new URL(`web/${slug}/index.html`, root),
    ).text();
    expect(page).toContain('href="../index.html"');
  }
});
```

- [ ] **Step 8: Add the dashboard entrypoint to both scripts**

In `package.json`, the dashboard comes first so it lands at the site root:

```json
    "dev": "bun web/index.html web/combi-name/index.html",
    "build": "bun build --compile --target=browser web/index.html web/combi-name/index.html --outdir=dist --minify",
```

- [ ] **Step 9: Verify the whole site builds to two standalone pages**

```bash
bun test
bun run typecheck
rm -rf dist
bun run build
find dist -type f
```

Expected: `42 pass`, `0 fail`; typecheck silent; `find` prints exactly `dist/index.html` and `dist/combi-name/index.html`.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add a dashboard that lists the tools from the registry"
```

---

### Task 5: Replace the stylesheet with Pico

Behavior does not change, so no new test. The DOM tests assert behavior rather than appearance and will not catch a visual regression — check both pages in a browser before committing.

**Files:**
- Modify: `package.json` (dependency), `bun.lock`
- Rewrite: `web/shared/styles.css` (289 lines → roughly 45)
- Modify: `web/index.html`, `web/combi-name/index.html` (add Pico's `container` class)

**Interfaces:**
- Consumes: both pages and the shared stylesheet from Tasks 2 and 4.
- Produces: nothing other tasks import.

- [ ] **Step 1: Install Pico**

```bash
bun add @picocss/pico
```

Expected: `installed @picocss/pico@2.x`.

- [ ] **Step 2: Rewrite `web/shared/styles.css`**

Replace the entire file with the Pico import plus only what Pico has no opinion about. Every custom property below is defined by Pico 2.x — do not invent new ones, and do not reintroduce the old `--bg`/`--ink`/`--accent` palette, since Pico's light and dark themes now own the colors:

```css
@import "@picocss/pico/css/pico.amber.min.css";

/* Panels sit side by side and wrap on narrow screens; the legend spans. */
main {
  display: grid;
  gap: var(--pico-block-spacing-horizontal);
  grid-template-columns: repeat(auto-fit, minmax(20rem, 1fr));
  align-items: start;
}

.legend,
.tools {
  grid-column: 1 / -1;
}

.tools {
  display: grid;
  gap: var(--pico-block-spacing-horizontal);
  grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
}

.backlink {
  margin-bottom: 0.25rem;
  font-size: 0.9rem;
}

.code-output {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

.code {
  flex: 1 1 auto;
  padding: 0.6rem 0.75rem;
  border: 1px dashed var(--pico-muted-border-color);
  border-radius: var(--pico-border-radius);
  font-family: var(--pico-font-family-monospace);
  font-size: clamp(1.25rem, 5vw, 1.75rem);
  letter-spacing: 0.16em;
  user-select: all;
}

.code-input {
  font-family: var(--pico-font-family-monospace);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.status {
  min-height: 1.4rem;
  color: var(--pico-muted-color);
  font-size: 0.9rem;
}

.status.error {
  color: var(--pico-del-color);
}

.warnings {
  padding: 0;
  list-style: none;
}

.warnings li {
  padding: 0.5rem 0.65rem;
  border-radius: var(--pico-border-radius);
  background: var(--pico-mark-background-color);
  color: var(--pico-mark-color);
  font-size: 0.9rem;
}

.rows {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 0.35rem 1rem;
}

.rows dt {
  color: var(--pico-muted-color);
}

.rows dd {
  margin: 0;
}

.diagram {
  overflow-x: auto;
  font-size: 0.85rem;
}

.checks label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
```

- [ ] **Step 3: Add Pico's container class to both pages**

Pico centers and pads content through `.container`. In `web/index.html` and `web/combi-name/index.html`, change the three top-level elements:

```html
<header class="masthead container">
<main class="container">
<footer class="container">
```

Keep every existing `id` and every other class — `main.ts`, `dashboard.ts`, and the tests look elements up by id, and `.panel`, `.legend`, `.tools`, `.checks`, `.code`, `.code-input`, `.code-output`, `.status`, `.verdict`, `.warnings`, `.rows`, `.diagram`, and `.backlink` are all still styled above.

- [ ] **Step 4: Verify tests, types, and build**

```bash
bun test
bun run typecheck
rm -rf dist
bun run build
ls -l dist/index.html dist/combi-name/index.html
```

Expected: `42 pass`, `0 fail`; typecheck silent; both files exist at roughly 85 KB each. A failure here means the `@import` did not resolve — check that `@picocss/pico` is in `dependencies`.

- [ ] **Step 5: Look at both pages in a browser**

```bash
bun run dev
```

Open `http://localhost:3000/` and `http://localhost:3000/combi-name/`. Confirm: the dashboard shows one card, the back link returns to it, the builder and reader panels sit side by side on a wide window, the code display is monospace and legible, and an unreadable code (type `1Z0---000-` into the reader) shows its error in red. Stop the server with Ctrl-C.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Style both pages with Pico instead of a hand-written sheet"
```

---

### Task 6: Documentation

**Files:**
- Modify: `AGENTS.md` (Architecture, Commands, Web build sections)
- Modify: `README.md` (Usage import path, Web app section)

**Interfaces:**
- Consumes: the final layout from Tasks 1-5.
- Produces: nothing code depends on.

- [ ] **Step 1: Update `AGENTS.md`**

Make these edits:

1. In **Commands**, `bun run dev` now serves two pages — note that `/` is the dashboard and `/combi-name/` is the combi tool.
2. In **Architecture**, replace every `src/codec.ts`, `src/labels.ts`, `src/describe.ts` reference with `lib/combi-name/...`, and replace `web/main.ts` / `web/index.html` with `web/combi-name/main.ts` / `web/combi-name/index.html`.
3. Add a short subsection under **Architecture** stating: cross-directory imports go through `#lib/*`, declared in `package.json#imports`; `lib/shared/` holds code more than one tool uses; `lib/<slug>/` holds one tool's code.
4. Add a subsection **Adding a tool** listing the four steps, in this order:
   - add an entry to `TOOLS` in `lib/shared/tools.ts`;
   - create `web/<slug>/index.html` with a `../index.html` back link;
   - create `lib/<slug>/` for its logic;
   - add `web/<slug>/index.html` to both the `dev` and `build` scripts in `package.json`.
   Note that `lib/shared/tools.test.ts` fails until the page exists and both scripts list it.
5. In **Web build**, state that the build takes one entrypoint per page and writes one self-contained file per page, `dist/index.html` and `dist/combi-name/index.html`, and that a glob must not be used because `sh` expands `**` as `*`.
6. Add a line that `web/shared/styles.css` imports Pico (amber) and holds only the overrides Pico has no opinion about; colors come from Pico's custom properties, not a local palette.

- [ ] **Step 2: Update `README.md`**

1. In **Usage**, change the import to:

```ts
import { encode, decode, isSemiAuto } from "./lib/combi-name/codec.ts";
```

2. In **Web app**, add a sentence before the existing description: the site is a dashboard at the root listing the tools, and the combi builder lives at `/combi-name/`. Update the link to `<https://kamontat.github.io/cookierun/combi-name/>` and keep the root URL as the dashboard.

- [ ] **Step 3: Verify no stale paths remain**

```bash
grep -rn "src/codec\|src/labels\|src/describe\|web/main.ts\|web/styles.css" README.md AGENTS.md CLAUDE.md
```

Expected: no output. Any hit is a path that no longer exists.

- [ ] **Step 4: Final full check**

```bash
bun test
bun run typecheck
bun run build
```

Expected: `42 pass`, `0 fail`; typecheck silent; build writes both pages.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md README.md
git commit -m "Document the multi-tool layout"
```
