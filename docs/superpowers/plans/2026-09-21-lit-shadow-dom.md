# Lit, shadow DOM and a hand-written stylesheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all nine custom elements to Lit with shadow roots, replace Pico with a hand-written arcade-console stylesheet built on `@kcstyles/reset.css`, without changing any component's public API.

**Architecture:** Each component becomes a `LitElement` rendering into its own shadow root, carrying its own styles and reading colour only through inherited `--cr-*` custom properties. The page-level sheet keeps the frame — body grid, panels, typography, tables — and nothing else. Theming stays a `data-theme` attribute on the root element.

**Tech Stack:** Bun 1.4.2, TypeScript 7.0.2, Lit 3.3.3, `@kcstyles/reset.css` 1.0.12, Biome 2.5.13, happy-dom 20 under `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-21-lit-shadow-dom-design.md`

## Global Constraints

- **Runtime is Bun.** `bun test`, `bun run check`, `bun <file>`. Never npm, node, jest or vitest.
- **No file extension on a local import.** `from "./theme"`, `from "#lib/tools"`. The exception is a package subpath that publishes one: `from "lit/decorators.js"` is correct and required.
- **Cross-directory imports use the aliases** `#lib/*` and `#components/*`. `src/components/` may import from `src/lib/` and never from `src/routes/`.
- **No `accessor` keyword.** `tsconfig.json` sets `experimentalDecorators: true`, under which Bun's transpiler rejects `accessor` outright (`Expected ";" but found "options"`, bun#43097). Declare reactive properties as plain fields: `@property({ attribute: false }) options: readonly Option[] = [];`
- **Every `customElements.define` stays guarded** by `if (!customElements.get(...))`. One `bun test` process shares one registry across every test file.
- **Public API is frozen.** Every component keeps exactly the attributes and properties in the `ui-components` skill table. No route file is edited by this plan.
- **Components read colour only through `--cr-*` custom properties.** No hard-coded colour inside a component.
- **Biome formats with tabs.** Run `bun run format` before committing if `bun run check:biome` complains.
- **`bun run check` and `bun run test` pass at every commit.**
- **Order changed from the spec, deliberately:** the spec's commit 1 was "token layer and hand-written base stylesheet". Replacing Pico's import that early would leave the still-light-DOM components unstyled for three commits. Task 1 therefore ships the token layer only, with Pico still imported, and the page-frame rewrite plus Pico's removal land together in Task 8.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/routes/tokens.css` | create — every `--cr-*` custom property, dark default and light variant. The only theming surface. |
| `src/components/theme.ts` | create — two shared Lit `css` chunks every component adopts: shadow-scoped reset, control primitives. |
| `src/components/*.ts` | rewrite — nine `LitElement`s, each carrying its own styles. |
| `src/components/*.test.ts` | rewrite — reach through `shadowRoot`, await `updateComplete`. |
| `src/routes/base.css` | rewrite in Task 8 — reset + tokens import, page frame only. Drops from 510 lines to roughly 150. |
| `src/routes/index.css`, `src/routes/combi-name/index.css` | rewrite in Task 8 — `--pico-*` references become `--cr-*`. |
| `src/routes/combi-name/index.html`, `src/routes/index.html` | edit in Task 8 — Pico's utility classes leave. |
| `src/routes/combi-name/index.test.ts` | edit in Task 5 — its `copy-code` hint assertions reach through a shadow root. |
| `package.json` | `lit` and `@kcstyles/reset.css` in, `@picocss/pico` out. |
| `AGENTS.md`, three skills | update in Task 9. |

---

### Task 1: Token layer and shared component styles

**Files:**
- Create: `src/routes/tokens.css`
- Create: `src/components/theme.ts`
- Modify: `src/routes/base.css:1-4` (add the tokens import, keep Pico's)
- Modify: `package.json` (dependencies)

**Interfaces:**
- Consumes: nothing.
- Produces: `src/routes/tokens.css`, a stylesheet defining `--cr-bg`, `--cr-surface`, `--cr-surface-2`, `--cr-text`, `--cr-muted`, `--cr-line`, `--cr-accent`, `--cr-accent-2`, `--cr-danger`, `--cr-border`, `--cr-radius`, `--cr-block`, `--cr-space-1` … `--cr-space-5`, `--cr-font`, `--cr-mono`, `--cr-tracking`. And `src/components/theme.ts`, exporting two `CSSResult` values named `base` and `controls`, imported by every component as `import { base, controls } from "./theme"`.

- [ ] **Step 1: Confirm the dependencies are installed**

Run: `bun add lit @kcstyles/reset.css`

Expected: `lit@3.3.3` and `@kcstyles/reset.css@1.0.12` in `package.json` dependencies. `@picocss/pico` stays for now.

- [ ] **Step 2: Write the token sheet**

Create `src/routes/tokens.css`:

```css
/* Every colour, space and edge the site uses. Custom properties inherit
   through shadow boundaries, which is what lets a component read a token
   without importing anything. A component reads colour no other way.

   Dark is the default and light is the variant: "system" is the absence of
   `data-theme`, so the media query has to exclude an explicit dark choice
   rather than assume one. */
:root {
	--cr-bg: #0e0e12;
	--cr-surface: #17171f;
	--cr-surface-2: #1f1f2b;
	--cr-text: #f2f2f5;
	--cr-muted: #9a9aae;
	--cr-line: #2e2e3d;
	--cr-accent: #ff3d7f;
	--cr-accent-2: #ffd23f;
	--cr-danger: #ff6b5e;

	--cr-border: 2px;
	--cr-radius: 2px;
	--cr-block: 4px 4px 0 var(--cr-line);

	--cr-space-1: 0.25rem;
	--cr-space-2: 0.5rem;
	--cr-space-3: 0.75rem;
	--cr-space-4: 1rem;
	--cr-space-5: 1.5rem;

	--cr-font: system-ui, sans-serif;
	--cr-mono: ui-monospace, SFMono-Regular, Menlo, monospace;
	--cr-tracking: 0.08em;
}

/* Paper rather than white, near-black lines: the arcade language survives the
   switch instead of softening into a generic light theme. */
@media (prefers-color-scheme: light) {
	:root:not([data-theme="dark"]) {
		--cr-bg: #f4f4f0;
		--cr-surface: #ffffff;
		--cr-surface-2: #eceae4;
		--cr-text: #12121a;
		--cr-muted: #5d5d6b;
		--cr-line: #12121a;
		--cr-accent: #d81b60;
		--cr-accent-2: #a86800;
	}
}

:root[data-theme="light"] {
	--cr-bg: #f4f4f0;
	--cr-surface: #ffffff;
	--cr-surface-2: #eceae4;
	--cr-text: #12121a;
	--cr-muted: #5d5d6b;
	--cr-line: #12121a;
	--cr-accent: #d81b60;
	--cr-accent-2: #a86800;
}
```

Note the light accents are darkened from the dark-theme magenta and amber: `#ff3d7f` on paper and `#ffd23f` as text both fail contrast.

- [ ] **Step 3: Write the shared component style chunks**

Create `src/components/theme.ts`:

```ts
import { css } from "lit";

/**
 * A page-level reset does not cross a shadow boundary, so every shadow root
 * needs its own. This is the minimum that matters: the box model, and the
 * font inheritance that form controls refuse by default.
 *
 * Lit shares one `CSSStyleSheet` instance across every component adopting the
 * same `CSSResult`, so importing this nine times costs one sheet.
 */
export const base = css`
	*,
	*::before,
	*::after {
		box-sizing: border-box;
	}

	button,
	input,
	select {
		font: inherit;
		color: inherit;
	}

	:host {
		font-family: var(--cr-font);
		color: var(--cr-text);
	}
`;

/**
 * The control primitives, shared because a select in the sidebar and a select
 * in the builder are the same control. Two-pixel edges, hard offset blocks,
 * no blur anywhere: that is the whole visual language.
 */
export const controls = css`
	button {
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface-2);
		padding: var(--cr-space-1) var(--cr-space-3);
		box-shadow: var(--cr-block);
		font-family: var(--cr-mono);
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
		cursor: pointer;
	}

	/* Pressed means moved into its own shadow, which is the arcade gesture. */
	button:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}

	button:focus-visible,
	input:focus-visible,
	select:focus-visible,
	summary:focus-visible {
		outline: var(--cr-border) solid var(--cr-accent);
		outline-offset: 2px;
	}

	input,
	select {
		width: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-bg);
		padding: var(--cr-space-1) var(--cr-space-2);
	}

	label {
		display: block;
		color: var(--cr-muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
	}
`;
```

- [ ] **Step 4: Import the tokens from the base sheet**

Modify `src/routes/base.css` — add one line after the Pico import at line 4, leaving everything else untouched:

```css
@import "@picocss/pico/css/pico.amber.min.css";
@import "./tokens.css";
```

Pico still paints the site. The tokens are defined and unused, which is what makes this commit invisible.

- [ ] **Step 5: Verify nothing changed**

Run: `bun run check && bun run test`

Expected: both pass. The token sheet is valid CSS that nothing reads yet; `theme.ts` typechecks.

- [ ] **Step 6: Commit**

```bash
git add package.json bun.lock src/routes/tokens.css src/routes/base.css src/components/theme.ts
git commit -m "feat: arcade token layer and shared component styles"
```

---

### Task 2: tool-index and auto-verdict on Lit

The two simplest components, migrated first to establish the pattern every later task repeats.

**Files:**
- Modify: `src/components/tool-index.ts` (full rewrite)
- Modify: `src/components/auto-verdict.ts` (full rewrite)
- Test: `src/components/tool-index.test.ts`, `src/components/auto-verdict.test.ts`

**Interfaces:**
- Consumes: `base` and `controls` from `./theme` (Task 1).
- Produces: the pattern every later component follows — `class X extends LitElement`, `static override styles = [base, controls, css\`…\`]`, `override render()`, guarded `customElements.define`, `declare global` block retained. `<auto-verdict>` keeps its `prefix` attribute and `verdict` property (`{ semi: boolean; reasons: readonly string[] } | null`). `<tool-index>` keeps its empty API.

- [ ] **Step 1: Write the failing tests**

Rewrite `src/components/tool-index.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools";

import "./tool-index";

import type { ToolIndex } from "./tool-index";

async function mount(): Promise<ToolIndex> {
	document.body.replaceChildren();
	const element = document.createElement("tool-index") as ToolIndex;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

test("every registered tool gets a term and a description", async () => {
	const element = await mount();

	expect(element.shadowRoot?.querySelectorAll("dt").length).toBe(TOOLS.length);
	expect(element.shadowRoot?.querySelectorAll("dd").length).toBe(TOOLS.length);
});

test("each term links to its tool from the home pane", async () => {
	const element = await mount();
	const link = element.shadowRoot?.querySelector("dt a");

	expect(link?.getAttribute("href")).toBe("./combi-name/");
	expect(link?.textContent).toBe("Combi name codes");
});
```

Rewrite `src/components/auto-verdict.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./auto-verdict";

import type { AutoVerdictElement } from "./auto-verdict";

async function mount(prefix: string | null): Promise<AutoVerdictElement> {
	document.body.replaceChildren();
	const element = document.createElement("auto-verdict") as AutoVerdictElement;
	if (prefix !== null) element.setAttribute("prefix", prefix);
	document.body.append(element);
	await element.updateComplete;
	return element;
}

async function text(element: AutoVerdictElement): Promise<string> {
	await element.updateComplete;
	return (element.shadowRoot?.textContent ?? "").replace(/\s+/g, " ").trim();
}

test("nothing is said until there is a verdict", async () => {
	const element = await mount("Stored as");

	expect(await text(element)).toBe("");
});

test("full auto says nothing needs manual work", async () => {
	const element = await mount("Stored as");
	element.verdict = { semi: false, reasons: [] };

	expect(await text(element)).toBe(
		"Stored as Full auto - nothing needs manual work each run.",
	);
});

test("one reason reads as a singular", async () => {
	const element = await mount("This code is");
	element.verdict = { semi: true, reasons: ["Fast Start"] };

	expect(await text(element)).toBe(
		"This code is Semi-auto - Fast Start needs manual work each run.",
	);
});

test("several reasons read as a plural, joined by commas", async () => {
	const element = await mount("This code is");
	element.verdict = { semi: true, reasons: ["Fast Start", "a jump"] };

	expect(await text(element)).toBe(
		"This code is Semi-auto - Fast Start, a jump need manual work each run.",
	);
});

// Without a prefix the line has to open on the verdict, not on a stray space.
test("an element without a prefix opens on the verdict", async () => {
	const element = await mount(null);
	element.verdict = { semi: false, reasons: [] };

	expect(await text(element)).toBe(
		"Full auto - nothing needs manual work each run.",
	);
});

test("the element announces itself politely", async () => {
	const element = await mount("Stored as");

	expect(element.getAttribute("aria-live")).toBe("polite");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/tool-index.test.ts src/components/auto-verdict.test.ts`

Expected: FAIL. `element.updateComplete` is undefined on a plain `HTMLElement`, and `shadowRoot` is null.

- [ ] **Step 3: Rewrite tool-index**

Replace `src/components/tool-index.ts` entirely:

```ts
import { css, html, LitElement } from "lit";

import { hrefFor } from "#lib/href";
import { TOOLS } from "#lib/tools";

import { base } from "./theme";

/**
 * The home pane's index. The sidebar carries the same names, but only as
 * names - this is where a tool gets to say what it does.
 */
export class ToolIndex extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			dl {
				margin: 0;
			}

			dt {
				font-family: var(--cr-mono);
				font-size: 1.05rem;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			dt a {
				color: var(--cr-accent);
				text-decoration: none;
			}

			dt a:hover {
				text-decoration: underline;
			}

			dd {
				margin: var(--cr-space-1) 0 var(--cr-space-3);
				max-width: 46rem;
				color: var(--cr-muted);
			}

			dd:last-child {
				margin-bottom: 0;
			}
		`,
	];

	override render() {
		return html`<dl>
			${TOOLS.map(
				({ slug, name, tagline }) => html`
					<dt><a href=${hrefFor(slug, null)}>${name}</a></dt>
					<dd>${tagline}</dd>
				`,
			)}
		</dl>`;
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

- [ ] **Step 4: Rewrite auto-verdict**

Replace `src/components/auto-verdict.ts` entirely:

```ts
import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { base } from "./theme";

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

export class AutoVerdictElement extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
				margin-top: var(--cr-space-3);
				font-family: var(--cr-mono);
				font-size: 0.9rem;
			}

			strong {
				color: var(--cr-accent);
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}
		`,
	];

	@property({ type: String })
	prefix = "";

	@property({ attribute: false })
	verdict: Verdict | null = null;

	override connectedCallback(): void {
		super.connectedCallback();
		this.setAttribute("aria-live", "polite");
	}

	override render() {
		if (this.verdict === null) return nothing;

		const { semi, reasons } = this.verdict;
		const tail = semi
			? ` - ${reasons.join(", ")} ${
					reasons.length === 1 ? "needs" : "need"
				} manual work each run.`
			: " - nothing needs manual work each run.";

		// The separating space belongs to the prefix, not to the verdict, or an
		// element without one opens with a stray space before "Full auto".
		return html`${this.prefix === "" ? nothing : `${this.prefix} `}<strong
				>${semi ? "Semi-auto" : "Full auto"}</strong
			>${tail}`;
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/components/tool-index.test.ts src/components/auto-verdict.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 6: Run the whole suite and the checks**

Run: `bun run test && bun run check`

Expected: PASS. `src/routes/index.css` still has `tool-index dl { … }` rules that now match nothing — harmless, and Task 8 removes them.

- [ ] **Step 7: Commit**

```bash
git add src/components/tool-index.ts src/components/auto-verdict.ts src/components/tool-index.test.ts src/components/auto-verdict.test.ts
git commit -m "feat: tool-index and auto-verdict on Lit"
```

---

### Task 3: site-nav and theme-toggle on Lit

**Files:**
- Modify: `src/components/theme-toggle.ts` (full rewrite, `renderThemeControl` deleted)
- Modify: `src/components/site-nav.ts` (full rewrite)
- Test: `src/components/theme-toggle.test.ts`, `src/components/site-nav.test.ts`

**Interfaces:**
- Consumes: `base`, `controls` from `./theme`; `hrefFor` from `#lib/href`; `TOOLS`, `ToolSlug` from `#lib/tools`.
- Produces: `theme-toggle.ts` still exports `THEME_KEY`, `readTheme(storage)`, `writeTheme(theme, storage)`, `applyTheme(theme, root)` and the `Theme` type, with identical signatures. It no longer exports `renderThemeControl`. `<site-nav>` keeps its `current` attribute and renders a `<theme-toggle>` inside its own shadow root.

- [ ] **Step 1: Write the failing tests**

Rewrite `src/components/theme-toggle.test.ts`. The three pure functions are tested exactly as before; the element tests seed `localStorage` instead of injecting a fake, because the element reads the real one:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import {
	applyTheme,
	readTheme,
	THEME_KEY,
	writeTheme,
} from "./theme-toggle";

import "./theme-toggle";

import type { ThemeToggle } from "./theme-toggle";

function fakeStorage(seed: Record<string, string> = {}) {
	const store = new Map(Object.entries(seed));
	return {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => void store.set(key, value),
		removeItem: (key: string) => void store.delete(key),
		read: () => store.get(THEME_KEY) ?? null,
	};
}

async function mount(): Promise<ThemeToggle> {
	document.body.replaceChildren();
	const element = document.createElement("theme-toggle") as ThemeToggle;
	document.body.append(element);
	await element.updateComplete;
	return element;
}

function select(element: ThemeToggle): HTMLSelectElement {
	const found = element.shadowRoot?.querySelector("select");
	if (found === null || found === undefined) throw new Error("no select");
	return found;
}

test("an unset or unrecognised choice falls back to following the system", () => {
	expect(readTheme(fakeStorage())).toBe("system");
	expect(readTheme(fakeStorage({ [THEME_KEY]: "sepia" }))).toBe("system");
	expect(readTheme(fakeStorage({ [THEME_KEY]: "dark" }))).toBe("dark");
});

// The stylesheet reads prefers-color-scheme only when the attribute is absent,
// so "system" has to remove it rather than write some third value.
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

// Called as functions on purpose. A custom element reports a callback
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

	expect(readTheme(hostile)).toBe("system");
	expect(() => writeTheme("dark", hostile)).not.toThrow();
	expect(() => applyTheme("dark", document.createElement("html"))).not.toThrow();
});

test("the control offers the three choices and starts on the stored one", async () => {
	localStorage.setItem(THEME_KEY, "light");
	const element = await mount();

	expect([...select(element).options].map((option) => option.value)).toEqual([
		"system",
		"light",
		"dark",
	]);
	expect(select(element).value).toBe("light");
	expect(document.documentElement.getAttribute("data-theme")).toBe("light");
	expect(element.shadowRoot?.querySelector("label")?.htmlFor).toBe(
		select(element).id,
	);

	localStorage.removeItem(THEME_KEY);
	applyTheme("system", document.documentElement);
});

test("choosing a theme paints the page and remembers it", async () => {
	localStorage.removeItem(THEME_KEY);
	const element = await mount();
	const control = select(element);

	control.value = "dark";
	control.dispatchEvent(new Event("change"));

	expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
	expect(localStorage.getItem(THEME_KEY)).toBe("dark");

	control.value = "system";
	control.dispatchEvent(new Event("change"));

	expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
	expect(localStorage.getItem(THEME_KEY)).toBe(null);
});
```

Rewrite `src/components/site-nav.test.ts` — every query gains `shadowRoot` and `mount` becomes async:

```ts
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

test("the sidebar lists home plus every registered tool", async () => {
	expect((await mount(null)).querySelectorAll("a").length).toBe(
		TOOLS.length + 1,
	);
});

test("links from the home page stay in the current directory", async () => {
	const links = (await mount(null)).querySelectorAll("a");

	expect(links[0]?.getAttribute("href")).toBe("./");
	expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});

test("links from a tool page climb out of it first", async () => {
	const links = (await mount("combi-name")).querySelectorAll("a");

	expect(links[0]?.getAttribute("href")).toBe("../");
	expect(links[1]?.getAttribute("href")).toBe("../combi-name/");
});

test("the current tool is the only entry marked", async () => {
	const marked = (await mount("combi-name")).querySelectorAll(
		'[aria-current="page"]',
	);

	expect(marked.length).toBe(1);
	expect(marked[0]?.textContent).toBe("Combi name codes");
});

test("home is marked when no tool is active", async () => {
	const marked = (await mount(null)).querySelectorAll('[aria-current="page"]');

	expect(marked.length).toBe(1);
	expect(marked[0]?.textContent).toBe("Home");
});

// A slug that was never registered - a typo copied from another page, or a
// tool that got renamed - used to pass straight through an `as ToolSlug`
// cast. That handed hrefFor a non-null `from`, which writes `../`-prefixed
// links: a root-level page would get links that climb out of the site
// entirely instead of merely landing on the home pane.
test("an unregistered current value is treated as the home pane", async () => {
	const nav = await mount("not-a-real-tool");

	const marked = nav.querySelectorAll('[aria-current="page"]');
	expect(marked.length).toBe(1);
	expect(marked[0]?.textContent).toBe("Home");

	const links = nav.querySelectorAll("a");
	expect(links[0]?.getAttribute("href")).toBe("./");
	expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});

// The pages used to wire this themselves, in an order that had to be right.
test("the sidebar renders the theme control itself", async () => {
	expect((await mount(null)).querySelector("theme-toggle")).not.toBeNull();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/theme-toggle.test.ts src/components/site-nav.test.ts`

Expected: FAIL — `renderThemeControl` no longer imported but still exists is fine; the failures are `updateComplete` undefined and `shadowRoot` null.

- [ ] **Step 3: Rewrite theme-toggle**

Replace `src/components/theme-toggle.ts` entirely. The three pure functions are unchanged; `renderThemeControl` is gone and the element renders declaratively:

```ts
import { css, html, LitElement } from "lit";

import { base, controls } from "./theme";

/**
 * The stylesheet paints dark by default, light under `prefers-color-scheme`,
 * and obeys `data-theme` on the root over both. So the whole feature is:
 * remember a choice, write that attribute, and let the tokens do the rest.
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
	if (theme === "system") root.removeAttribute("data-theme");
	else root.setAttribute("data-theme", theme);
}

export class ThemeToggle extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			select {
				margin-top: var(--cr-space-1);
				font-size: 0.85rem;
			}
		`,
	];

	override connectedCallback(): void {
		super.connectedCallback();
		applyTheme(readTheme(localStorage), document.documentElement);
	}

	#choose(event: Event): void {
		const value = (event.target as HTMLSelectElement).value;
		const chosen = isTheme(value) ? value : "system";
		applyTheme(chosen, document.documentElement);
		writeTheme(chosen, localStorage);
	}

	override render() {
		const current = readTheme(localStorage);
		return html`
			<label for="theme-choice">Theme</label>
			<select
				id="theme-choice"
				.value=${current}
				@change=${(event: Event) => {
					this.#choose(event);
				}}
			>
				${THEMES.map(
					(theme) =>
						html`<option value=${theme} ?selected=${theme === current}>
							${LABELS[theme]}
						</option>`,
				)}
			</select>
		`;
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

- [ ] **Step 4: Rewrite site-nav**

Replace `src/components/site-nav.ts` entirely. Every sidebar rule from `base.css:92-235` moves in here, and the triple-type-selector fight with Pico goes away with the framework that caused it:

```ts
import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { hrefFor } from "#lib/href";
import { TOOLS, type ToolSlug } from "#lib/tools";

import { base } from "./theme";
import "./theme-toggle";

/**
 * The sidebar every page carries. Navigation comes from the registry, so
 * nothing in any page's markup names another tool, and the theme control is
 * rendered here rather than left as a slot for the page to fill.
 */
export class SiteNav extends LitElement {
	static override styles = [
		base,
		css`
			/* Full viewport height, not the height of its links: a rail that stops
			   halfway down the page reads as a panel that failed to load. */
			:host {
				display: flex;
				flex-direction: column;
				position: sticky;
				top: 0;
				grid-row: 1 / -1;
				align-self: start;
				height: 100dvh;
				overflow-y: auto;
				padding: var(--cr-space-4) var(--cr-space-3);
				border-right: var(--cr-border) solid var(--cr-line);
				background: var(--cr-surface);
			}

			.title {
				margin: 0 0 var(--cr-space-3);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
				font-weight: 600;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			/* Spaced, or the hovered link and the current one run together into a
			   single slab and neither reads as its own button. */
			ul {
				display: grid;
				gap: var(--cr-space-1);
				margin: 0;
				padding: 0;
				list-style: none;
			}

			a {
				display: block;
				padding: var(--cr-space-1) var(--cr-space-2);
				border-left: var(--cr-border) solid transparent;
				color: inherit;
				font-family: var(--cr-mono);
				text-decoration: none;
			}

			/* Lighter than the current-page tint below, or hovering a link would
			   look more like "you are here" than being there does. */
			a:hover {
				background: color-mix(in srgb, var(--cr-accent) 7%, transparent);
			}

			a:focus-visible {
				outline: var(--cr-border) solid var(--cr-accent);
				outline-offset: 2px;
			}

			/* Tint plus a marker, the same gesture the entry rows use. A solid
			   block here would outshout the code the tool exists to produce. */
			a[aria-current="page"] {
				border-left-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
				font-weight: 600;
			}

			/* Settling, not navigating: the theme control sits at the far end of
			   the rail so it never competes with the tool list. */
			theme-toggle {
				margin-top: auto;
				padding-top: var(--cr-space-3);
			}

			/* Under the breakpoint the rail stops being a column and rides along
			   the top as a row of links. */
			@media (width < 48rem) {
				:host {
					position: static;
					grid-row: auto;
					height: auto;
					border-right: 0;
					border-bottom: var(--cr-border) solid var(--cr-line);
				}

				ul {
					display: flex;
					flex-wrap: wrap;
					gap: var(--cr-space-2);
				}

				theme-toggle {
					margin-top: var(--cr-space-3);
					padding-top: 0;
				}
			}
		`,
	];

	@property({ type: String })
	current = "";

	override render() {
		// A cast here would let a typo through as a truthy `from`: hrefFor would
		// then write `../`-prefixed links for a page that was never registered,
		// sending every link outside the site instead of merely failing to mark
		// anything current.
		const active = TOOLS.some((tool) => tool.slug === this.current)
			? (this.current as ToolSlug)
			: null;

		const entries = [
			{ href: hrefFor(null, active), label: "Home", current: active === null },
			...TOOLS.map(({ slug, name }) => ({
				href: hrefFor(slug, active),
				label: name,
				current: slug === active,
			})),
		];

		return html`
			<p class="title">Cookie Run tools</p>
			<nav aria-label="Tools">
				<ul>
					${entries.map(
						({ href, label, current }) => html`<li>
							<a href=${href} aria-current=${current ? "page" : nothing}
								>${label}</a
							>
						</li>`,
					)}
				</ul>
			</nav>
			<theme-toggle></theme-toggle>
		`;
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

Binding `aria-current` to `nothing` removes the attribute rather than writing an empty one, which is what makes "the current tool is the only entry marked" pass.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/components/theme-toggle.test.ts src/components/site-nav.test.ts`

Expected: PASS, 13 tests.

- [ ] **Step 6: Run the whole suite and the checks**

Run: `bun run test && bun run check`

Expected: PASS. `src/lib/tools.test.ts` is untouched and still passes — it asserts the `theme-boot` block in each page head, which this task does not move.

- [ ] **Step 7: Commit**

```bash
git add src/components/site-nav.ts src/components/theme-toggle.ts src/components/site-nav.test.ts src/components/theme-toggle.test.ts
git commit -m "feat: site-nav and theme-toggle on Lit"
```

---

### Task 4: labelled-select and check-group on Lit

Both are form controls the route listens to, and this is where the shadow boundary bites: `change` is not composed, and a synthetic `new Event("input", { bubbles: true })` is not composed either, so neither escapes the shadow root. Both components therefore re-dispatch `input` from the host.

**Files:**
- Modify: `src/components/labelled-select.ts` (full rewrite)
- Modify: `src/components/check-group.ts` (full rewrite)
- Test: `src/components/labelled-select.test.ts`, `src/components/check-group.test.ts`

**Interfaces:**
- Consumes: `base`, `controls` from `./theme`.
- Produces: `<labelled-select>` keeps its `label` attribute, `options: readonly [string, string][]` and `value: string`. `<check-group>` keeps its `legend` attribute, `options` and `selected: string[]`. Both now dispatch `new Event("input", { bubbles: true })` from the host whenever the user changes them.

- [ ] **Step 1: Write the failing tests**

Rewrite `src/components/check-group.test.ts`. Note the two substantive changes: ticking a box is now done by clicking it (the internal `Set` is fed by the `change` handler, so setting `.checked` directly no longer tells the component anything), and the bubbling test asserts the host's own re-dispatched event:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./check-group";

import type { CheckGroup } from "./check-group";

async function mount(id: string, legend: string): Promise<CheckGroup> {
	document.body.replaceChildren();
	const element = document.createElement("check-group") as CheckGroup;
	element.id = id;
	element.setAttribute("legend", legend);
	document.body.append(element);
	element.options = [
		["hp", "HP Extension"],
		["power", "Power Jelly Boost"],
		["fast", "Fast Start"],
	];
	await element.updateComplete;
	return element;
}

function inputs(element: CheckGroup): HTMLInputElement[] {
	return [...(element.shadowRoot?.querySelectorAll("input") ?? [])];
}

test("the legend names the group", async () => {
	const element = await mount("boosts", "Boosts");

	expect(element.shadowRoot?.querySelector("legend")?.textContent).toBe(
		"Boosts",
	);
});

test("a checkbox is rendered per option, in the order given", async () => {
	const element = await mount("boosts", "Boosts");

	expect(inputs(element).map((input) => input.value)).toEqual([
		"hp",
		"power",
		"fast",
	]);
});

// This is the wire format. Boosts occupy slots 4-6 and cookie powers are bit
// positions, so reading back in click order would reorder the code.
test("selected reads back in the option order, not the order ticked", async () => {
	const element = await mount("boosts", "Boosts");

	inputs(element)[2]?.click();
	await element.updateComplete;
	inputs(element)[0]?.click();
	await element.updateComplete;

	expect(element.selected).toEqual(["hp", "fast"]);
});

test("setting selected ticks exactly those boxes", async () => {
	const element = await mount("boosts", "Boosts");

	element.selected = ["power"];
	await element.updateComplete;
	expect(inputs(element).map((input) => input.checked)).toEqual([
		false,
		true,
		false,
	]);

	element.selected = [];
	await element.updateComplete;
	expect(inputs(element).map((input) => input.checked)).toEqual([
		false,
		false,
		false,
	]);
});

test("a value that is not an option is ignored rather than invented", async () => {
	const element = await mount("boosts", "Boosts");

	element.selected = ["hp", "nonsense"];
	await element.updateComplete;

	expect(element.selected).toEqual(["hp"]);
});

// `change` does not cross a shadow boundary, so the component has to say so
// itself or the page never hears that a box was ticked.
test("ticking a box bubbles an input event out of the element", async () => {
	const element = await mount("boosts", "Boosts");
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	inputs(element)[0]?.click();
	await element.updateComplete;

	expect(seen).toBe(1);
	expect(element.selected).toEqual(["hp"]);
});
```

Rewrite `src/components/labelled-select.test.ts` the same way. Read the current file first and keep every assertion; the mechanical changes are: `mount` becomes `async` and awaits `updateComplete`, `element.querySelector` becomes `element.shadowRoot?.querySelector`, and any test that sets a property awaits `updateComplete` before asserting. Add one test for the re-dispatched event:

```ts
test("choosing an option bubbles an input event out of the element", async () => {
	const element = await mount();
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	const select = element.shadowRoot?.querySelector("select");
	if (select == null) throw new Error("no select");
	select.value = "money";
	select.dispatchEvent(new Event("change"));

	expect(seen).toBe(1);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test src/components/check-group.test.ts src/components/labelled-select.test.ts`

Expected: FAIL — `shadowRoot` null.

- [ ] **Step 3: Rewrite labelled-select**

Replace `src/components/labelled-select.ts` entirely:

```ts
import { css, html, LitElement } from "lit";
import { property } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [value: string, label: string];

let sequence = 0;

/**
 * A label and a select, built from `[value, label]` pairs handed in as a
 * property. The pairs come from the caller's canonical list, so the option
 * order is the caller's order.
 */
export class LabelledSelect extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			select {
				margin-top: var(--cr-space-1);
			}
		`,
	];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	#generated: string | null = null;

	#chosen = "";

	/**
	 * Derived from the host id where there is one, so the generated id reads as
	 * belonging to this control rather than to a counter. Computed on first
	 * render rather than at construction: an element created by
	 * `document.createElement` has no id yet, and the tests set one afterwards.
	 */
	get #id(): string {
		if (this.id !== "") return `${this.id}-select`;
		this.#generated ??= `select-${++sequence}`;
		return this.#generated;
	}

	get value(): string {
		const select = this.shadowRoot?.querySelector("select");
		return select?.value ?? this.#chosen;
	}

	set value(value: string) {
		this.#chosen = value;
		const select = this.shadowRoot?.querySelector("select");
		if (select !== null && select !== undefined) select.value = value;
		this.requestUpdate();
	}

	/**
	 * `change` is not composed, so it dies at the shadow boundary. The page
	 * listens for `input` on the form, so the element says it itself.
	 */
	#changed(event: Event): void {
		event.stopPropagation();
		this.#chosen = (event.target as HTMLSelectElement).value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		return html`
			<label for=${this.#id}>${this.label}</label>
			<select
				id=${this.#id}
				.value=${this.#chosen}
				@change=${(event: Event) => {
					this.#changed(event);
				}}
			>
				${this.options.map(
					([value, text]) => html`<option value=${value}>${text}</option>`,
				)}
			</select>
		`;
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

- [ ] **Step 4: Rewrite check-group**

Replace `src/components/check-group.ts` entirely. The one real change is that `selected` now reads an internal `Set` rather than the DOM, because Lit owns the DOM:

```ts
import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [value: string, label: string];

/**
 * A fieldset of checkboxes built from `[value, label]` pairs.
 *
 * `selected` filters this element's own `options` rather than reading the
 * order boxes were ticked in, which is what keeps boosts in slot order and
 * cookie powers in bit order. That ordering is part of the combi wire format,
 * not a preference.
 *
 * The ticked set lives here rather than in the DOM: Lit owns the DOM now, so
 * reading `input:checked` back would be reading its output rather than this
 * element's state.
 */
export class CheckGroup extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			fieldset {
				margin: 0;
				border: 0;
				border-top: var(--cr-border) solid var(--cr-line);
				padding: var(--cr-space-2) 0 0;
			}

			legend {
				padding-right: var(--cr-space-1);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
				font-weight: 600;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			/* Seven cookie powers in one column made the builder twice the height
			   of everything beside it. */
			.checks {
				display: grid;
				gap: var(--cr-space-1) var(--cr-space-4);
				grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
			}

			.checks label {
				display: flex;
				gap: var(--cr-space-2);
				align-items: center;
				color: var(--cr-text);
				font-family: var(--cr-font);
				font-size: 0.9rem;
				text-transform: none;
				letter-spacing: normal;
			}

			.checks input {
				width: auto;
				accent-color: var(--cr-accent);
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private chosen: ReadonlySet<string> = new Set();

	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.chosen.has(value));
	}

	set selected(values: readonly string[]) {
		const known = new Set(this.options.map(([value]) => value));
		this.chosen = new Set(values.filter((value) => known.has(value)));
	}

	/**
	 * `change` is not composed, so it dies at the shadow boundary. The page
	 * listens for `input` on the form, so the element says it itself.
	 */
	#toggle(value: string, checked: boolean): void {
		const next = new Set(this.chosen);
		if (checked) next.add(value);
		else next.delete(value);
		this.chosen = next;
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	override render() {
		return html`<fieldset>
			<legend>${this.legend}</legend>
			<div class="checks">
				${this.options.map(
					([value, text]) => html`<label>
						<input
							type="checkbox"
							.value=${value}
							.checked=${this.chosen.has(value)}
							@change=${(event: Event) => {
								event.stopPropagation();
								this.#toggle(value, (event.target as HTMLInputElement).checked);
							}}
						/>${text}
					</label>`,
				)}
			</div>
		</fieldset>`;
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

- [ ] **Step 5: Run the tests to verify they pass**

Run: `bun run test src/components/check-group.test.ts src/components/labelled-select.test.ts`

Expected: PASS.

- [ ] **Step 6: Run the whole suite and the checks**

Run: `bun run test && bun run check`

Expected: PASS, including `src/routes/combi-name/index.test.ts`, which drives the builder through these controls. If a route test fails because it set `.checked` on a checkbox directly, change it to `.click()` — that is the same substantive change made in this task's own tests, for the same reason.

- [ ] **Step 7: Commit**

```bash
git add src/components/labelled-select.ts src/components/check-group.ts src/components/labelled-select.test.ts src/components/check-group.test.ts
git commit -m "feat: labelled-select and check-group on Lit"
```

---

### Task 5: copy-code on Lit, with its own tooltip

Pico supplied the `[data-tooltip]` bubble. This task replaces it. The attribute names stay — `data-tooltip`, `data-placement` — so the `hints` API and every assertion about it are unchanged.

**Files:**
- Modify: `src/components/copy-code.ts` (full rewrite)
- Test: `src/components/copy-code.test.ts`
- Modify: `src/routes/combi-name/index.test.ts:220-230` (its hint assertions reach through the shadow root)

**Interfaces:**
- Consumes: `base`, `controls` from `./theme`.
- Produces: `<copy-code>` keeps its `value` attribute and property, and its `hints: readonly CharHint[]` property where `CharHint = { char: string; hint: string; group: string }`. Setting `value` still clears both the status line and the hints. The `value` property reflects to the attribute.

- [ ] **Step 1: Write the failing test**

Rewrite `src/components/copy-code.test.ts`: `mount` becomes async and awaits `updateComplete`, every `element.querySelector` becomes `element.shadowRoot?.querySelector`, and each property set is followed by `await element.updateComplete`. The clipboard tests already await; keep `await Bun.sleep(0)` and add `await element.updateComplete` after it. For example:

```ts
async function mount(value: string): Promise<CopyCode> {
	document.body.replaceChildren();
	const element = document.createElement("copy-code") as CopyCode;
	element.setAttribute("value", value);
	document.body.append(element);
	await element.updateComplete;
	return element;
}

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
```

Apply the same three mechanical changes to the remaining six tests in the file, keeping every assertion exactly as it is.

Add one test the old synchronous element never needed. The page sets the code
and its hints in the same tick, and a naive "a new value drops the hints" rule
throws away hints that describe the code exactly:

```ts
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/copy-code.test.ts`

Expected: FAIL — `shadowRoot` null.

- [ ] **Step 3: Rewrite copy-code**

Replace `src/components/copy-code.ts` entirely:

```ts
import { css, html, LitElement, nothing, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

/**
 * What one character of the code means. The element only groups and displays
 * these; what a character means is the page's business, not the element's.
 */
export type CharHint = {
	char: string;
	hint: string;
	/** Characters sharing a group are drawn, and labelled, as one run. */
	group: string;
};

/**
 * The code the page exists to produce, plus a button that copies it and a
 * status line for the copy. Setting `value` clears the status, because a stale
 * "Copied." beside a code that has since changed is a lie — and drops the hints
 * for the same reason, since against a newer code they would label the wrong
 * characters.
 */
export class CopyCode extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			:host {
				display: block;
			}

			output {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-3);
				align-items: center;
			}

			/* Wrapping, not scrolling: a hint bubble inside an `overflow` box is
			   clipped by it, and a long full code has group boundaries to wrap at. */
			code {
				flex: 0 1 auto;
				min-width: 0;
				overflow-wrap: anywhere;
				color: var(--cr-accent-2);
				font-family: var(--cr-mono);
				font-size: clamp(1.5rem, 5vw, 2.25rem);
				font-weight: 600;
				letter-spacing: 0.22em;
				user-select: all;
			}

			/* One span per field of the code. The gap is what makes the fields read
			   as fields rather than as ten loose characters. */
			code span {
				position: relative;
				white-space: nowrap;
				border-bottom: 1px dotted currentColor;
				cursor: help;
			}

			code span + span {
				margin-left: 0.12em;
			}

			code span:hover,
			code span:focus-visible {
				color: var(--cr-accent);
			}

			/* The bubble the framework used to draw. It opens below the code on
			   purpose: the code sits at the top of a sticky panel, so a bubble
			   above it would open off the top of the window. */
			code span[data-placement="bottom"]::after {
				content: attr(data-tooltip);
				position: absolute;
				top: calc(100% + var(--cr-space-1));
				left: 50%;
				transform: translateX(-50%);
				z-index: 2;
				width: max-content;
				max-width: 16rem;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				box-shadow: var(--cr-block);
				padding: var(--cr-space-1) var(--cr-space-2);
				color: var(--cr-text);
				font-family: var(--cr-font);
				font-size: 0.8rem;
				font-weight: 400;
				letter-spacing: normal;
				white-space: normal;
				opacity: 0;
				pointer-events: none;
			}

			code span:hover::after,
			code span:focus-visible::after {
				opacity: 1;
			}

			.status {
				min-height: 1.4rem;
				margin: var(--cr-space-2) 0 0;
				color: var(--cr-muted);
				font-size: 0.9rem;
			}

			.status.error {
				color: var(--cr-danger);
			}
		`,
	];

	@property({ type: String, reflect: true })
	value = "";

	@state()
	private hintList: readonly CharHint[] = [];

	@state()
	private status = "";

	@state()
	private failed = false;

	/** The code the current hints were computed against. */
	#hintsFor = "";

	get hints(): readonly CharHint[] {
		return this.hintList;
	}

	/**
	 * One hint per character. Anything else is dropped whole: a hint list that
	 * does not line up with the code labels the wrong characters, which is worse
	 * than labelling none of them.
	 */
	set hints(hints: readonly CharHint[]) {
		this.#hintsFor = this.value;
		this.hintList = hints.length === this.value.length ? hints : [];
	}

	/**
	 * A new code invalidates both the hints and the status, whichever route set
	 * it — the attribute from the markup, or the property from the page.
	 *
	 * The hints are dropped by comparing what they were computed against rather
	 * than by the fact that `value` changed, because the page sets both in one
	 * tick: `codeOutput.value = code` then `codeOutput.hints = hintsFor(code)`.
	 * Both land before this runs, so clearing on `changed.has("value")` alone
	 * would throw away hints that describe the code exactly.
	 */
	protected override willUpdate(changed: PropertyValues<this>): void {
		if (!changed.has("value")) return;
		if (this.#hintsFor !== this.value) this.hintList = [];
		this.status = "";
		this.failed = false;
	}

	async #copy(): Promise<void> {
		try {
			await navigator.clipboard.writeText(this.value);
			this.status = "Copied.";
			this.failed = false;
		} catch {
			this.status =
				"The browser blocked the clipboard. Select the code and copy it by hand.";
			this.failed = true;
		}
	}

	/** Characters sharing a group are one run, drawn and labelled together. */
	#runs(): CharHint[][] {
		const runs: CharHint[][] = [];
		for (const hint of this.hintList) {
			const last = runs[runs.length - 1];
			if (last !== undefined && last[0]?.group === hint.group) last.push(hint);
			else runs.push([hint]);
		}
		return runs;
	}

	override render() {
		return html`
			<output aria-live="polite">
				<code
					>${this.hintList.length === 0
						? this.value
						: this.#runs().map(
								(run) => html`<span
									data-tooltip=${run[0]?.hint ?? ""}
									data-placement="bottom"
									data-group=${run[0]?.group ?? ""}
									>${run.map(({ char }) => char).join("")}</span
								>`,
							)}</code
				>
				<button
					type="button"
					@click=${() => {
						void this.#copy();
					}}
				>
					Copy
				</button>
			</output>
			<p class="status ${this.failed ? "error" : nothing}" role="status">
				${this.status}
			</p>
		`;
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

If `class="status ${… nothing}"` renders a trailing space that breaks `classList.contains("error")`, use Lit's `classMap` directive instead: `import { classMap } from "lit/directives/class-map.js";` and `class=${classMap({ status: true, error: this.failed })}`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/components/copy-code.test.ts`

Expected: PASS, 8 tests.

- [ ] **Step 5: Fix the route test's hint assertions**

`src/routes/combi-name/index.test.ts` around lines 220-230 reads `copy-code`'s spans. Change the query that finds them to go through the shadow root, and await the element before asserting:

```ts
const output = document.querySelector("copy-code") as CopyCode;
await output.updateComplete;
const spans = [...(output.shadowRoot?.querySelectorAll("code span") ?? [])];
```

Keep every assertion as it stands. If the surrounding test is not already `async`, make it so.

- [ ] **Step 6: Run the whole suite and the checks**

Run: `bun run test && bun run check`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/copy-code.ts src/components/copy-code.test.ts src/routes/combi-name/index.test.ts
git commit -m "feat: copy-code on Lit, with its own tooltip"
```

---

### Task 6: entry-picker on Lit

The hard one. The filter, the 50-row cap and the roving tabindex port unchanged; what moves is focus restoration, which can no longer happen synchronously after a re-render.

**Files:**
- Modify: `src/components/entry-picker.ts` (full rewrite)
- Test: `src/components/entry-picker.test.ts`

**Interfaces:**
- Consumes: `base`, `controls` from `./theme`.
- Produces: `<entry-picker>` keeps its `label` attribute, `options: readonly [string, string, string | null][]` and `value: string | null`. It still dispatches `new Event("input", { bubbles: true })` from the host on a pick, and still renders inside a closed `<details>`.

- [ ] **Step 1: Write the failing test**

Rewrite `src/components/entry-picker.test.ts`. Read the current file and keep every assertion. The mechanical changes:

- `mount` becomes `async`, awaits `updateComplete`.
- `element.querySelector*` becomes `element.shadowRoot?.querySelector*`.
- `document.activeElement` becomes `element.shadowRoot?.activeElement`.
- After any click or property set, `await settle(element)` before asserting.

Add this helper near the top of the file, and use it wherever a click or a set is followed by an assertion:

```ts
/**
 * A click handler that restores focus awaits its own `updateComplete` before
 * doing so, so one await here can land before the handler's. Two settles the
 * element and everything it queued.
 */
async function settle(element: EntryPicker): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/entry-picker.test.ts`

Expected: FAIL — `shadowRoot` null.

- [ ] **Step 3: Rewrite entry-picker**

Replace `src/components/entry-picker.ts` entirely:

```ts
import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

/**
 * A type-to-filter list that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * It lives inside a closed `<details>`: a page with six of these open at once
 * is a wall of scrolling lists, and the summary already says what is picked,
 * which is what a closed control has to answer.
 *
 * Only the first `LIMIT` matches are rendered, because three of these plus
 * three `<entry-set>`s over the same catalog would otherwise put tens of
 * thousands of rows in one page. The selected row is always rendered, even when
 * the filter excludes it, so the control never appears to have lost the pick.
 */
export class EntryPicker extends LitElement {
	static override styles = [base, controls, entryStyles];

	@property({ type: String })
	label = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private picked: string | null = null;

	@state()
	private filter = "";

	get value(): string | null {
		return this.picked;
	}

	set value(value: string | null) {
		this.picked = value !== null && this.#has(value) ? value : null;
	}

	override willUpdate(): void {
		// An options list that no longer contains the pick drops it, rather than
		// leaving the summary naming an entry the list cannot show.
		if (this.picked !== null && !this.#has(this.picked)) this.picked = null;
	}

	#has(value: string): boolean {
		return this.options.some(([candidate]) => candidate === value);
	}

	#pickedOption(): Option | undefined {
		return this.options.find(([value]) => value === this.picked);
	}

	#matches(): { shown: readonly Option[]; total: number } {
		const needle = this.filter.trim().toLowerCase();
		const matching =
			needle === ""
				? this.options
				: this.options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		const capped = matching.slice(0, LIMIT);
		const total = matching.length;
		if (this.picked === null) return { shown: capped, total };
		if (capped.some(([value]) => value === this.picked)) {
			return { shown: capped, total };
		}

		const picked = this.#pickedOption();
		return { shown: picked === undefined ? capped : [picked, ...capped], total };
	}

	#rows(): HTMLButtonElement[] {
		return [...(this.shadowRoot?.querySelectorAll("button.entry") ?? [])];
	}

	#search(): HTMLInputElement | null {
		return this.shadowRoot?.querySelector("input") ?? null;
	}

	/**
	 * One tab stop for the whole list, arrows inside it: 50 rows in each of six
	 * controls would otherwise be 300 stops between the loadout and the rest of
	 * the page. Enter and Space need no handling — these rows are buttons.
	 */
	#walk(event: KeyboardEvent): void {
		const rows = this.#rows();
		const at = rows.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const to = {
			ArrowDown: at + 1,
			ArrowUp: at - 1,
			Home: 0,
			End: rows.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		// Clamped rather than wrapped: an arrow that jumps from the last row to
		// the first reads as a lost keypress.
		rows[Math.min(Math.max(to, 0), rows.length - 1)]?.focus();
	}

	/**
	 * Lit reuses the row nodes it can, so a pick usually leaves focus where it
	 * was. When the filter has hidden the row that was clicked there is nothing
	 * to return to, so the search input — the one element that survives every
	 * render — takes it instead.
	 */
	async #pick(value: string): Promise<void> {
		this.picked = value === "" ? null : value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;
		(this.#rows().find((row) => row.value === value) ?? this.#search())?.focus();
	}

	#row(value: string, text: string, image: string | null, tabbable: boolean) {
		return html`<button
			type="button"
			class="entry"
			.value=${value}
			role="option"
			tabindex=${tabbable ? 0 : -1}
			aria-selected=${String((this.picked ?? "") === value)}
			@click=${() => {
				void this.#pick(value);
			}}
		>
			${image === null
				? ""
				: html`<img src=${image} alt="" loading="lazy" />`}${text}
		</button>`;
	}

	override render() {
		const { shown, total } = this.#matches();
		// The tab stop is the pick, so tabbing in lands on what the control
		// currently says; with nothing picked that is the None row at the top.
		const tabbableValue = this.picked ?? "";
		const picked = this.#pickedOption();

		return html`<details>
			<summary>
				<span class="name">${this.label}</span>
				<span class="pick">
					${picked === undefined
						? NONE
						: html`${picked[2] === null
								? ""
								: html`<img src=${picked[2]} alt="" loading="lazy" />`}${picked[1]}`}
				</span>
			</summary>
			<input
				type="search"
				autocomplete="off"
				placeholder="Type to filter"
				aria-label=${`Filter ${this.label}`}
				.value=${this.filter}
				@input=${(event: Event) => {
					// Filtering is not a change of value, so it must not read as one.
					event.stopPropagation();
					this.filter = (event.target as HTMLInputElement).value;
				}}
			/>
			<div
				class="entries"
				role="listbox"
				aria-label=${this.label}
				@keydown=${(event: KeyboardEvent) => {
					this.#walk(event);
				}}
			>
				${this.#row("", NONE, null, tabbableValue === "")}
				${shown.map(([value, label, image]) =>
					this.#row(value, label, image, value === tabbableValue),
				)}
			</div>
			<small class="more"
				>${total > LIMIT
					? `Showing ${LIMIT} of ${total}. Type to narrow the list.`
					: ""}</small
			>
		</details>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-picker": EntryPicker;
	}
}

if (!customElements.get("entry-picker")) {
	customElements.define("entry-picker", EntryPicker);
}
```

`entryStyles` is the shared look of both entry controls. Define it at the top of this file, above the class, and import it from `entry-set.ts` in Task 7 — it is presentation, not behaviour, so sharing it does not make either component unreadable on its own:

```ts
/**
 * The look both entry controls share. Shared because they are the same control
 * with one pick and with several; each keeps its own logic and its own
 * `Option` type.
 */
export const entryStyles = css`
	:host {
		display: block;
		margin-bottom: var(--cr-space-1);
	}

	summary {
		display: flex;
		flex-wrap: wrap;
		gap: var(--cr-space-1) var(--cr-space-2);
		align-items: center;
		justify-content: space-between;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		padding: var(--cr-space-1) var(--cr-space-2);
		cursor: pointer;
	}

	.name {
		font-family: var(--cr-mono);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
	}

	/* What the control holds, said on the closed line — the question a closed
	   control has to answer without being opened. */
	.pick {
		display: inline-flex;
		gap: var(--cr-space-1);
		align-items: center;
		color: var(--cr-muted);
		font-size: 0.875rem;
	}

	summary img {
		width: 1.5rem;
		height: 1.5rem;
		object-fit: contain;
	}

	details[open] summary {
		margin-bottom: var(--cr-space-1);
	}

	input[type="search"] {
		margin-bottom: var(--cr-space-1);
	}

	.entries {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		max-height: 12rem;
		overflow-y: auto;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		padding: var(--cr-space-1);
	}

	.entry {
		display: flex;
		align-items: center;
		gap: var(--cr-space-2);
		width: 100%;
		margin: 0;
		border: none;
		border-left: var(--cr-border) solid transparent;
		border-radius: 0;
		background: none;
		box-shadow: none;
		padding: var(--cr-space-1) var(--cr-space-2);
		color: inherit;
		font-family: var(--cr-font);
		text-align: left;
		text-transform: none;
		letter-spacing: normal;
		font-size: 0.875rem;
	}

	.entry:active {
		transform: none;
	}

	/* Tint and a marker, the same "you are here" the sidebar uses, and the same
	   light tint: an entry name has to stay readable over it. */
	.entry[aria-selected="true"] {
		border-left-color: var(--cr-accent);
		background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
		font-weight: 600;
	}

	.entry img {
		width: 1.75rem;
		height: 1.75rem;
		object-fit: contain;
	}

	.more {
		color: var(--cr-muted);
		font-size: 0.8rem;
	}
`;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/components/entry-picker.test.ts`

Expected: PASS. If a focus assertion fails, check the test used `settle(element)` and not a bare `await element.updateComplete` — the click handler awaits its own update before restoring focus.

- [ ] **Step 5: Run the whole suite and the checks**

Run: `bun run test && bun run check`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/entry-picker.ts src/components/entry-picker.test.ts
git commit -m "feat: entry-picker on Lit"
```

---

### Task 7: entry-set on Lit

**Files:**
- Modify: `src/components/entry-set.ts` (full rewrite)
- Test: `src/components/entry-set.test.ts`

**Interfaces:**
- Consumes: `base`, `controls` from `./theme`; `entryStyles` from `./entry-picker` (Task 6).
- Produces: `<entry-set>` keeps its `legend` attribute, `options: readonly [string, string, string | null][]` and `selected: string[]`, still ordered by the element's own `options` rather than by click order.

- [ ] **Step 1: Write the failing test**

Rewrite `src/components/entry-set.test.ts` with the same four mechanical changes as Task 6 — async `mount`, `shadowRoot` queries, `shadowRoot?.activeElement`, and a `settle(element)` helper after every click or set. Keep all 17 assertions exactly as they are. The chip and row helpers become:

```ts
function addRows(element: EntrySet): HTMLButtonElement[] {
	return [...(element.shadowRoot?.querySelectorAll(".entry") ?? [])];
}

function chips(element: EntrySet): HTMLButtonElement[] {
	return [...(element.shadowRoot?.querySelectorAll(".chip") ?? [])];
}
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test src/components/entry-set.test.ts`

Expected: FAIL — `shadowRoot` null.

- [ ] **Step 3: Rewrite entry-set**

Replace `src/components/entry-set.ts` entirely, following `entry-picker.ts` from Task 6. It keeps its own `Option` type declaration — a shared type between two components remains the first step towards a component that cannot be read on its own — and imports only the presentational `entryStyles`:

```ts
import { css, html, LitElement } from "lit";
import { property, state } from "lit/decorators.js";

import { entryStyles } from "./entry-picker";
import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

/**
 * One treasure slot, holding the entries that slot will accept — a build that
 * says "this, or that" writes both here.
 *
 * Like `<entry-picker>` it lives inside a closed `<details>`, and for the same
 * reason: three open lists over the same thousand-entry catalog is a wall, and
 * the summary already says what the slot holds.
 *
 * `selected` filters this element's own `options` rather than reading the order
 * chips were added in, the same rule `<check-group>` follows and for the same
 * reason: a slot's alternatives are written in id order, so click order would
 * produce a different code for the same slot.
 */
export class EntrySet extends LitElement {
	static override styles = [
		base,
		controls,
		entryStyles,
		css`
			.picked {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-1);
				margin-bottom: var(--cr-space-2);
			}

			.chip {
				display: inline-flex;
				align-items: center;
				gap: var(--cr-space-1);
				margin: 0;
				width: auto;
				padding: 0.125rem var(--cr-space-2);
				font-size: 0.8125rem;
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private chosen: ReadonlySet<string> = new Set();

	@state()
	private filter = "";

	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.chosen.has(value));
	}

	set selected(values: readonly string[]) {
		const known = new Set(this.options.map(([value]) => value));
		this.chosen = new Set(values.filter((value) => known.has(value)));
	}

	override willUpdate(): void {
		// An options list that no longer contains a pick drops it, the same rule
		// the setter applies.
		const known = new Set(this.options.map(([value]) => value));
		if ([...this.chosen].every((value) => known.has(value))) return;
		this.chosen = new Set([...this.chosen].filter((value) => known.has(value)));
	}

	#rows(): HTMLButtonElement[] {
		return [...(this.shadowRoot?.querySelectorAll(".entry") ?? [])];
	}

	#search(): HTMLInputElement | null {
		return this.shadowRoot?.querySelector("input") ?? null;
	}

	/**
	 * Focus follows the row or chip that was clicked into its replacement; when
	 * the click removed the thing it landed on, the search input — the one
	 * element that survives every render — takes it instead.
	 */
	async #changed(focusValue: string | null): Promise<void> {
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;
		const row =
			focusValue === null
				? undefined
				: this.#rows().find((candidate) => candidate.value === focusValue);
		(row ?? this.#search())?.focus();
	}

	/**
	 * One tab stop for the whole list, arrows inside it: 50 rows in each of three
	 * slots would otherwise be 150 stops in the loadout alone. Enter and Space
	 * need no handling — these rows are buttons.
	 */
	#walk(event: KeyboardEvent): void {
		const rows = this.#rows();
		const at = rows.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const to = {
			ArrowDown: at + 1,
			ArrowUp: at - 1,
			Home: 0,
			End: rows.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		// Clamped rather than wrapped: an arrow that jumps from the last row to
		// the first reads as a lost keypress.
		rows[Math.min(Math.max(to, 0), rows.length - 1)]?.focus();
	}

	#add(value: string): void {
		this.chosen = new Set([...this.chosen, value]);
		void this.#changed(value);
	}

	#remove(value: string): void {
		const next = new Set(this.chosen);
		next.delete(value);
		this.chosen = next;
		void this.#changed(null);
	}

	override render() {
		const labels = new Map(this.options.map(([value, label]) => [value, label]));
		const chosen = this.selected;

		const needle = this.filter.trim().toLowerCase();
		const matching =
			needle === ""
				? this.options
				: this.options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		// The tab stop is the first pick, so tabbing in lands on what the slot
		// already holds; with nothing picked that is the first row.
		const shown = matching.slice(0, LIMIT);
		const tabbableValue =
			shown.find(([value]) => this.chosen.has(value))?.[0] ?? shown[0]?.[0];

		return html`<details>
			<summary>
				<span class="name">${this.legend}</span>
				<span class="pick"
					>${chosen.length === 0
						? NONE
						: // The same "this or that" the code reads as, so a closed slot
							// says exactly what the reader panel would say about it.
							chosen.map((value) => labels.get(value) ?? value).join(" or ")}</span
				>
			</summary>
			<div class="picked">
				${chosen.map(
					(value) => html`<button
						type="button"
						class="chip"
						.value=${value}
						title=${`Remove ${labels.get(value) ?? value}`}
						@click=${() => {
							this.#remove(value);
						}}
					>
						${labels.get(value) ?? value} ×
					</button>`,
				)}
			</div>
			<input
				type="search"
				autocomplete="off"
				placeholder="Type to filter"
				aria-label=${`Filter ${this.legend}`}
				.value=${this.filter}
				@input=${(event: Event) => {
					event.stopPropagation();
					this.filter = (event.target as HTMLInputElement).value;
				}}
			/>
			<div
				class="entries"
				role="listbox"
				aria-multiselectable="true"
				aria-label=${this.legend}
				@keydown=${(event: KeyboardEvent) => {
					this.#walk(event);
				}}
			>
				${shown.map(
					([value, label, image]) => html`<button
						type="button"
						class="entry"
						.value=${value}
						role="option"
						tabindex=${value === tabbableValue ? 0 : -1}
						aria-selected=${String(this.chosen.has(value))}
						@click=${() => {
							this.#add(value);
						}}
					>
						${image === null
							? ""
							: html`<img src=${image} alt="" loading="lazy" />`}${label}
					</button>`,
				)}
			</div>
			<small class="more"
				>${matching.length > LIMIT
					? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
					: ""}</small
			>
		</details>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-set": EntrySet;
	}
}

if (!customElements.get("entry-set")) {
	customElements.define("entry-set", EntrySet);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test src/components/entry-set.test.ts`

Expected: PASS, 17 tests.

- [ ] **Step 5: Run the whole suite and the checks**

Run: `bun run test && bun run check`

Expected: PASS. Every component is now Lit; nothing in `src/components/` extends `HTMLElement` any more.

- [ ] **Step 6: Commit**

```bash
git add src/components/entry-set.ts src/components/entry-set.test.ts
git commit -m "feat: entry-set on Lit"
```

---

### Task 8: Drop Pico and rewrite the page frame

Every component now carries its own styles, so the page sheet is free to stop being a Pico override layer and become the frame it actually is.

**Files:**
- Modify: `src/routes/base.css` (full rewrite, 510 lines to roughly 150)
- Modify: `src/routes/index.css` (the `tool-index` rules go — the component owns them now)
- Modify: `src/routes/combi-name/index.css` (`--pico-*` becomes `--cr-*`)
- Modify: `src/routes/index.html`, `src/routes/combi-name/index.html` (Pico's utility classes leave)
- Modify: `package.json` (remove `@picocss/pico`)

**Interfaces:**
- Consumes: `src/routes/tokens.css` (Task 1).
- Produces: a page frame that owns `.container`, `.panel`, `.masthead`, `.status`, `.skip-link`, `.row`, `.scroll-x`, typography, tables and the body grid.

- [ ] **Step 1: Rewrite the base sheet**

Replace `src/routes/base.css` entirely:

```css
/* The sheet every route imports: the reset, the tokens, and the page frame.
   A route's own `index.css` opens with an `@import` of this file and then adds
   only what that page needs.

   Component styles are not here. Every custom element carries its own, inside
   its shadow root, reading colour through the tokens below. */
@import "@kcstyles/reset.css";
@import "./tokens.css";

html {
	font-size: 100%;
}

body {
	display: grid;
	grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
	grid-template-rows: auto 1fr auto;
	min-height: 100vh;
	background: var(--cr-bg);
	color: var(--cr-text);
	font-family: var(--cr-font);
	line-height: 1.45;
}

@media (width < 48rem) {
	body {
		grid-template-columns: minmax(0, 1fr);
	}
}

/* The result panel is sticky, so anything scrolled to by a fragment link or by
   keyboard focus needs to clear it - about 13rem with the code, the verdict and
   the button bar in it. */
:root {
	scroll-padding-top: 13rem;
}

.container {
	max-width: 68rem;
	padding: var(--cr-space-4) var(--cr-space-3);
}

/* The sidebar comes first in the DOM, so without this every page opens with a
   keyboard walk through the navigation. Off-screen until focused. */
.skip-link {
	position: absolute;
	left: -100vw;
}

.skip-link:focus {
	position: fixed;
	top: var(--cr-space-2);
	left: var(--cr-space-2);
	z-index: 2;
	border: var(--cr-border) solid var(--cr-line);
	border-radius: var(--cr-radius);
	background: var(--cr-accent);
	padding: var(--cr-space-2) var(--cr-space-3);
	color: var(--cr-bg);
}

main:focus {
	outline: none;
}

/* One column of panels, two once there is room for them. `auto-fit` looks right
   until the container outgrows three tracks, at which point the two panels sit
   in a three-column grid with a hole beside them. */
main {
	display: grid;
	gap: var(--cr-space-4);
	align-items: start;
}

@media (width >= 62rem) {
	main {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}
}

/* A page with a single section - the home pane - spans both tracks rather than
   sitting in the left one with a hole beside it. */
main > :only-child {
	grid-column: 1 / -1;
}

/* `min-width: 0` lets a panel shrink below the width of the widest thing inside
   it - without it the legend table props the whole grid open and the page
   scrolls sideways on a phone. */
.panel {
	min-width: 0;
	border: var(--cr-border) solid var(--cr-line);
	border-radius: var(--cr-radius);
	background: var(--cr-surface);
	box-shadow: var(--cr-block);
	padding: var(--cr-space-4);
}

h1,
h2,
h3 {
	margin: 0 0 var(--cr-space-3);
	font-family: var(--cr-mono);
	letter-spacing: var(--cr-tracking);
	text-transform: uppercase;
}

h1 {
	font-size: 1.5rem;
}

h2 {
	font-size: 1.15rem;
}

h3 {
	margin-top: var(--cr-space-4);
	font-size: 1rem;
}

p {
	margin: 0 0 var(--cr-space-3);
}

a {
	color: var(--cr-accent);
}

code {
	background: var(--cr-surface-2);
	padding: 0 0.2em;
	font-family: var(--cr-mono);
}

pre {
	overflow-x: auto;
	border: var(--cr-border) solid var(--cr-line);
	background: var(--cr-surface-2);
	padding: var(--cr-space-3);
	font-family: var(--cr-mono);
	font-size: 0.85rem;
}

table {
	width: 100%;
	border-collapse: collapse;
	font-size: 0.9rem;
}

th,
td {
	border-bottom: 1px solid var(--cr-line);
	padding: var(--cr-space-1) var(--cr-space-2);
	text-align: left;
	vertical-align: top;
}

th {
	color: var(--cr-muted);
	font-family: var(--cr-mono);
	font-size: 0.8rem;
	letter-spacing: var(--cr-tracking);
	text-transform: uppercase;
}

/* A table wider than its panel scrolls inside its own box rather than pushing
   the grid open. */
.scroll-x {
	overflow-x: auto;
}

/* Two controls across where there is room, stacked where there is not. */
.row {
	display: grid;
	gap: var(--cr-space-3);
	grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
	margin-bottom: var(--cr-space-3);
}

.masthead h1 {
	margin-bottom: var(--cr-space-1);
}

.masthead p {
	max-width: 46rem;
	color: var(--cr-muted);
}

.status {
	min-height: 1.4rem;
	color: var(--cr-muted);
	font-size: 0.9rem;
}

.status.error {
	color: var(--cr-danger);
}

.actions {
	display: flex;
	gap: var(--cr-space-2);
	margin: 0 0 var(--cr-space-2);
	border: 0;
	padding: 0;
}

.actions button {
	border: var(--cr-border) solid var(--cr-line);
	border-radius: var(--cr-radius);
	background: var(--cr-surface-2);
	box-shadow: var(--cr-block);
	padding: var(--cr-space-1) var(--cr-space-3);
	color: inherit;
	font-family: var(--cr-mono);
	font-size: 0.85rem;
	letter-spacing: var(--cr-tracking);
	text-transform: uppercase;
	cursor: pointer;
}

.actions button:active {
	transform: translate(2px, 2px);
	box-shadow: none;
}

.actions button:focus-visible,
input:focus-visible {
	outline: var(--cr-border) solid var(--cr-accent);
	outline-offset: 2px;
}

footer {
	grid-column: 1 / -1;
	color: var(--cr-muted);
	font-size: 0.85rem;
}
```

- [ ] **Step 2: Rewrite the home pane's sheet**

Replace `src/routes/index.css` entirely — `<tool-index>` owns its own look now:

```css
@import "./base.css";
```

- [ ] **Step 3: Rewrite the combi page's sheet**

In `src/routes/combi-name/index.css`, replace every `--pico-*` reference with its `--cr-*` equivalent and drop the rules that only existed to fight Pico. The mapping:

| was | becomes |
| --- | --- |
| `--pico-muted-color` | `--cr-muted` |
| `--pico-border-radius` | `--cr-radius` |
| `--pico-spacing` | `--cr-space-3` |
| `--pico-font-family-monospace` | `--cr-mono` |
| `--pico-mark-background-color` | `--cr-surface-2` |
| `--pico-mark-color` | `--cr-text` |
| `--pico-typography-spacing-top` | delete the declaration |

Delete the `.warnings li { list-style: none; … }` comment about Pico's `ul li` square — the reset handles it. Delete the `.result .actions { width: fit-content; }` rule and its comment: `.actions` is a flex row in the base sheet now, not a full-width bar. Keep `.rows`, `.diagram`, `.hint`, `.code-input`, the sticky `.result` and the two-track grid rules, rewritten against the new tokens. Add a warning colour:

```css
.warnings li {
	border-left: var(--cr-border) solid var(--cr-accent-2);
	background: var(--cr-surface-2);
	padding: var(--cr-space-2);
	color: var(--cr-text);
	font-size: 0.9rem;
}
```

- [ ] **Step 4: Strip Pico's classes from the markup**

In `src/routes/combi-name/index.html`:

- Line 48-53: delete the three-line comment about Pico's `[role=group]` and the `biome-ignore` line, and change `<fieldset class="actions" role="group">` to `<fieldset class="actions">`.
- Lines 54 and 57: `class="outline secondary"` comes off both buttons.
- Lines 68 and 78: `<div class="grid">` becomes `<div class="row">`.
- Lines 153 and 220: `<div class="overflow-auto">` becomes `<div class="scroll-x">`.

`src/routes/index.html` needs no change.

- [ ] **Step 5: Remove Pico**

Run: `bun remove @picocss/pico`

Then confirm nothing references it:

Run: `grep -ri pico src/ package.json`

Expected: no matches.

- [ ] **Step 6: Verify**

Run: `bun run test && bun run check && bun run build`

Expected: all pass, and `dist/index.html` plus `dist/combi-name/index.html` are written.

- [ ] **Step 7: Look at it**

Run: `bun run dev`

Open `http://localhost:3000` and `http://localhost:3000/combi-name`. Check, in both themes via the sidebar control and with the control on "System":

- the sidebar rail is full height, links have the magenta marker on the current page
- panels have 2px borders and a hard offset block shadow, no blur
- the code is amber, large, and hovering a run opens its bubble *below* the code
- the six loadout controls are closed, each naming what it holds
- the two checkbox groups sit in columns, and ticking one updates the code
- the legend tables scroll inside their panels on a narrow window rather than widening the page

This is the step the test suite cannot do: happy-dom does not resolve inherited custom properties, so the token layer is only ever verified here.

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock src/routes/base.css src/routes/index.css src/routes/combi-name/index.css src/routes/combi-name/index.html
git commit -m "feat: hand-written arcade stylesheet, and drop Pico"
```

---

### Task 9: Update the documentation

The repository's guidance describes a light-DOM, Pico-styled site. Every statement below is now false and has to change.

**Files:**
- Modify: `AGENTS.md`
- Modify: `.claude/skills/ui-components/SKILL.md`
- Modify: `.claude/skills/build-and-deploy/SKILL.md`
- Modify: `.claude/skills/adding-a-tool/SKILL.md`

**Interfaces:**
- Consumes: the finished state of Tasks 1-8.
- Produces: documentation that matches the code.

- [ ] **Step 1: Update AGENTS.md**

- The `src/components/` bullet: components are Lit elements with shadow roots, reached as `#components/*`, importing `src/lib/` and the shared style chunks in `src/components/theme.ts`, never `src/routes/`.
- The `src/routes/` bullet: mention `src/routes/tokens.css` beside `src/routes/base.css`, and say that `base.css` is the page frame — component styles live in the components.
- The import rule: note the one exception, `lit/decorators.js`, which is a package subpath that publishes its extension.

- [ ] **Step 2: Rewrite the ui-components skill**

`.claude/skills/ui-components/SKILL.md` needs its whole "Components" section replaced. Delete, because they describe a world that no longer exists:

- the light-DOM paragraph and its two reasons
- the `color: inherit` versus `var(--pico-color)` trap
- the `site-nav nav ul` triple-selector paragraph
- the sentence that component styles live in `src/routes/base.css`
- the `renderThemeControl` paragraph in the Theme section

Add, because they are the new rules a reader will get wrong otherwise:

- every component is a `LitElement` with a shadow root, carrying its own styles
- colour is read only through `--cr-*` custom properties, which inherit through the shadow boundary; `src/routes/tokens.css` is the only place they are defined
- `change` is not composed and a synthetic `input` event is not either, so `labelled-select` and `check-group` re-dispatch `input` from the host; the page listens on the form and would otherwise hear nothing
- reactive properties are declared as plain fields under `experimentalDecorators`; the `accessor` keyword does not survive Bun's transpiler (bun#43097)
- tests reach through `shadowRoot` and await `updateComplete`; a click handler that restores focus awaits its own update first, so a test asserting focus needs to settle twice
- `check-group`'s `selected` reads an internal `Set` rather than `input:checked`, because Lit owns the DOM
- `entryStyles` is exported from `entry-picker.ts` and imported by `entry-set.ts`: presentation is shared, logic and the `Option` types are not

Keep the component API table exactly as it is — nothing in it changed.

- [ ] **Step 3: Update the other two skills**

- `.claude/skills/build-and-deploy/SKILL.md`: the stylesheet import chain is now `route index.css` → `base.css` → `@kcstyles/reset.css` + `tokens.css`. Remove the Pico reference.
- `.claude/skills/adding-a-tool/SKILL.md`: a new page's stylesheet still opens with `@import "../base.css"`; remove whatever it says about Pico classes.

- [ ] **Step 4: Verify the docs match the code**

Run: `grep -ri pico AGENTS.md README.md .claude/skills/`

Expected: no matches.

Then re-read `AGENTS.md` and the `ui-components` skill against `src/components/theme.ts` and any one component, and confirm every claim is true.

- [ ] **Step 5: Run everything one last time**

Run: `bun run check && bun run test && bun run build`

Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add AGENTS.md .claude/skills/
git commit -m "docs: describe the Lit and shadow DOM components"
```

---

## Notes for the executor

**If a focus test is flaky.** The click handlers in `entry-picker` and `entry-set` await their own `updateComplete` before restoring focus. A test that awaits the same promise resumes after the handler, because it subscribed second — but only if it subscribed after the click. `await settle(element)` (an `updateComplete` plus a `Bun.sleep(0)`) is the reliable form and is what the plan's tests use.

**If `check-group` stops updating the code.** The route listens for `input` on the form. `change` does not cross a shadow boundary. Confirm the component re-dispatches `new Event("input", { bubbles: true })` from the host, not from the inner checkbox.

**If Biome objects to `lit/decorators.js`.** It is a published package subpath, not a local import, and the extension is part of its name. `AGENTS.md`'s no-extension rule is about local imports; Task 9 records the exception.

**If the page paints unstyled after Task 8.** Check `base.css` still opens with both `@import` lines and that `bun-server` resolved `@kcstyles/reset.css` from `node_modules` — the same mechanism that resolved Pico.

**What the tests cannot tell you.** happy-dom never resolves an inherited custom property, so no test proves a token reaches a component. Task 8 Step 7 is the only verification the token layer gets, and skipping it means shipping colours nobody looked at.
