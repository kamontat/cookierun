# Routes and Web Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the project by route, turn every reusable piece of UI into a light-DOM custom element, move the npm scripts into `scripts/*.ts`, and pin every dependency to an exact version — without changing the combi-name wire format.

**Architecture:** `lib/` holds code more than one route uses. `components/` holds every custom element; it imports from `lib/` and never from `routes/`. `routes/<slug>/` holds one route's markup, stylesheet, page script, and route-only logic. `scripts/*.ts` holds each npm script. The encoding tables, the slot layout, and `VERSION` are carried across untouched.

**Tech Stack:** Bun 1.4.2, TypeScript 7.0.2, Pico CSS 2.1.1 (amber), happy-dom via `@happy-dom/global-registrator`, native custom elements (no framework, no shadow DOM).

**Spec:** `docs/superpowers/specs/2026-09-11-routes-and-web-components-design.md`

## Global Constraints

- **Runtime is Bun, not Node.** `bun <file>`, `bun test`, `bun build`, `bunx <pkg>`. Prefer `Bun.file`/`Bun.write` over `node:fs` and `Bun.$` over shelling through a library.
- **The wire format does not change.** `VERSION` stays `1`. No character table gains, loses, or reorders a key. `routes/combi-name/exhaustive.test.ts` must keep passing with its counts written exactly as `6 * 12 * 8 * 12 * 128 * 2` (1,769,472 combinations checked) and `5 * 12 * 8 * 12 * 128 * 2` (1,474,560 distinct codes).
- **Light DOM only.** No component calls `attachShadow`. Pico styles by element selector and the two form components need `<form>` participation and label association.
- **`components/` never imports from `routes/`.** Dependency arrows point from `routes/` into `components/` and `lib/` only.
- **Every `customElements.define` is guarded** by `if (!customElements.get(name))`. One `bun test` process shares one registry across all test files.
- **Every dependency is an exact version.** No `^`, no `~`, no `latest`. `bunfig.toml` sets `[install] exact = true`.
- **`packageManager` stays `bun@1.4.2`**, in sync with `mise.toml`. `oven-sh/setup-bun` reads it.
- **Cross-directory imports use subpaths**: `#lib/*` and `#components/*`. Files inside one route import their siblings relatively.
- **Every page's markup must carry**, in this order as the first two body children: `<a class="skip-link" href="#content">Skip to content</a>` then `<site-nav>`. Plus `<main id="content" class="container" tabindex="-1">`, a `<script id="theme-boot">` block in the head above the stylesheet link, and Pico's `container` class on `header` and `footer`.
- **Commit after every task.** Never commit a red suite.

---

## File Structure

Files created or modified across the whole plan, with the task that does it.

| File | Responsibility | Task |
| --- | --- | --- |
| `package.json` | exact deps, `#components/*` subpath, script delegations | 1, 2, 8 |
| `bunfig.toml` | test preload (unchanged), `[install] exact = true` | 1 |
| `scripts/test.ts` | run `bun test`, forward args, propagate exit code | 2 |
| `scripts/typecheck.ts` | run `bunx tsc --noEmit`, propagate exit code | 2 |
| `scripts/dev.ts` | `Bun.serve()` dev server, routes from the registry | 8 |
| `scripts/build.ts` | one self-contained page per registry entry | 8 |
| `scripts/fetch-assets.ts` | unchanged | — |
| `lib/tools.ts` | `Tool`, `TOOLS`, `ToolSlug`, `pageEntrypoints()` | 3, 8 |
| `lib/tools.test.ts` | registry invariants and per-page markup guards | 3, 4, 5, 8 |
| `lib/href.ts` | `hrefFor()` — the only place that writes a cross-page link | 4 |
| `lib/href.test.ts` | all four depth x protocol combinations | 4 |
| `components/theme-toggle.ts` | `<theme-toggle>`, `readTheme`, `writeTheme`, `applyTheme`, `renderThemeControl` | 4 |
| `components/site-nav.ts` | `<site-nav>` — the sidebar, including the theme control | 4 |
| `components/tool-index.ts` | `<tool-index>` — the home pane's annotated tool list | 5 |
| `components/labelled-select.ts` | `<labelled-select>` — label plus select over `[value, label]` pairs | 6 |
| `components/check-group.ts` | `<check-group>` — fieldset of checkboxes, canonical read-back order | 6 |
| `components/copy-code.ts` | `<copy-code>` — the code, a copy button, a status line | 7 |
| `components/auto-verdict.ts` | `<auto-verdict>` — the auto/semi-auto sentence | 7 |
| `routes/index.html` | home pane markup | 8 |
| `routes/index.css` | base stylesheet: Pico, layout, every component's rules | 8 |
| `routes/index.ts` | registers the home pane's components | 8 |
| `routes/combi-name/index.html` | combi tool markup | 8 |
| `routes/combi-name/index.css` | `@import "../index.css"` plus page-only rules | 8 |
| `routes/combi-name/index.ts` | wires the components to the codec; exports `need()` | 8 |
| `routes/combi-name/index.test.ts` | the seven page-behaviour tests | 8 |
| `routes/combi-name/codec.ts` + test | character tables, `encode`, `decode`, `isSemiAuto` | 9 |
| `routes/combi-name/labels.ts` + test | display names | 9 |
| `routes/combi-name/describe.ts` + test | `describeCombi`, `AutoVerdict` | 9 |
| `routes/combi-name/exhaustive.test.ts` | round-trips the whole configuration space | 9 |
| `AGENTS.md` | rewritten | 10 |
| `README.md` | path references | 10 |

Deleted by the end: `web/` entirely, `lib/shared/`, `lib/combi-name/`.

---

### Task 1: Pin every dependency exact

**Files:**
- Modify: `package.json:17-25`
- Modify: `bunfig.toml`
- Modify: `bun.lock` (regenerated)

**Interfaces:**
- Consumes: nothing.
- Produces: nothing importable. Later tasks rely on `bun install` no longer widening a version.

The installed versions are already known: `@happy-dom/global-registrator@20.14.3`, `@picocss/pico@2.1.1`, `@types/bun@1.4.2`, `typescript-language-server@6.0.0`, `typescript@7.0.2`. Pinning to those is a no-op for what is on disk — the point is that the next `bun install` cannot drift. `@types/bun` was `latest`, which is not a version at all.

- [ ] **Step 1: Pin the versions in `package.json`**

Replace the `devDependencies` and `peerDependencies` blocks with:

```json
  "devDependencies": {
    "@happy-dom/global-registrator": "20.14.3",
    "@picocss/pico": "2.1.1",
    "@types/bun": "1.4.2",
    "typescript-language-server": "6.0.0"
  },
  "peerDependencies": {
    "typescript": "7.0.2"
  }
```

- [ ] **Step 2: Make future installs exact**

Add an `[install]` table to `bunfig.toml`, leaving the existing `[test]` table alone:

```toml
[test]
preload = ["./tests/happydom.ts"]

[install]
# A range here would quietly widen on the next install and the whole point of
# the pinned versions above is that it cannot.
exact = true
```

- [ ] **Step 3: Regenerate the lockfile**

Run: `bun install`
Expected: no version changes reported, `bun.lock` updated to record the exact specifiers.

- [ ] **Step 4: Verify CI's install path still works**

Run: `bun install --frozen-lockfile`
Expected: exits 0. This is the command `.github/workflows/deploy.yml` runs, and it fails if `package.json` and `bun.lock` disagree.

- [ ] **Step 5: Verify nothing broke**

Run: `bun test && bun run typecheck`
Expected: full suite passes, typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add package.json bunfig.toml bun.lock
git commit -m "Pin the dependencies to the versions actually installed"
```

---

### Task 2: Move `test` and `typecheck` into `scripts/`

**Files:**
- Create: `scripts/test.ts`
- Create: `scripts/typecheck.ts`
- Modify: `package.json:10-16`

**Interfaces:**
- Consumes: nothing.
- Produces: the `Bun.$` array-interpolation and exit-code pattern that `scripts/build.ts` and `scripts/dev.ts` reuse in Task 8.

These two scripts are path-independent, so they can move before anything else does. They are also where the `Bun.$` behaviour the later scripts depend on gets proven: whether an interpolated array becomes separate arguments, and whether an empty array becomes no arguments at all.

`bun scripts/typecheck.ts` does not get `node_modules/.bin` on its `PATH` the way an npm-style script does, so `tsc` has to be invoked through `bunx`.

- [ ] **Step 1: Confirm how `Bun.$` interpolates an array**

Run:

```bash
bun -e 'import{$}from"bun";const a=["-t","two words"];await $`echo ${a}`;const e=[];await $`echo start ${e} end`'
```

Expected: first line prints `-t two words` (two arguments, the second kept whole), second line prints `start end` with no extra blank argument. If either is wrong, stop and read `node_modules/bun-types/docs/runtime/shell.mdx` before writing the scripts — the rest of this task and Task 8 assume this behaviour.

- [ ] **Step 2: Write `scripts/test.ts`**

```ts
/**
 * `bun test` by way of a file, so package.json holds a delegation rather than
 * a command. Arguments are forwarded, which is what keeps `bun run test -t
 * "decodes every slot"` working, and the child's exit code is propagated so a
 * failing suite still fails CI.
 */
import { $ } from "bun";

const { exitCode } = await $`bun test ${Bun.argv.slice(2)}`.nothrow();

process.exit(exitCode);
```

- [ ] **Step 3: Write `scripts/typecheck.ts`**

```ts
/**
 * `bunx`, not a bare `tsc`: running this file directly does not put
 * node_modules/.bin on PATH the way an npm-style script does.
 */
import { $ } from "bun";

const { exitCode } = await $`bunx tsc --noEmit ${Bun.argv.slice(2)}`.nothrow();

process.exit(exitCode);
```

- [ ] **Step 4: Delegate from `package.json`**

Change the two entries, leaving `dev`, `build`, and `fetch-assets` alone for now:

```json
    "test": "bun scripts/test.ts",
    "typecheck": "bun scripts/typecheck.ts"
```

- [ ] **Step 5: Verify both scripts, including argument forwarding**

Run: `bun run typecheck`
Expected: exits 0, no output.

Run: `bun run test`
Expected: the full suite passes.

Run: `bun run test -t "decodes every slot"`
Expected: runs a subset, not the whole suite — proof the arguments got through.

- [ ] **Step 6: Verify a failure still fails**

`.nothrow()` stops `Bun.$` from throwing, so the exit code has to be forwarded
by hand — and if it were not, a red suite would look green to CI. Prove it with
a command that is certain to fail:

```bash
bun run typecheck --thisFlagDoesNotExist; echo "exit=$?"
```

Expected: `tsc` reports the unknown option and the last line prints a non-zero
`exit=`. If it prints `exit=0`, `process.exit(exitCode)` is missing or the
`.nothrow()` result is being ignored.

- [ ] **Step 7: Commit**

```bash
git add scripts/test.ts scripts/typecheck.ts package.json
git commit -m "Keep the test and typecheck commands in files, not in package.json"
```

---

### Task 3: `lib/shared/tools.ts` becomes `lib/tools.ts`

**Files:**
- Move: `lib/shared/tools.ts` to `lib/tools.ts`
- Move: `lib/shared/tools.test.ts` to `lib/tools.test.ts`
- Modify: `lib/tools.ts:1-5` (the doc comment names directories)
- Modify: `lib/tools.test.ts:3,5` (import path and the root URL)
- Modify: `web/dev.ts:3`, `web/shared/chrome.ts:1`, `web/shared/chrome.test.ts:5`

**Interfaces:**
- Consumes: nothing.
- Produces: `#lib/tools.ts` exporting `type Tool`, `TOOLS`, `type ToolSlug`. Every later task imports the registry from this path. `#lib/shared/tools.ts` stops existing.

`lib/shared/` held exactly one module. With route-only logic moving out of `lib/` in Task 9, the `shared` level buys nothing, and flattening it now means later tasks only ever write one registry path.

- [ ] **Step 1: Move both files**

```bash
git mv lib/shared/tools.ts lib/tools.ts
git mv lib/shared/tools.test.ts lib/tools.test.ts
rmdir lib/shared
```

- [ ] **Step 2: Fix the test's own import and root URL**

`lib/tools.test.ts` sat two directories deep and now sits one. Change line 3 from `from "./tools.ts"` — it is already correct, the file moved with it — and change line 5:

```ts
const root = new URL("../", import.meta.url);
```

- [ ] **Step 3: Update the three importers**

In `web/dev.ts:3`, `web/shared/chrome.ts:1`, and `web/shared/chrome.test.ts:5`, change:

```ts
from "#lib/shared/tools.ts"
```

to:

```ts
from "#lib/tools.ts"
```

- [ ] **Step 4: Refresh the registry's doc comment**

The comment at `lib/tools.ts:1-5` claims the slug drives `lib/<slug>/`, which stops being true in Task 9. Replace it now so it is not wrong in between:

```ts
/**
 * The one place that knows what tools exist. The slug drives the route
 * directory and the URL, so a tool cannot be registered under one name and
 * served under another.
 */
```

- [ ] **Step 5: Verify**

Run: `bun run test && bun run typecheck`
Expected: everything passes. `lib/tools.test.ts` still asserts `web/<slug>/index.html` exists, which it does — the pages have not moved yet.

- [ ] **Step 6: Commit**

```bash
git add -A lib web
git commit -m "Flatten the tool registry out of lib/shared"
```

---

### Task 4: `<site-nav>` and `<theme-toggle>`, with `hrefFor` in `lib/`

**Files:**
- Create: `lib/href.ts`
- Create: `lib/href.test.ts`
- Create: `components/theme-toggle.ts`
- Create: `components/theme-toggle.test.ts`
- Create: `components/site-nav.ts`
- Create: `components/site-nav.test.ts`
- Modify: `package.json` (add the `#components/*` subpath)
- Modify: `web/shared/chrome.ts` (loses `hrefFor` and `renderSidebar`)
- Modify: `web/shared/chrome.test.ts` (loses the `hrefFor` and sidebar cases)
- Delete: `web/shared/theme.ts`, `web/shared/theme.test.ts`
- Modify: `web/index.html:29`, `web/combi-name/index.html:29`
- Modify: `web/home.ts`, `web/combi-name/main.ts:27-31`
- Modify: `web/shared/styles.css` (sidebar and theme rules become element selectors)
- Modify: `lib/tools.test.ts` (the sidebar markup assertion)

**Interfaces:**
- Consumes: `TOOLS`, `ToolSlug` from `#lib/tools.ts` (Task 3).
- Produces:
  - `#lib/href.ts`: `hrefFor(target: ToolSlug | null, from: ToolSlug | null, protocol?: string): string`
  - `#components/theme-toggle.ts`: `type Theme = "system" | "light" | "dark"`, `THEME_KEY = "theme"`, `readTheme(storage)`, `writeTheme(theme, storage)`, `applyTheme(theme, root)`, `renderThemeControl(host, root?, storage?)`, `class ThemeToggle`, element `<theme-toggle>`
  - `#components/site-nav.ts`: `class SiteNav`, element `<site-nav current?="<slug>">`. Renders its own `<theme-toggle>`.

Today `renderSidebar` leaves an empty `#theme` element and each page then calls `renderThemeControl(need("theme"))` — an ordering `AGENTS.md` has to flag as not optional. `<site-nav>` renders the toggle as one of its own children, so both the empty slot and the ordering rule disappear.

`renderThemeControl` survives as an exported function even though `<theme-toggle>` exists, because the storage-refused test needs to call it directly. A custom element's `connectedCallback` reports exceptions to the global error handler rather than throwing to whoever appended the element, so `expect(() => append(el)).not.toThrow()` would pass whether or not the code is actually safe. Calling the function proves it.

- [ ] **Step 1: Add the `#components/*` subpath**

In `package.json`:

```json
  "imports": {
    "#lib/*": "./lib/*",
    "#components/*": "./components/*"
  },
```

- [ ] **Step 2: Write the failing test for `lib/href.ts`**

Create `lib/href.test.ts`:

```ts
import { expect, test } from "bun:test";

import { hrefFor } from "./href.ts";

test("links from the home page stay in the current directory", () => {
  expect(hrefFor(null, null, "https:")).toBe("./");
  expect(hrefFor("combi-name", null, "https:")).toBe("./combi-name/");
});

// A tool page sits one directory down, so the same list has to be written
// differently there. Getting this wrong is a 404 on every link but one.
test("links from a tool page climb out of it first", () => {
  expect(hrefFor(null, "combi-name", "https:")).toBe("../");
  expect(hrefFor("combi-name", "combi-name", "https:")).toBe("../combi-name/");
});

// Directory links need something to serve the index. Opened from disk there
// is no server, so the filename goes back on rather than the link dying.
test("links keep the filename when the page is opened from disk", () => {
  expect(hrefFor(null, null, "file:")).toBe("./index.html");
  expect(hrefFor("combi-name", null, "file:")).toBe("./combi-name/index.html");
  expect(hrefFor(null, "combi-name", "file:")).toBe("../index.html");
  expect(hrefFor("combi-name", "combi-name", "file:")).toBe(
    "../combi-name/index.html",
  );
});

test("links stay relative so a project subpath still resolves", () => {
  for (const from of [null, "combi-name"] as const) {
    for (const target of [null, "combi-name"] as const) {
      for (const protocol of ["https:", "file:"]) {
        expect(hrefFor(target, from, protocol).startsWith("/")).toBe(false);
      }
    }
  }
});
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `bun run test lib/href.test.ts`
Expected: FAIL — cannot resolve `./href.ts`.

- [ ] **Step 4: Write `lib/href.ts`**

Move the function across verbatim, comment included:

```ts
import type { ToolSlug } from "./tools.ts";

/**
 * Links are written as directories - `./combi-name/`, `../` - so a served site
 * shows `/combi-name` rather than a filename. Nothing serves a directory index
 * when the standalone build is opened straight from disk, though, so under
 * `file:` the filename goes back on. Relative either way: GitHub Pages puts the
 * site under a project subpath, where a root-relative `/combi-name` would miss.
 *
 * Every page renders the same list from a different depth - the home page at
 * the root, a tool page one directory down - so the prefix is explicit.
 */
export function hrefFor(
  target: ToolSlug | null,
  from: ToolSlug | null,
  protocol: string = globalThis.location?.protocol ?? "https:",
): string {
  const directory = `${from === null ? "./" : "../"}${target === null ? "" : `${target}/`}`;
  return protocol === "file:" ? `${directory}index.html` : directory;
}
```

- [ ] **Step 5: Run it to make sure it passes**

Run: `bun run test lib/href.test.ts`
Expected: 4 pass.

- [ ] **Step 6: Write the failing test for `<theme-toggle>`**

Create `components/theme-toggle.test.ts`. The first six cases are the existing `web/shared/theme.test.ts` cases with the import repointed; the last is new and covers the element.

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import {
  applyTheme,
  readTheme,
  renderThemeControl,
  writeTheme,
  THEME_KEY,
} from "./theme-toggle.ts";

function fakeStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    read: () => store.get(THEME_KEY) ?? null,
  };
}

function hostAndRoot() {
  return {
    host: document.createElement("div"),
    root: document.createElement("html"),
  };
}

test("an unset or unrecognised choice falls back to following the system", () => {
  expect(readTheme(fakeStorage())).toBe("system");
  expect(readTheme(fakeStorage({ [THEME_KEY]: "sepia" }))).toBe("system");
  expect(readTheme(fakeStorage({ [THEME_KEY]: "dark" }))).toBe("dark");
});

// Pico reads prefers-color-scheme only when the attribute is absent, so
// "system" has to remove it rather than write some third value.
test("applying system removes the attribute instead of setting one", () => {
  const root = document.createElement("html");

  applyTheme("dark", root);
  expect(root.getAttribute("data-theme")).toBe("dark");

  applyTheme("system", root);
  expect(root.hasAttribute("data-theme")).toBe(false);
});

test("system is stored as the absence of a choice", () => {
  const storage = fakeStorage({ [THEME_KEY]: "light" });

  writeTheme("dark", storage);
  expect(storage.read()).toBe("dark");

  writeTheme("system", storage);
  expect(storage.read()).toBe(null);
});

// Called as a function on purpose. A custom element reports a callback
// exception to the global error handler rather than throwing to whoever
// appended it, so going through <theme-toggle> here would pass either way.
test("a browser that refuses storage still themes the page", () => {
  const hostile = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  const { host, root } = hostAndRoot();

  expect(readTheme(hostile)).toBe("system");
  expect(() => writeTheme("dark", hostile)).not.toThrow();
  expect(() => renderThemeControl(host, root, hostile)).not.toThrow();
});

test("the control offers the three choices and starts on the stored one", () => {
  const { host, root } = hostAndRoot();
  const storage = fakeStorage({ [THEME_KEY]: "light" });

  renderThemeControl(host, root, storage);
  const select = host.querySelector("select")!;

  expect([...select.options].map((option) => option.value)).toEqual([
    "system",
    "light",
    "dark",
  ]);
  expect(select.value).toBe("light");
  expect(root.getAttribute("data-theme")).toBe("light");
  expect(host.querySelector("label")?.htmlFor).toBe(select.id);
});

test("choosing a theme paints the page and remembers it", () => {
  const { host, root } = hostAndRoot();
  const storage = fakeStorage();

  renderThemeControl(host, root, storage);
  const select = host.querySelector("select")!;

  select.value = "dark";
  select.dispatchEvent(new Event("change"));

  expect(root.getAttribute("data-theme")).toBe("dark");
  expect(storage.read()).toBe("dark");

  select.value = "system";
  select.dispatchEvent(new Event("change"));

  expect(root.hasAttribute("data-theme")).toBe(false);
  expect(storage.read()).toBe(null);
});

test("the element renders the control when it is connected", () => {
  document.body.replaceChildren();
  document.body.append(document.createElement("theme-toggle"));

  const select = document.body.querySelector("theme-toggle select");
  expect(select).not.toBeNull();
});
```

- [ ] **Step 7: Run it to make sure it fails**

Run: `bun run test components/theme-toggle.test.ts`
Expected: FAIL — cannot resolve `./theme-toggle.ts`.

- [ ] **Step 8: Write `components/theme-toggle.ts`**

```ts
/**
 * Pico paints light by default, dark under `prefers-color-scheme`, and obeys
 * `data-theme` on the root over both. So the whole feature is: remember a
 * choice, write that attribute, and let the stylesheet do the rest.
 *
 * Each page carries a tiny inline copy of the read-and-apply step in its head,
 * marked `id="theme-boot"`. Module scripts are deferred, so without it the page
 * paints in the system theme first and flips once this file runs.
 */
export type Theme = "system" | "light" | "dark";

export const THEME_KEY = "theme";

const THEMES = ["system", "light", "dark"] as const;

const LABELS: Record<Theme, string> = {
  system: "System",
  light: "Light",
  dark: "Dark",
};

/** Storage throws rather than returning null in a locked-down browser. */
type ThemeStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isTheme(value: unknown): value is Theme {
  return THEMES.includes(value as Theme);
}

export function readTheme(storage: ThemeStorage): Theme {
  try {
    const stored = storage.getItem(THEME_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function writeTheme(theme: Theme, storage: ThemeStorage): void {
  try {
    if (theme === "system") storage.removeItem(THEME_KEY);
    else storage.setItem(THEME_KEY, theme);
  } catch {
    // A browser that refuses storage still gets the theme for this page.
  }
}

/** "system" means no attribute at all, which hands the page back to the OS. */
export function applyTheme(theme: Theme, root: HTMLElement): void {
  if (theme === "system") delete root.dataset.theme;
  else root.dataset.theme = theme;
}

/**
 * Exported as a function as well as wrapped in the element below, because a
 * custom element swallows a callback exception into the global error handler.
 * The storage-refused test has to call something that can actually throw.
 */
export function renderThemeControl(
  host: HTMLElement,
  root: HTMLElement = document.documentElement,
  storage: ThemeStorage = localStorage,
): void {
  const select = document.createElement("select");
  select.id = "theme-choice";
  select.replaceChildren(
    ...THEMES.map((theme) => {
      const option = document.createElement("option");
      option.value = theme;
      option.textContent = LABELS[theme];
      return option;
    }),
  );

  const current = readTheme(storage);
  select.value = current;
  applyTheme(current, root);

  select.addEventListener("change", () => {
    const chosen = isTheme(select.value) ? select.value : "system";
    applyTheme(chosen, root);
    writeTheme(chosen, storage);
  });

  const label = document.createElement("label");
  label.htmlFor = select.id;
  label.textContent = "Theme";

  host.replaceChildren(label, select);
}

export class ThemeToggle extends HTMLElement {
  connectedCallback(): void {
    renderThemeControl(this);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "theme-toggle": ThemeToggle;
  }
}

// One `bun test` process shares one registry across every test file.
if (!customElements.get("theme-toggle")) {
  customElements.define("theme-toggle", ThemeToggle);
}
```

- [ ] **Step 9: Run it to make sure it passes**

Run: `bun run test components/theme-toggle.test.ts`
Expected: 7 pass.

- [ ] **Step 10: Write the failing test for `<site-nav>`**

Create `components/site-nav.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools.ts";

import "./site-nav.ts";

// Connecting the element is what renders it, so every case mounts one. The
// default protocol under happy-dom is http:, which is the served form.
function mount(current: string | null): HTMLElement {
  document.body.replaceChildren();
  const nav = document.createElement("site-nav");
  if (current !== null) nav.setAttribute("current", current);
  document.body.append(nav);
  return nav;
}

test("the sidebar lists home plus every registered tool", () => {
  expect(mount(null).querySelectorAll("a").length).toBe(TOOLS.length + 1);
});

test("links from the home page stay in the current directory", () => {
  const links = mount(null).querySelectorAll("a");

  expect(links[0]?.getAttribute("href")).toBe("./");
  expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});

test("links from a tool page climb out of it first", () => {
  const links = mount("combi-name").querySelectorAll("a");

  expect(links[0]?.getAttribute("href")).toBe("../");
  expect(links[1]?.getAttribute("href")).toBe("../combi-name/");
});

test("the current tool is the only entry marked", () => {
  const marked = mount("combi-name").querySelectorAll('[aria-current="page"]');

  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Combi name codes");
});

test("home is marked when no tool is active", () => {
  const marked = mount(null).querySelectorAll('[aria-current="page"]');

  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Home");
});

// The pages used to wire this themselves, in an order that had to be right.
test("the sidebar renders the theme control itself", () => {
  expect(mount(null).querySelector("theme-toggle")).not.toBeNull();
});
```

- [ ] **Step 11: Run it to make sure it fails**

Run: `bun run test components/site-nav.test.ts`
Expected: FAIL — cannot resolve `./site-nav.ts`.

- [ ] **Step 12: Write `components/site-nav.ts`**

```ts
import { hrefFor } from "#lib/href.ts";
import { TOOLS, type ToolSlug } from "#lib/tools.ts";

import "./theme-toggle.ts";

type Entry = {
  readonly href: string;
  readonly label: string;
  readonly current: boolean;
};

function entries(active: ToolSlug | null): Entry[] {
  return [
    { href: hrefFor(null, active), label: "Home", current: active === null },
    ...TOOLS.map(({ slug, name }) => ({
      href: hrefFor(slug, active),
      label: name,
      current: slug === active,
    })),
  ];
}

/**
 * The sidebar every page carries. Navigation comes from the registry, so
 * nothing in any page's markup names another tool, and the theme control is
 * rendered here rather than left as a slot for the page to fill.
 */
export class SiteNav extends HTMLElement {
  connectedCallback(): void {
    const raw = this.getAttribute("current");
    const active = raw === null || raw === "" ? null : (raw as ToolSlug);

    const items = entries(active).map(({ href, label, current }) => {
      const link = document.createElement("a");
      link.href = href;
      link.textContent = label;
      if (current) link.setAttribute("aria-current", "page");

      const item = document.createElement("li");
      item.append(link);
      return item;
    });

    const list = document.createElement("ul");
    list.append(...items);

    const nav = document.createElement("nav");
    nav.setAttribute("aria-label", "Tools");
    nav.append(list);

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = "Cookie Run tools";

    this.replaceChildren(title, nav, document.createElement("theme-toggle"));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "site-nav": SiteNav;
  }
}

if (!customElements.get("site-nav")) {
  customElements.define("site-nav", SiteNav);
}
```

- [ ] **Step 13: Run it to make sure it passes**

Run: `bun run test components/site-nav.test.ts`
Expected: 6 pass.

- [ ] **Step 14: Strip the moved code out of `web/shared/chrome.ts`**

The file keeps only `need` and `renderToolList` — Task 5 takes `renderToolList` next. Delete `hrefFor`, delete `entries`, delete `renderSidebar`, and import `hrefFor` for what is left:

```ts
import { hrefFor } from "#lib/href.ts";
import { TOOLS } from "#lib/tools.ts";

export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}

/**
 * The home pane's index. The sidebar carries the same names, but only as
 * names - this is where a tool gets to say what it does.
 */
export function renderToolList(host: HTMLElement): void {
  host.replaceChildren(
    ...TOOLS.flatMap(({ slug, name, tagline }) => {
      const link = document.createElement("a");
      link.href = hrefFor(slug, null);
      link.textContent = name;

      const term = document.createElement("dt");
      term.append(link);

      const detail = document.createElement("dd");
      detail.textContent = tagline;

      return [term, detail];
    }),
  );
}
```

- [ ] **Step 15: Strip the moved cases out of `web/shared/chrome.test.ts`**

Delete every test except "the home index says what each tool does, not just its name", and drop the now-unused imports. The file becomes:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools.ts";

import { renderToolList } from "./chrome.ts";

test("the home index says what each tool does, not just its name", () => {
  const host = document.createElement("dl");
  renderToolList(host);

  expect(host.querySelectorAll("dt").length).toBe(TOOLS.length);

  TOOLS.forEach((tool, index) => {
    const link = host.querySelectorAll("dt")[index]?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`./${tool.slug}/`);
    expect(link?.textContent).toBe(tool.name);
    expect(host.querySelectorAll("dd")[index]?.textContent).toBe(tool.tagline);
  });
});
```

- [ ] **Step 16: Delete the old theme module**

```bash
git rm web/shared/theme.ts web/shared/theme.test.ts
```

- [ ] **Step 17: Put `<site-nav>` in both pages**

In `web/index.html:29` and `web/combi-name/index.html:29`, replace

```html
    <aside id="sidebar" class="sidebar"></aside>
```

with, in `web/index.html`:

```html
    <site-nav></site-nav>
```

and in `web/combi-name/index.html`:

```html
    <site-nav current="combi-name"></site-nav>
```

- [ ] **Step 18: Update both page scripts**

`web/home.ts` becomes:

```ts
import "#components/site-nav.ts";

import { need, renderToolList } from "./shared/chrome.ts";

renderToolList(need("tools"));
```

In `web/combi-name/main.ts`, replace lines 27-31:

```ts
import "#components/site-nav.ts";

import { need } from "../shared/chrome.ts";
```

The two calls `renderSidebar(need("sidebar"), "combi-name")` and `renderThemeControl(need("theme"))` go away — `<site-nav>` does both.

- [ ] **Step 19: Point the stylesheet at the elements**

In `web/shared/styles.css`, three groups of selectors change. Rename `.sidebar` to `site-nav` throughout (lines 88, 113, 124, 133, 138, 145, 178, 186), `.sidebar-title` to `site-nav .title` (line 102), and `.sidebar-foot` to `theme-toggle` (lines 154, 159, 164, 193, 201). Add `display: block` to the `theme-toggle` rule, since a custom element is inline by default:

```css
/* Settling, not navigating: the theme control sits at the far end of the rail
   so it never competes with the tool list. */
theme-toggle {
  display: block;
  margin-top: auto;
  padding-top: var(--pico-spacing);
}

theme-toggle label {
  color: var(--pico-muted-color);
  font-size: 0.8rem;
}

theme-toggle select {
  --pico-form-element-spacing-vertical: 0.3rem;
  --pico-form-element-spacing-horizontal: 0.5rem;
  margin-bottom: 0;
  font-size: 0.85rem;
}
```

Inside the `@media (width < 48rem)` block the `.sidebar-foot` rules become:

```css
  /* In the row layout there is no "far end" to push it to. */
  theme-toggle {
    display: flex;
    gap: 0.5rem;
    align-items: baseline;
    margin-top: var(--pico-spacing);
    padding-top: 0;
  }

  theme-toggle select {
    width: auto;
  }
```

The comment at lines 49-50 and 77-78 says "the sidebar"; leave the prose, it still reads correctly.

- [ ] **Step 20: Update the markup guard in `lib/tools.test.ts`**

Change the "every page hosts the sidebar" test to look for the element:

```ts
// Navigation lives in the sidebar every page renders from this registry, so a
// page without the element is a page you cannot leave.
test("every page hosts the sidebar", async () => {
  for (const page of await pages()) {
    expect(page).toContain("<site-nav");
  }
});
```

- [ ] **Step 21: Verify the whole suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: everything passes. `web/combi-name/main.test.ts` exercises the page with `<site-nav>` in it, which proves happy-dom upgrades an element that was already in the document when the module defining it ran.

- [ ] **Step 22: Verify the pages still look right**

Run: `bun run dev`
Expected: open `/` and `/combi-name`. The sidebar renders with the same spacing and the current-page marker, the theme select sits at the bottom of the rail, and switching theme still paints and persists. Narrow the window past 48rem and the rail becomes a top row with the theme control inline.

- [ ] **Step 23: Commit**

```bash
git add -A lib components web package.json
git commit -m "Make the sidebar and the theme control elements the pages declare"
```

---

### Task 5: `<tool-index>`

**Files:**
- Create: `components/tool-index.ts`
- Create: `components/tool-index.test.ts`
- Delete: `web/shared/chrome.test.ts`
- Modify: `web/shared/chrome.ts` (down to `need` alone)
- Modify: `web/index.html:43`
- Modify: `web/home.ts`
- Modify: `web/shared/styles.css` (`.tools` becomes `tool-index`)
- Modify: `lib/tools.test.ts` (the home-page markup assertion)

**Interfaces:**
- Consumes: `TOOLS` from `#lib/tools.ts`, `hrefFor` from `#lib/href.ts` (Task 4).
- Produces: `#components/tool-index.ts` exporting `class ToolIndex` and defining `<tool-index>`. It renders its own `<dl>`, so the page no longer supplies one.

- [ ] **Step 1: Write the failing test**

Create `components/tool-index.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools.ts";

import "./tool-index.ts";

test("the home index says what each tool does, not just its name", () => {
  document.body.replaceChildren();
  const index = document.createElement("tool-index");
  document.body.append(index);

  expect(index.querySelectorAll("dt").length).toBe(TOOLS.length);

  TOOLS.forEach((tool, position) => {
    const link = index.querySelectorAll("dt")[position]?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`./${tool.slug}/`);
    expect(link?.textContent).toBe(tool.name);
    expect(index.querySelectorAll("dd")[position]?.textContent).toBe(
      tool.tagline,
    );
  });
});

// The page used to supply the <dl> and have it filled in by id.
test("the element brings its own description list", () => {
  document.body.replaceChildren();
  document.body.append(document.createElement("tool-index"));

  expect(document.body.querySelector("tool-index > dl")).not.toBeNull();
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun run test components/tool-index.test.ts`
Expected: FAIL — cannot resolve `./tool-index.ts`.

- [ ] **Step 3: Write `components/tool-index.ts`**

```ts
import { hrefFor } from "#lib/href.ts";
import { TOOLS } from "#lib/tools.ts";

/**
 * The home pane's index. The sidebar carries the same names, but only as
 * names - this is where a tool gets to say what it does.
 */
export class ToolIndex extends HTMLElement {
  connectedCallback(): void {
    const list = document.createElement("dl");
    list.replaceChildren(
      ...TOOLS.flatMap(({ slug, name, tagline }) => {
        const link = document.createElement("a");
        link.href = hrefFor(slug, null);
        link.textContent = name;

        const term = document.createElement("dt");
        term.append(link);

        const detail = document.createElement("dd");
        detail.textContent = tagline;

        return [term, detail];
      }),
    );

    this.replaceChildren(list);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "tool-index": ToolIndex;
  }
}

if (!customElements.get("tool-index")) {
  customElements.define("tool-index", ToolIndex);
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `bun run test components/tool-index.test.ts`
Expected: 2 pass.

- [ ] **Step 5: Reduce `web/shared/chrome.ts` to `need`**

```ts
export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}
```

- [ ] **Step 6: Delete the old chrome test**

Its one remaining case now lives in `components/tool-index.test.ts`.

```bash
git rm web/shared/chrome.test.ts
```

- [ ] **Step 7: Put `<tool-index>` in the home page**

In `web/index.html:43`, replace

```html
        <dl id="tools" class="tools"></dl>
```

with

```html
        <tool-index></tool-index>
```

- [ ] **Step 8: `web/home.ts` becomes two imports**

```ts
/**
 * The home pane is two elements that draw their own content, so this file's
 * only job is to register them.
 */
import "#components/site-nav.ts";
import "#components/tool-index.ts";
```

- [ ] **Step 9: Point the stylesheet at the element**

In `web/shared/styles.css`, replace the `.tools` block (lines 345-361) with:

```css
tool-index {
  display: block;
}

tool-index dl {
  margin: 0;
}

tool-index dt {
  font-size: 1.05rem;
}

tool-index dd {
  margin: 0.15rem 0 var(--pico-spacing);
  max-width: 46rem;
  color: var(--pico-muted-color);
}

tool-index dd:last-child {
  margin-bottom: 0;
}
```

- [ ] **Step 10: Update the markup guard in `lib/tools.test.ts`**

```ts
test("the home page hosts the tool index", async () => {
  const [home] = await pages();
  expect(home).toContain("<tool-index");
});
```

- [ ] **Step 11: Verify**

Run: `bun run test && bun run typecheck`
Expected: everything passes.

Run: `bun run dev`
Expected: `/` lists the tool with its tagline, the link goes to `/combi-name`, and the spacing is unchanged.

- [ ] **Step 12: Commit**

```bash
git add -A lib components web
git commit -m "Let the home pane declare its tool index instead of filling one in"
```

---

### Task 6: `<labelled-select>` and `<check-group>`

**Files:**
- Create: `components/labelled-select.ts`
- Create: `components/labelled-select.test.ts`
- Create: `components/check-group.ts`
- Create: `components/check-group.test.ts`
- Modify: `web/combi-name/index.html:56-84`
- Modify: `web/combi-name/main.ts` (the form half)
- Modify: `web/combi-name/main.test.ts` (the `check` helper)
- Modify: `web/shared/styles.css` (`.checks` and `fieldset` become scoped)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `#components/labelled-select.ts`: `class LabelledSelect` with `options: readonly (readonly [string, string])[]` (get/set), `value: string` (get/set); element `<labelled-select label="...">`.
  - `#components/check-group.ts`: `class CheckGroup` with `options: readonly (readonly [string, string])[]` (get/set), `selected: readonly string[]` (get/set); element `<check-group legend="...">`.

`CheckGroup`'s `selected` getter is the load-bearing one. It filters the component's own `options` array rather than reading DOM order, which is what keeps boosts in slot order (slots 4-6) and cookie powers in bit order. That was `checkedValues` in `web/combi-name/main.ts` and `AGENTS.md` flags it as part of the wire format.

`LabelledSelect` associates its label with an explicit `for`/`id` pair rather than by nesting, so Pico's `label` margin still separates the two the way it does in the current markup. The inner id is derived from the host's id when it has one and from a module counter when it does not.

- [ ] **Step 1: Write the failing test for `<labelled-select>`**

Create `components/labelled-select.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./labelled-select.ts";

import type { LabelledSelect } from "./labelled-select.ts";

function mount(id: string, label: string): LabelledSelect {
  document.body.replaceChildren();
  const element = document.createElement("labelled-select");
  element.id = id;
  element.setAttribute("label", label);
  document.body.append(element);
  return element;
}

// Nesting the select inside the label would collapse the gap Pico's own label
// margin puts between them, so the association is an explicit for/id pair.
test("the label points at the select and names it", () => {
  const element = mount("type", "Type");
  const select = element.querySelector("select")!;
  const label = element.querySelector("label")!;

  expect(select.id).not.toBe("");
  expect(label.htmlFor).toBe(select.id);
  expect(label.textContent).toBe("Type");
});

test("two elements on one page do not share a select id", () => {
  document.body.replaceChildren();
  const first = document.createElement("labelled-select");
  const second = document.createElement("labelled-select");
  document.body.append(first, second);

  const ids = [...document.body.querySelectorAll("select")].map((s) => s.id);
  expect(new Set(ids).size).toBe(2);
});

test("options render in the order they are given", () => {
  const element = mount("type", "Type");
  element.options = [
    ["a", "Alpha"],
    ["b", "Beta"],
  ];
  const select = element.querySelector("select")!;

  expect([...select.options].map((option) => option.value)).toEqual(["a", "b"]);
  expect([...select.options].map((option) => option.textContent)).toEqual([
    "Alpha",
    "Beta",
  ]);
});

test("value reads and writes through to the select", () => {
  const element = mount("type", "Type");
  element.options = [
    ["a", "Alpha"],
    ["b", "Beta"],
  ];

  element.value = "b";
  expect(element.querySelector("select")!.value).toBe("b");
  expect(element.value).toBe("b");
});

// The page listens for `input` on the enclosing form, so the event has to
// leave the component.
test("an input event from the select bubbles out of the element", () => {
  const element = mount("type", "Type");
  element.options = [["a", "Alpha"]];

  let seen = 0;
  document.body.addEventListener("input", () => void (seen += 1));
  element
    .querySelector("select")!
    .dispatchEvent(new Event("input", { bubbles: true }));

  expect(seen).toBe(1);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun run test components/labelled-select.test.ts`
Expected: FAIL — cannot resolve `./labelled-select.ts`.

- [ ] **Step 3: Write `components/labelled-select.ts`**

```ts
export type Option = readonly [value: string, label: string];

let sequence = 0;

/**
 * A label and a select, built from `[value, label]` pairs handed in as a
 * property. The pairs come from the caller's canonical list, so the option
 * order is the caller's order.
 */
export class LabelledSelect extends HTMLElement {
  readonly #select = document.createElement("select");
  #options: readonly Option[] = [];
  #built = false;

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    // Derived from the host id where there is one, so the generated id reads
    // as belonging to this control rather than to a counter.
    this.#select.id = this.id === "" ? `select-${++sequence}` : `${this.id}-select`;

    const label = document.createElement("label");
    label.htmlFor = this.#select.id;
    label.textContent = this.getAttribute("label") ?? "";

    this.replaceChildren(label, this.#select);
  }

  get options(): readonly Option[] {
    return this.#options;
  }

  set options(options: readonly Option[]) {
    this.#options = options;
    this.#select.replaceChildren(
      ...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
  }

  get value(): string {
    return this.#select.value;
  }

  set value(value: string) {
    this.#select.value = value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "labelled-select": LabelledSelect;
  }
}

if (!customElements.get("labelled-select")) {
  customElements.define("labelled-select", LabelledSelect);
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `bun run test components/labelled-select.test.ts`
Expected: 5 pass.

- [ ] **Step 5: Write the failing test for `<check-group>`**

Create `components/check-group.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./check-group.ts";

import type { CheckGroup } from "./check-group.ts";

function mount(id: string, legend: string): CheckGroup {
  document.body.replaceChildren();
  const element = document.createElement("check-group");
  element.id = id;
  element.setAttribute("legend", legend);
  document.body.append(element);
  element.options = [
    ["hp", "HP Extension"],
    ["power", "Power Jelly Boost"],
    ["fast", "Fast Start"],
  ];
  return element;
}

test("the legend names the group", () => {
  expect(mount("boosts", "Boosts").querySelector("legend")?.textContent).toBe(
    "Boosts",
  );
});

test("a checkbox is rendered per option, in the order given", () => {
  const inputs = mount("boosts", "Boosts").querySelectorAll("input");

  expect([...inputs].map((input) => input.value)).toEqual([
    "hp",
    "power",
    "fast",
  ]);
});

// This is the wire format. Boosts occupy slots 4-6 and cookie powers are bit
// positions, so reading back in DOM-click order would reorder the code.
test("selected reads back in the option order, not the order ticked", () => {
  const element = mount("boosts", "Boosts");
  const inputs = [...element.querySelectorAll("input")];

  inputs[2]!.checked = true;
  inputs[0]!.checked = true;

  expect(element.selected).toEqual(["hp", "fast"]);
});

test("setting selected ticks exactly those boxes", () => {
  const element = mount("boosts", "Boosts");

  element.selected = ["power"];
  expect([...element.querySelectorAll("input")].map((i) => i.checked)).toEqual([
    false,
    true,
    false,
  ]);

  element.selected = [];
  expect([...element.querySelectorAll("input")].map((i) => i.checked)).toEqual([
    false,
    false,
    false,
  ]);
});

test("a value that is not an option is ignored rather than invented", () => {
  const element = mount("boosts", "Boosts");

  element.selected = ["hp", "nonsense"];
  expect(element.selected).toEqual(["hp"]);
});

test("an input event from a checkbox bubbles out of the element", () => {
  const element = mount("boosts", "Boosts");

  let seen = 0;
  document.body.addEventListener("input", () => void (seen += 1));
  element
    .querySelector("input")!
    .dispatchEvent(new Event("input", { bubbles: true }));

  expect(seen).toBe(1);
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `bun run test components/check-group.test.ts`
Expected: FAIL — cannot resolve `./check-group.ts`.

- [ ] **Step 7: Write `components/check-group.ts`**

```ts
export type Option = readonly [value: string, label: string];

/**
 * A fieldset of checkboxes built from `[value, label]` pairs.
 *
 * `selected` filters this element's own `options` rather than reading DOM
 * order, which is what keeps boosts in slot order and cookie powers in bit
 * order. That ordering is part of the combi wire format, not a preference.
 */
export class CheckGroup extends HTMLElement {
  readonly #checks = document.createElement("div");
  #options: readonly Option[] = [];
  #built = false;

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    const legend = document.createElement("legend");
    legend.textContent = this.getAttribute("legend") ?? "";

    this.#checks.className = "checks";

    const fieldset = document.createElement("fieldset");
    fieldset.replaceChildren(legend, this.#checks);

    this.replaceChildren(fieldset);
  }

  get options(): readonly Option[] {
    return this.#options;
  }

  set options(options: readonly Option[]) {
    this.#options = options;
    this.#checks.replaceChildren(
      ...options.map(([value, text]) => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = value;

        const label = document.createElement("label");
        label.append(input, document.createTextNode(text));
        return label;
      }),
    );
  }

  get selected(): string[] {
    const checked = new Set(
      Array.from(
        this.#checks.querySelectorAll<HTMLInputElement>("input:checked"),
        (input) => input.value,
      ),
    );
    return this.#options
      .map(([value]) => value)
      .filter((value) => checked.has(value));
  }

  set selected(values: readonly string[]) {
    const wanted = new Set(values);
    for (const input of this.#checks.querySelectorAll<HTMLInputElement>(
      "input",
    )) {
      input.checked = wanted.has(input.value);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "check-group": CheckGroup;
  }
}

if (!customElements.get("check-group")) {
  customElements.define("check-group", CheckGroup);
}
```

- [ ] **Step 8: Run it to make sure it passes**

Run: `bun run test components/check-group.test.ts`
Expected: 6 pass.

- [ ] **Step 9: Rewrite the builder form's markup**

In `web/combi-name/index.html`, replace the whole `<form id="builder" novalidate>` body (lines 56-84) with:

```html
          <labelled-select id="type" label="Type"></labelled-select>

          <labelled-select id="episode" label="Episode"></labelled-select>

          <check-group id="boosts" legend="Boosts"></check-group>

          <labelled-select
            id="randomBoost"
            label="Random boost"
          ></labelled-select>

          <check-group id="cookiePowers" legend="Cookie power+"></check-group>

          <labelled-select id="action" label="Action"></labelled-select>
```

The `.field` wrapper divs and the `<fieldset>`/`<legend>` pairs are gone; the components render both. `.field` had no stylesheet rule of its own, so nothing is lost.

- [ ] **Step 10: Rewire the form half of `web/combi-name/main.ts`**

Add the imports:

```ts
import "#components/check-group.ts";
import "#components/labelled-select.ts";

import type { CheckGroup } from "#components/check-group.ts";
import type { LabelledSelect } from "#components/labelled-select.ts";
```

Change the six element lookups (lines 33-38):

```ts
const typeSelect = need<LabelledSelect>("type");
const episodeSelect = need<LabelledSelect>("episode");
const boostsGroup = need<CheckGroup>("boosts");
const randomBoostSelect = need<LabelledSelect>("randomBoost");
const cookiePowersGroup = need<CheckGroup>("cookiePowers");
const actionSelect = need<LabelledSelect>("action");
```

Delete `fillSelect`, `fillChecks`, `checkedValues`, and `setChecks` (lines 55-109) and replace the bottom-of-file setup calls (lines 243-262) with:

```ts
/** Pairs the canonical value list with its labels, keeping the list's order. */
function pairs<K extends string>(
  values: readonly K[],
  labels: Record<K, string>,
): readonly (readonly [string, string])[] {
  return values.map((value) => [value, labels[value]] as const);
}

typeSelect.options = pairs(ALL_TYPES, TYPE_LABELS);
episodeSelect.options = pairs(ALL_EPISODES, EPISODE_LABELS);
randomBoostSelect.options = [
  // `as const` or this literal infers as string[] and will not assign to a
  // [value, label] tuple.
  [NO_RANDOM_BOOST, "None"] as const,
  ...pairs(ALL_RANDOM_BOOSTS, RANDOM_BOOST_LABELS),
];
actionSelect.options = pairs(ALL_ACTIONS, ACTION_LABELS);
boostsGroup.options = pairs(ALL_BOOSTS, BOOST_LABELS);
cookiePowersGroup.options = pairs(ALL_COOKIE_POWERS, COOKIE_POWER_LABELS);
```

In `readForm`, the two `checkedValues` calls become property reads. The `as` casts stay, because the components speak `string` and the codec speaks its own unions:

```ts
    boosts: boostsGroup.selected as Boost[],
    ...
    cookiePowers: cookiePowersGroup.selected as CookiePower[],
```

Add `type Boost` and `type CookiePower` to the `#lib/combi-name/codec.ts` import list. In `writeForm`, the two `setChecks` calls become:

```ts
  boostsGroup.selected = combi.boosts;
  cookiePowersGroup.selected = combi.cookiePowers;
```

- [ ] **Step 11: Scope the form rules in the stylesheet**

In `web/shared/styles.css`, the `.checks` rule (lines 380-384) and the bare `fieldset`/`fieldset legend` rules (lines 388-396) only ever applied to these two groups. Scope them and give both components a block display:

```css
labelled-select {
  display: block;
}

check-group {
  display: block;
}

/* A group of checkboxes and a single select were styled identically, so the
   form read as six equal things instead of two pickers and two groups. */
check-group fieldset {
  padding-top: 0.5rem;
  border-top: 1px solid var(--pico-muted-border-color);
}

check-group legend {
  padding-right: 0.4rem;
  font-weight: 600;
}

/* Seven cookie powers in one column made the builder twice the height of
   everything beside it. */
check-group .checks {
  display: grid;
  gap: 0.4rem 1rem;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
}

check-group .checks label {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}
```

Delete the old `.checks label` rule at lines 363-367 — it is folded into the block above.

- [ ] **Step 12: Verify the page tests still pass unchanged**

Run: `bun run test web/combi-name/main.test.ts`
Expected: 7 pass. The `check` helper queries `need(hostId).querySelector('input[value="..."]')`, and `<check-group>` renders those inputs as descendants of the host, so it keeps working. `typeSelect.value = "auto"` now sets the component property, and `fire(typeSelect)` dispatches a bubbling `input` from the host, which the form still hears.

If a case fails, the likely cause is that `main.ts` sets `.options` before the element upgraded. Confirm the component `import` statements sit above the `need()` calls in `main.ts`.

- [ ] **Step 13: Verify the whole suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: everything passes.

- [ ] **Step 14: Verify the form in a browser**

Run: `bun run dev`
Expected: `/combi-name` shows four labelled selects and two bordered checkbox groups, laid out as before. Ticking Fast Start rewrites the code to `1H0--F000-`. Ticking cookie powers out of order still produces the same hex pair as before — tick Sea Fairy then Fairy and the code reads `1S0---014-`.

- [ ] **Step 15: Commit**

```bash
git add -A components web
git commit -m "Give the builder form two components instead of six filled-in containers"
```

---

### Task 7: `<copy-code>` and `<auto-verdict>`

**Files:**
- Create: `components/copy-code.ts`
- Create: `components/copy-code.test.ts`
- Create: `components/auto-verdict.ts`
- Create: `components/auto-verdict.test.ts`
- Modify: `web/combi-name/index.html:41-50,111-115`
- Modify: `web/combi-name/main.ts` (the output half)
- Modify: `web/combi-name/main.test.ts` (the output lookups)
- Modify: `web/shared/styles.css` (`.code-output`, `.code`, `.verdict`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `#components/copy-code.ts`: `class CopyCode` with `value: string` (get/set, mirrored to the `value` attribute); element `<copy-code value="...">`. Setting `value` clears the status line.
  - `#components/auto-verdict.ts`: `type Verdict = { readonly semi: boolean; readonly reasons: readonly string[] }`, `class AutoVerdictElement` with `verdict: Verdict | null` (get/set); element `<auto-verdict prefix="...">`.

`<auto-verdict>` declares `Verdict` itself rather than importing `AutoVerdict` from the combi route. `AutoVerdict` is `{ semi: boolean; reasons: string[] }`, which is structurally assignable to `Verdict`, so the route can pass `describeCombi(combi).auto` straight in — and `components/` keeps zero imports from `routes/`.

The exact sentences, carried over from `renderVerdict` in `web/combi-name/main.ts`, are `"<prefix> "` then a `<strong>` of `Semi-auto` or `Full auto`, then either `" - <reasons joined by ', '> needs manual work each run."` (`need` when there is more than one reason) or `" - nothing needs manual work each run."`.

- [ ] **Step 1: Write the failing test for `<copy-code>`**

Create `components/copy-code.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./copy-code.ts";

import type { CopyCode } from "./copy-code.ts";

function mount(value: string): CopyCode {
  document.body.replaceChildren();
  const element = document.createElement("copy-code");
  element.setAttribute("value", value);
  document.body.append(element);
  return element;
}

function stubClipboard(writeText: () => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

test("the value shows as code", () => {
  expect(mount("1S0---000-").querySelector("code")?.textContent).toBe(
    "1S0---000-",
  );
});

test("setting the property updates the code and the attribute", () => {
  const element = mount("1S0---000-");

  element.value = "1H0--F000-";

  expect(element.querySelector("code")?.textContent).toBe("1H0--F000-");
  expect(element.getAttribute("value")).toBe("1H0--F000-");
  expect(element.value).toBe("1H0--F000-");
});

test("copying reports that it worked", async () => {
  const element = mount("1S0---000-");
  let copied = "";
  stubClipboard(async () => void (copied = element.value));

  element.querySelector("button")!.click();
  await Promise.resolve();
  await Promise.resolve();

  expect(copied).toBe("1S0---000-");
  expect(element.querySelector(".status")?.textContent).toBe("Copied.");
});

test("a blocked clipboard tells the reader to copy by hand", async () => {
  const element = mount("1S0---000-");
  stubClipboard(() => Promise.reject(new Error("denied")));

  element.querySelector("button")!.click();
  await Promise.resolve();
  await Promise.resolve();

  const status = element.querySelector(".status")!;
  expect(status.textContent).toContain("copy it by hand");
  expect(status.classList.contains("error")).toBe(true);
});

// A stale "Copied." next to a code that has since changed is a lie.
test("a new value clears the status", async () => {
  const element = mount("1S0---000-");
  stubClipboard(async () => {});

  element.querySelector("button")!.click();
  await Promise.resolve();
  await Promise.resolve();
  element.value = "1H0--F000-";

  expect(element.querySelector(".status")?.textContent).toBe("");
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bun run test components/copy-code.test.ts`
Expected: FAIL — cannot resolve `./copy-code.ts`.

If the two `await Promise.resolve()` lines turn out not to be enough to settle the click handler's promise chain, use `await Bun.sleep(0)` instead. Do not add a real delay.

- [ ] **Step 3: Write `components/copy-code.ts`**

```ts
/**
 * The code the page exists to produce, plus a button that copies it and a
 * status line for the copy. Setting `value` clears the status, because a stale
 * "Copied." beside a code that has since changed is a lie.
 */
export class CopyCode extends HTMLElement {
  static readonly observedAttributes = ["value"];

  readonly #code = document.createElement("code");
  readonly #status = document.createElement("p");
  readonly #button = document.createElement("button");
  #built = false;

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    this.#code.textContent = this.getAttribute("value") ?? "";

    this.#button.type = "button";
    this.#button.className = "outline secondary";
    this.#button.textContent = "Copy";
    this.#button.addEventListener("click", () => void this.#copy());

    this.#status.className = "status";
    this.#status.setAttribute("role", "status");

    const output = document.createElement("output");
    output.setAttribute("aria-live", "polite");
    output.append(this.#code, this.#button);

    this.replaceChildren(output, this.#status);
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null,
  ): void {
    if (name === "value") this.#code.textContent = next ?? "";
  }

  get value(): string {
    return this.#code.textContent ?? "";
  }

  set value(value: string) {
    this.setAttribute("value", value);
    this.#setStatus("", false);
  }

  async #copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value);
      this.#setStatus("Copied.", false);
    } catch {
      this.#setStatus(
        "The browser blocked the clipboard. Select the code and copy it by hand.",
        true,
      );
    }
  }

  #setStatus(text: string, isError: boolean): void {
    this.#status.textContent = text;
    this.#status.classList.toggle("error", isError);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "copy-code": CopyCode;
  }
}

if (!customElements.get("copy-code")) {
  customElements.define("copy-code", CopyCode);
}
```

- [ ] **Step 4: Run it to make sure it passes**

Run: `bun run test components/copy-code.test.ts`
Expected: 5 pass.

- [ ] **Step 5: Write the failing test for `<auto-verdict>`**

Create `components/auto-verdict.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./auto-verdict.ts";

import type { AutoVerdictElement } from "./auto-verdict.ts";

function mount(prefix: string): AutoVerdictElement {
  document.body.replaceChildren();
  const element = document.createElement("auto-verdict");
  element.setAttribute("prefix", prefix);
  document.body.append(element);
  return element;
}

test("nothing renders until there is a verdict", () => {
  const element = mount("Stored as");

  expect(element.textContent).toBe("");
});

test("full auto says nothing needs manual work", () => {
  const element = mount("Stored as");

  element.verdict = { semi: false, reasons: [] };

  expect(element.textContent).toBe(
    "Stored as Full auto - nothing needs manual work each run.",
  );
  expect(element.querySelector("strong")?.textContent).toBe("Full auto");
});

test("one reason reads needs, more than one reads need", () => {
  const element = mount("This code is");

  element.verdict = { semi: true, reasons: ["Fast Start"] };
  expect(element.textContent).toBe(
    "This code is Semi-auto - Fast Start needs manual work each run.",
  );

  element.verdict = { semi: true, reasons: ["Fast Start", "Jump at start"] };
  expect(element.textContent).toBe(
    "This code is Semi-auto - Fast Start, Jump at start need manual work each run.",
  );
});

// The hand-played types have no verdict, and the line has to empty out again
// rather than keep the last one.
test("clearing the verdict empties the line", () => {
  const element = mount("Stored as");

  element.verdict = { semi: false, reasons: [] };
  element.verdict = null;

  expect(element.textContent).toBe("");
});
```

- [ ] **Step 6: Run it to make sure it fails**

Run: `bun run test components/auto-verdict.test.ts`
Expected: FAIL — cannot resolve `./auto-verdict.ts`.

- [ ] **Step 7: Write `components/auto-verdict.ts`**

```ts
/**
 * Declared here rather than imported from the combi route: components never
 * import from routes. `AutoVerdict` in the route's describe.ts is structurally
 * assignable to this, so the route passes its value straight in.
 */
export type Verdict = {
  readonly semi: boolean;
  /** What forces manual work each run. Empty when the combi is full auto. */
  readonly reasons: readonly string[];
};

export class AutoVerdictElement extends HTMLElement {
  #verdict: Verdict | null = null;

  connectedCallback(): void {
    this.setAttribute("aria-live", "polite");
    this.#render();
  }

  get verdict(): Verdict | null {
    return this.#verdict;
  }

  set verdict(verdict: Verdict | null) {
    this.#verdict = verdict;
    this.#render();
  }

  #render(): void {
    if (this.#verdict === null) {
      this.replaceChildren();
      return;
    }

    const { semi, reasons } = this.#verdict;

    const name = document.createElement("strong");
    name.textContent = semi ? "Semi-auto" : "Full auto";

    const tail = semi
      ? ` - ${reasons.join(", ")} ${
          reasons.length === 1 ? "needs" : "need"
        } manual work each run.`
      : " - nothing needs manual work each run.";

    this.replaceChildren(
      document.createTextNode(`${this.getAttribute("prefix") ?? ""} `),
      name,
      document.createTextNode(tail),
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "auto-verdict": AutoVerdictElement;
  }
}

if (!customElements.get("auto-verdict")) {
  customElements.define("auto-verdict", AutoVerdictElement);
}
```

- [ ] **Step 8: Run it to make sure it passes**

Run: `bun run test components/auto-verdict.test.ts`
Expected: 4 pass.

- [ ] **Step 9: Rewrite the result panel's markup**

In `web/combi-name/index.html`, replace lines 44-49:

```html
        <output id="code-output" class="code-output" aria-live="polite">
          <code id="code" class="code">1S0---000-</code>
          <button id="copy" type="button" class="outline secondary">Copy</button>
        </output>
        <p id="copy-status" class="status" role="status"></p>
        <p id="builder-verdict" class="verdict" aria-live="polite"></p>
```

with:

```html
        <copy-code id="code-output" value="1S0---000-"></copy-code>
        <auto-verdict id="builder-verdict" prefix="Stored as"></auto-verdict>
```

And in the reader panel, replace line 113:

```html
        <p id="reader-verdict" class="verdict" aria-live="polite"></p>
```

with:

```html
        <auto-verdict id="reader-verdict" prefix="This code is"></auto-verdict>
```

- [ ] **Step 10: Rewire the output half of `web/combi-name/main.ts`**

Add the imports:

```ts
import "#components/auto-verdict.ts";
import "#components/copy-code.ts";

import type { AutoVerdictElement } from "#components/auto-verdict.ts";
import type { CopyCode } from "#components/copy-code.ts";
```

Replace the output lookups (lines 41-44 and 49):

```ts
const codeOutput = need<CopyCode>("code-output");
const builderVerdict = need<AutoVerdictElement>("builder-verdict");
const readerVerdict = need<AutoVerdictElement>("reader-verdict");
```

`codeElement`, `copyButton`, and `copyStatus` go away. Delete `renderVerdict` (lines 139-163) and the whole `copyButton.addEventListener` block (lines 266-277) — the component owns both.

`renderBuilder` becomes:

```ts
function renderBuilder(): void {
  const code = encode(readForm());
  codeOutput.value = code;

  // Read the code back so the verdict reflects the character actually written
  // into slot 2, not the type the select still shows.
  const { combi } = decode(code);
  builderVerdict.verdict = describeCombi(combi).auto;
}
```

In `clearReader`, the verdict line becomes `readerVerdict.verdict = null;`. In `renderReader`, the final verdict line becomes `readerVerdict.verdict = described.auto;`. The `AutoVerdict` type import is no longer used by this file — drop it from the `describe.ts` import.

- [ ] **Step 11: Update the output lookups in `web/combi-name/main.test.ts`**

The `code` and `builderVerdict` constants change, and `readerVerdict` is now an element whose `textContent` reads the same way:

```ts
const codeOutput = need("code-output");
const code = codeOutput.querySelector("code")!;
```

Every existing `code.textContent` assertion keeps working. `need("builder-verdict")` and `need("reader-verdict")` still return elements whose `textContent` is the verdict sentence, so those assertions are unchanged. Delete the `const code = need("code");` line and the `copy-status` lookup if present.

- [ ] **Step 12: Scope the output rules in the stylesheet**

In `web/shared/styles.css`, replace the `.code-output` and `.code` rules (lines 256-275) and the `.verdict` rules (lines 398-404) with:

```css
copy-code {
  display: block;
}

copy-code output {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: center;
}

copy-code code {
  flex: 0 1 auto;
  min-width: 0;
  overflow-x: auto;
  padding: 0;
  background: none;
  color: var(--pico-color);
  font-family: var(--pico-font-family-monospace);
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 600;
  letter-spacing: 0.22em;
  user-select: all;
}

auto-verdict {
  display: block;
  margin-top: 0.75rem;
}

auto-verdict strong {
  color: var(--pico-primary);
}
```

- [ ] **Step 13: Verify**

Run: `bun run test && bun run typecheck`
Expected: everything passes, `web/combi-name/main.test.ts` included.

- [ ] **Step 14: Verify the panel in a browser**

Run: `bun run dev`
Expected: `/combi-name` shows the large code with the Copy button beside it. Copy reports "Copied." and the message clears the moment you change any control. Ticking Fast Start shows "Stored as **Semi-auto** - Fast Start needs manual work each run." Typing `1A3H-F400-` into the reader shows the warning and "This code is **Semi-auto**". Typing an Exp code such as `1E3-PF400J` leaves the reader verdict empty.

- [ ] **Step 15: Commit**

```bash
git add -A components web
git commit -m "Turn the code readout and the auto verdict into elements"
```

---

### Task 8: `web/` becomes `routes/`, and `dev` and `build` become scripts

**Files:**
- Move: `web/index.html` to `routes/index.html`
- Move: `web/home.ts` to `routes/index.ts`
- Move: `web/combi-name/index.html` to `routes/combi-name/index.html`
- Move: `web/combi-name/main.ts` to `routes/combi-name/index.ts`
- Move: `web/combi-name/main.test.ts` to `routes/combi-name/index.test.ts`
- Move: `web/dev.ts` to `scripts/dev.ts`
- Create: `routes/index.css` (base half of `web/shared/styles.css`)
- Create: `routes/combi-name/index.css` (page half)
- Create: `scripts/build.ts`
- Delete: `web/shared/chrome.ts`, `web/shared/styles.css`, and the `web/` tree
- Modify: `lib/tools.ts` (add `pageEntrypoints`)
- Modify: `lib/tools.test.ts` (paths, and the two build greps collapse into one)
- Modify: `package.json` (`dev` and `build` delegate to scripts)

**Interfaces:**
- Consumes: every component from Tasks 4-7, by `#components/*`.
- Produces:
  - `#lib/tools.ts` additionally exports `pageEntrypoints(): string[]`, returning `["routes/index.html", "routes/<slug>/index.html", ...]`.
  - `routes/combi-name/index.ts` exports `need<T extends HTMLElement>(id: string): T` for its own test.

`web/shared/chrome.ts` is down to `need`, and `need` is only used by one route, so it moves into that route's script rather than becoming a shared module in the new tree.

- [ ] **Step 1: Move the pages and the dev server**

```bash
mkdir -p routes/combi-name
git mv web/index.html routes/index.html
git mv web/home.ts routes/index.ts
git mv web/combi-name/index.html routes/combi-name/index.html
git mv web/combi-name/main.ts routes/combi-name/index.ts
git mv web/combi-name/main.test.ts routes/combi-name/index.test.ts
git mv web/dev.ts scripts/dev.ts
```

- [ ] **Step 2: Split the stylesheet — write the base half**

Create `routes/index.css` with everything from `web/shared/styles.css` except the combi-only rules. In order: the Pico import; the density block (`html`, `:root`); `h1`/`h2`/`h3`; `.container`; `.skip-link` and `.skip-link:focus`; the `:root { scroll-padding-top }` and `main:focus` rules; the `body` grid; `site-nav` and its `.title`, `ul`, `a`, `a:hover`, `a:focus-visible`, `a[aria-current="page"]` rules; the three `theme-toggle` rules; the whole `@media (width < 48rem)` block; the `main` grid and its `@media (width >= 62rem)`; `main > :only-child { grid-column: 1 / -1 }`; `.panel`; `.masthead h1` and `.masthead p`; `.status` and `.status.error`; the `tool-index` rules; the `labelled-select` and `check-group` rules; the `copy-code` rules; the `auto-verdict` rules.

Keep every explanatory comment with the rule it explains.

Note that the original `.result, .legend, main > :only-child { grid-column: 1 / -1 }` rule splits: only `main > :only-child` belongs here.

- [ ] **Step 3: Split the stylesheet — write the page half**

Create `routes/combi-name/index.css`:

```css
@import "../index.css";

/* The result and the legend are full-width; the builder and the reader pair up
   beside each other once the grid has two tracks. */
.result,
.legend {
  grid-column: 1 / -1;
}

/* The code is what the page is for, so it stays in view while you work the
   controls under it. */
.result {
  position: sticky;
  top: 0;
  z-index: 1;
}

.result h2 {
  --pico-typography-spacing-top: 0;
  color: var(--pico-muted-color);
  font-size: 0.8rem;
  font-weight: 500;
}

.code-input {
  font-family: var(--pico-font-family-monospace);
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

/* A placeholder at full value colour reads as a code someone already typed. */
.code-input::placeholder {
  color: var(--pico-muted-color);
  opacity: 0.6;
  text-transform: none;
}

.hint {
  display: block;
  margin-top: 0.35rem;
  color: var(--pico-muted-color);
}

.warnings {
  display: grid;
  gap: 0.5rem;
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
  padding: var(--pico-spacing);
  font-size: 0.85rem;
}

.table-wrap {
  overflow-x: auto;
}
```

- [ ] **Step 4: Delete the old shared web directory**

```bash
git rm web/shared/chrome.ts web/shared/styles.css
rmdir web/shared web/combi-name web 2>/dev/null || true
```

- [ ] **Step 5: Repoint each page's head**

In `routes/index.html`, change lines 24-25:

```html
    <link rel="stylesheet" href="./index.css" />
    <script src="./index.ts" type="module"></script>
```

In `routes/combi-name/index.html`, change lines 24-25:

```html
    <link rel="stylesheet" href="./index.css" />
    <script src="./index.ts" type="module"></script>
```

- [ ] **Step 6: Fold `need` into the combi route's script**

At the top of `routes/combi-name/index.ts`, delete `import { need } from "../shared/chrome.ts";` and add the function after the imports. It is exported because the route's test uses it:

```ts
/** Exported for this route's test, which drives the page through the same lookups. */
export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}
```

Change the codec, labels, and describe imports from `#lib/combi-name/...` — they stay on that path for now and move in Task 9.

- [ ] **Step 7: Repoint the route's test**

In `routes/combi-name/index.test.ts`, change the `need` import and the module under test:

```ts
import { need } from "./index.ts";
```

Delete the old `import { need } from "../shared/chrome.ts";`, and change `await import("./main.ts")` to `await import("./index.ts")`.

There is a load-order subtlety: the file imports `need` from `./index.ts`, which runs the whole page script, and that has to happen *after* `document.body.innerHTML` is set. Keep the body assignment above the import by making the import dynamic, exactly as the file already does for the page script:

```ts
const page = await Bun.file(new URL("./index.html", import.meta.url)).text();
const body = page.slice(
  page.indexOf("<body>") + "<body>".length,
  page.indexOf("</body>"),
);

document.body.innerHTML = body;
const { need } = await import("./index.ts");
```

- [ ] **Step 8: `routes/index.ts` keeps its two imports**

No change to the content — verify it reads:

```ts
/**
 * The home pane is two elements that draw their own content, so this file's
 * only job is to register them.
 */
import "#components/site-nav.ts";
import "#components/tool-index.ts";
```

- [ ] **Step 9: Add `pageEntrypoints()` to the registry**

Append to `lib/tools.ts`:

```ts
/**
 * One HTML entrypoint per page, home pane first. The build and the test that
 * guards it both read this, so a registered tool with no page on disk is a
 * failing assertion rather than a sidebar link to nothing.
 */
export function pageEntrypoints(): string[] {
  return [
    "routes/index.html",
    ...TOOLS.map(({ slug }) => `routes/${slug}/index.html`),
  ];
}
```

- [ ] **Step 10: Write `scripts/build.ts`**

```ts
/**
 * One self-contained file per page. `--compile --target=browser` inlines each
 * page's JavaScript, CSS, and referenced assets, which is what removes any
 * base-path concern when GitHub Pages serves the site from a project subpath
 * and what makes each file work offline from file://.
 *
 * Entrypoints come from the registry rather than a list here: `sh` expands
 * `**` as `*`, so a glob would silently drop routes/index.html.
 */
import { $ } from "bun";

import { pageEntrypoints } from "#lib/tools.ts";

const { exitCode } =
  await $`bun build --compile --target=browser ${pageEntrypoints()} --outdir=dist --minify`.nothrow();

process.exit(exitCode);
```

- [ ] **Step 11: Repoint `scripts/dev.ts`**

The two page imports change and nothing else does:

```ts
import home from "../routes/index.html";
import combiName from "../routes/combi-name/index.html";
```

- [ ] **Step 12: Delegate `dev` and `build` from `package.json`**

```json
  "scripts": {
    "dev": "bun scripts/dev.ts",
    "fetch-assets": "bun scripts/fetch-assets.ts",
    "build": "bun scripts/build.ts",
    "test": "bun scripts/test.ts",
    "typecheck": "bun scripts/typecheck.ts"
  },
```

Also delete the `"module": "lib/combi-name/codec.ts"` line — the package is private and nothing reads it.

- [ ] **Step 13: Rewrite `lib/tools.test.ts` for the new layout**

The two build-script greps collapse into one existence check over `pageEntrypoints()`, and the page paths change. The whole file:

```ts
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

test("the home page hosts the tool index", async () => {
  const [home] = await pages();
  expect(home).toContain("<tool-index");
});
```

- [ ] **Step 14: Verify the suite and typecheck**

Run: `bun run test && bun run typecheck`
Expected: everything passes. If `routes/combi-name/index.test.ts` fails on a missing element, check that Step 7's dynamic import is below the `innerHTML` assignment.

- [ ] **Step 15: Verify the build produces two self-contained pages**

Run: `rm -rf dist && bun run build`
Expected: `dist/index.html` and `dist/combi-name/index.html`.

Run: `grep -c '@import' dist/combi-name/index.html`
Expected: `0`. The two-level chain — page stylesheet to base stylesheet to Pico — must be fully inlined.

Run: `grep -c 'pico' dist/combi-name/index.html`
Expected: at least 1.

- [ ] **Step 16: Verify the built pages work from disk**

Open `dist/index.html` in a browser straight from the filesystem.
Expected: styled, sidebar rendered, and the tool link points at `combi-name/index.html` — the `file:` form. Follow it and the combi page loads and encodes.

- [ ] **Step 17: Verify the dev server serves every spelling**

Run: `bun run dev`
Expected: `/`, `/index.html`, `/combi-name`, `/combi-name/`, and `/combi-name/index.html` all return a styled page. Check the status code rather than the body when one looks wrong — Bun's 404 is a bare `Not found` with no `<head>`, which reads like a page that lost its `<meta>` tags.

- [ ] **Step 18: Commit**

```bash
git add -A
git commit -m "Lay the site out by route, one directory per page"
```

---

### Task 9: `lib/combi-name/` becomes `routes/combi-name/`

**Files:**
- Move: `lib/combi-name/codec.ts` and `codec.test.ts` to `routes/combi-name/`
- Move: `lib/combi-name/labels.ts` and `labels.test.ts` to `routes/combi-name/`
- Move: `lib/combi-name/describe.ts` and `describe.test.ts` to `routes/combi-name/`
- Move: `lib/combi-name/exhaustive.test.ts` to `routes/combi-name/`
- Modify: `routes/combi-name/index.ts` (three import paths)

**Interfaces:**
- Consumes: nothing new.
- Produces: `routes/combi-name/codec.ts`, `labels.ts`, and `describe.ts`, imported relatively by that route only. `#lib/combi-name/*` stops existing.

The four modules already import each other relatively, so the move itself needs no edits inside them. Only `routes/combi-name/index.ts` names them by subpath.

- [ ] **Step 1: Move all seven files**

```bash
git mv lib/combi-name/codec.ts routes/combi-name/codec.ts
git mv lib/combi-name/codec.test.ts routes/combi-name/codec.test.ts
git mv lib/combi-name/labels.ts routes/combi-name/labels.ts
git mv lib/combi-name/labels.test.ts routes/combi-name/labels.test.ts
git mv lib/combi-name/describe.ts routes/combi-name/describe.ts
git mv lib/combi-name/describe.test.ts routes/combi-name/describe.test.ts
git mv lib/combi-name/exhaustive.test.ts routes/combi-name/exhaustive.test.ts
rmdir lib/combi-name
```

- [ ] **Step 2: Repoint the three imports in the route script**

In `routes/combi-name/index.ts`:

```ts
from "#lib/combi-name/codec.ts"     ->  from "./codec.ts"
from "#lib/combi-name/describe.ts"  ->  from "./describe.ts"
from "#lib/combi-name/labels.ts"    ->  from "./labels.ts"
```

- [ ] **Step 3: Check nothing else referenced the old path**

Run: `grep -rn "lib/combi-name" --include="*.ts" --include="*.html" --include="*.json" --include="*.md" .  | grep -v node_modules | grep -v docs/superpowers`
Expected: no hits outside `AGENTS.md` and `README.md`, which Task 10 rewrites.

- [ ] **Step 4: Verify, exhaustive test included**

Run: `bun run test`
Expected: the whole suite passes. Confirm in the output that `routes/combi-name/exhaustive.test.ts` ran and that its two assertions still hold — they are the guard that no character table changed size during the refactor.

Run: `bun run typecheck`
Expected: clean.

- [ ] **Step 5: Verify `lib/` is down to two modules**

Run: `find lib -type f | sort`
Expected: exactly `lib/href.test.ts`, `lib/href.ts`, `lib/tools.test.ts`, `lib/tools.ts`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Move the combi codec in beside the route that is its only caller"
```

---

### Task 10: Bring the docs level with the code

**Files:**
- Modify: `AGENTS.md` (rewritten)
- Modify: `README.md` (path references)
- Verify: `.github/workflows/deploy.yml` (expected: no change)

**Interfaces:**
- Consumes: the finished tree.
- Produces: nothing importable.

`AGENTS.md` is the file the next agent reads first, and six of its sections describe structure that no longer exists. This is a rewrite, not a find-and-replace.

- [ ] **Step 1: Confirm the workflow needs no change**

Run: `grep -n 'run:' .github/workflows/deploy.yml`
Expected: `bun install --frozen-lockfile`, `bun test`, `bun run typecheck`, `bun run build`, and `path: dist`. The first two are direct Bun commands that still work; the last two resolve through `package.json` to the new script files. If every line matches, leave the file alone.

- [ ] **Step 2: Rewrite the Commands section of `AGENTS.md`**

```markdown
## Commands

```bash
bun install
bun run dev                              # dev server with hot reload; / is the home pane, /combi-name/ is the combi tool
bun run test                             # whole suite, ~3.5s (the exhaustive test dominates)
bun run test routes/combi-name/codec.test.ts   # one file
bun run test -t "decodes every slot"     # one test by name substring
bun run typecheck                        # tsc --noEmit; the test files are typechecked too
bun run build                            # writes one self-contained file per page: dist/index.html, dist/combi-name/index.html
bun run fetch-assets                     # re-scrapes icons into assets/ (idempotent, skips existing)
```

Every script is a file under `scripts/`, so `package.json` holds a delegation
rather than a command. `scripts/test.ts` and `scripts/typecheck.ts` forward
their arguments, which is what keeps the two filtered forms above working.
```

Keep the existing paragraph about the dev server answering every URL spelling and about Bun's bare `Not found` 404 body, changing `web/dev.ts` to `scripts/dev.ts` and the page paths to `routes/`.

- [ ] **Step 3: Replace the Theme and Link shape sections**

The theme feature is unchanged in behaviour, so keep that prose and change where it lives: `web/shared/theme.ts` becomes `components/theme-toggle.ts`, and the paragraph about each page calling `renderThemeControl` after `renderSidebar` is deleted — `<site-nav>` renders `<theme-toggle>` itself, so there is no ordering rule left to state. Note that `renderThemeControl` is still exported as a function because a custom element reports a `connectedCallback` exception to the global error handler instead of throwing to its caller, and the storage-refused test needs something that can throw.

For Link shape, change `hrefFor` in `web/shared/chrome.ts` to `hrefFor` in `lib/href.ts` and leave the rest — the dual http/`file:` behaviour and the four-combination test are unchanged.

- [ ] **Step 4: Rewrite the Architecture and Library layout sections**

`Object.keys` ordering, the `ALL_*` derivation, the hard-errors-vs-soft-warnings split, and the exhaustive test's two counts are all unchanged — only their paths move from `lib/combi-name/` to `routes/combi-name/`. Replace the Library layout section, which describes a tree that no longer exists, with:

```markdown
### Project layout

- `lib/` is code more than one route uses, reached as `#lib/*`. Today that is
  the tool registry and `hrefFor`. It does not own DOM.
- `components/` is every custom element, reached as `#components/*`. It imports
  from `lib/` and never from `routes/` — `<auto-verdict>` declares its own
  structural property type rather than importing `AutoVerdict` from the combi
  route, which is what keeps that arrow pointing one way.
- `routes/<slug>/` is one page: `index.html`, `index.css`, `index.ts`, and that
  route's own logic and tests. `routes/index.*` is the home pane.
- `scripts/` is one file per npm script.
- `tests/` is test configuration only. `bunfig.toml` preloads
  `tests/happydom.ts` for every run, so `document` and `window` exist in all
  test files, not just the DOM ones. No test lives there.

Route-only logic stays in the route. The combi codec is imported by exactly one
page, so it lives at `routes/combi-name/codec.ts` rather than in `lib/`.
```

- [ ] **Step 5: Add a Components section**

A custom element's attribute and property names are now the interface between markup and script, so they need writing down:

```markdown
### Components

Light DOM, no shadow root: Pico styles by element selector, and the two form
components need `<form>` participation and label association. Component styles
live in `routes/index.css` alongside the page layout, scoped by element name.

Attributes carry markup-authored configuration; properties carry structured
data the route hands over. Every `customElements.define` is guarded by
`customElements.get`, because one `bun test` process shares one registry.

| Element | Attributes | Properties |
| --- | --- | --- |
| `<site-nav>` | `current` — tool slug, absent means the home pane | — |
| `<theme-toggle>` | — | — |
| `<tool-index>` | — | — |
| `<labelled-select>` | `label` | `options`, `value` |
| `<check-group>` | `legend` | `options`, `selected` |
| `<copy-code>` | `value` | `value` |
| `<auto-verdict>` | `prefix` | `verdict` |

`<site-nav>` and `<tool-index>` read the registry themselves; no route passes
them data. `<site-nav>` renders `<theme-toggle>` as one of its own children.

`<check-group>`'s `selected` getter filters the element's own `options` rather
than reading DOM order. That is what keeps boosts in slot order and cookie
powers in bit order, and it is part of the wire format rather than a
preference.
```

- [ ] **Step 6: Rewrite Adding a tool down to five steps**

```markdown
### Adding a tool

1. Add an entry to `TOOLS` in `lib/tools.ts`.
2. Create `routes/<slug>/index.html`: `<a class="skip-link" href="#content">Skip
   to content</a>` then `<site-nav current="<slug>"></site-nav>` as the first
   two body children, a `<script id="theme-boot">` block copied from an
   existing page's head above the stylesheet link, `<link rel="stylesheet"
   href="./index.css">`, `<script src="./index.ts" type="module">`, `<main
   id="content" class="container" tabindex="-1">`, and Pico's `container` class
   on `header` and `footer` too.
3. Create `routes/<slug>/index.css` starting with `@import "../index.css";`.
4. Create `routes/<slug>/index.ts` and import the components the page declares,
   so their `customElements.define` calls run.
5. Import the page in `scripts/dev.ts` and add it to `TOOL_PAGES`.

`lib/tools.test.ts` fails until the page exists, links its own stylesheet,
hosts `<site-nav>`, carries the skip link and the theme bootstrap, and is
imported by `scripts/dev.ts`. Step 5 is also a typecheck failure on its own:
`TOOL_PAGES` is a `Record<ToolSlug, HTMLBundle>`, so a registered slug with no
page there does not compile.

Nothing has to be added to the build — `pageEntrypoints()` in `lib/tools.ts`
derives the list from the registry, and `scripts/build.ts` passes it straight
to `bun build`. Nothing in any page's markup names another tool, so the
registry stays the only list.
```

- [ ] **Step 7: Update the Web build section**

Keep the reasoning about `--compile --target=browser`, the project-subpath concern, and the asset-inlining consequence. Replace the explicit-entrypoint-list warning with the derivation, since there is no list to glob away any more:

```markdown
`scripts/build.ts` gets its entrypoints from `pageEntrypoints()` in
`lib/tools.ts` rather than from a list, which is what removed the old warning
about never replacing that list with a glob — `sh` expands `**` as `*`, so a
glob would have silently dropped the home page.

`routes/index.css` is the base stylesheet. It imports Pico's amber theme
(`@picocss/pico/css/pico.amber.min.css`), holds the layout and every
component's rules, and adds only the overrides Pico has no opinion about;
colors come from Pico's custom properties, not a local palette. Each route's
`index.css` imports it and adds page-only rules. The build inlines that
two-level chain, so nothing ships an `@import`.
```

- [ ] **Step 8: Fix the remaining stale paths**

Run: `grep -n 'web/\|lib/combi-name\|lib/shared\|main\.ts\|home\.ts\|styles\.css\|chrome\.ts' AGENTS.md README.md`
Expected after editing: no hits except `routes/index.css`-style paths you intended. Fix each one that refers to the old tree. `README.md` documents the slot format for humans and should need only path corrections.

- [ ] **Step 9: Verify the docs against the code**

Run every command block in the rewritten Commands section and confirm each behaves as documented:

```bash
bun run test routes/combi-name/codec.test.ts
bun run test -t "decodes every slot"
bun run typecheck
bun run build
```

Expected: each does what the doc says.

- [ ] **Step 10: Final whole-project verification**

Run: `bun install --frozen-lockfile && bun run test && bun run typecheck && rm -rf dist && bun run build`
Expected: all four succeed.

Run: `test ! -d web && echo "web/ is gone"`
Expected: prints the message.

Run: `grep -rn '\^\|~\|latest' package.json | grep -v packageManager`
Expected: no version-range hits.

- [ ] **Step 11: Commit**

```bash
git add AGENTS.md README.md
git commit -m "Bring the docs level with the routes-and-components layout"
```

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: target layout (3, 8, 9), light DOM and no shadow root (4-7, and documented in 10), attributes-vs-properties (4-7), guarded registration (4-7), `components/` never importing from `routes/` (7's `Verdict` type), build entrypoints from the registry (8), `<site-nav>` owning the theme control (4), `check-group` owning the ordering guarantee (6), all seven component contracts (4, 5, 6, 7), `hrefFor` moving to `lib/` (4), imports and scripts (2, 4, 8), exact dependencies (1), every test move and split (3, 4, 5, 8, 9), documentation and CI (10), and every success criterion checked in 10's final step.

**Known deviation from the spec.** The spec's layout comment lists `components/theme-toggle.ts` as exporting `readTheme`, `writeTheme`, and `applyTheme`. It also exports `renderThemeControl`, because a custom element reports a `connectedCallback` exception to the global error handler rather than throwing to whoever appended it — so the storage-refused test would pass vacuously if it went through the element. Task 4 Step 6 carries that reasoning in a comment and Task 10 Step 3 writes it into `AGENTS.md`.

**Ordering.** Components land while the pages are still under `web/`, and the tree moves afterwards. This is deliberate: `web/shared/chrome.ts` and `web/shared/theme.ts` have no home in the target layout, so componentizing first means nothing ever sits in an interim location. Task 5 takes `chrome.ts` down to `need` alone and Task 8 folds that into the one route that uses it.
