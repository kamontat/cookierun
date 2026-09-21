# Lit, shadow DOM, and a hand-written stylesheet

Date: 2026-09-21

## What changes

Three coupled changes to the front end, taken together because each one forces
the next:

1. Every custom element in `src/components/` becomes a `LitElement`.
2. Every component renders into a shadow root instead of the light DOM.
3. Pico is removed. The site gets its own stylesheet, built on
   `@kcstyles/reset.css`, in a fresh visual direction rather than a port of the
   current one.

They are coupled because Pico styles by element selector, which stops working
the moment a component has a shadow root. Adopting shadow DOM therefore means
each component carries its own styles, which means the page-level sheet has to
stand on its own, which is the opportunity the visual redesign takes.

The public API of every component is unchanged. Each one keeps exactly the
attributes and properties documented in the `ui-components` skill, so no route
needs an edit for the components to keep working.

## Why shadow DOM is affordable here

The light-DOM decision recorded in the `ui-components` skill rested on two
things: Pico styling by element selector, and form participation. The first is
moot once Pico is gone. The second does not apply — a search of the routes
finds no `FormData`, no `submit`, and no `requestSubmit`. The two `<form>`
elements in `combi-name/index.html` are grouping markup; the route reads every
value through element properties. Label association also survives, because each
label and its control render into the same shadow root.

What shadow DOM buys in exchange: the `site-nav nav ul` specificity fight with
Pico documented at length in `base.css` disappears, along with the `color:
inherit` trap that painted entry rows black on a dark card.

## Dependencies

| Package | Change |
| --- | --- |
| `@picocss/pico` | removed |
| `lit` | added, ~6 KB gzip, lands in the chunk both pages already share |
| `@kcstyles/reset.css` | added at 1.0.12, 351 lines, zero dependencies, page-level reset only |

`tsconfig.json` already sets `experimentalDecorators: true` and
`useDefineForClassFields: false`, which is exactly Lit's TypeScript decorator
setup. No configuration change is needed.

`bun-server` already resolves a package CSS `@import` out of `node_modules` —
that is how Pico loads today — so `@import "@kcstyles/reset.css"` needs no build
change either.

Net bytes are lower than today: Pico's minified amber build leaves, and Lit plus
roughly 4 KB of hand-written CSS arrive.

## File layout

```
src/routes/tokens.css     new: every --cr-* custom property, dark and light
src/routes/base.css       rewritten: reset + tokens import, page frame only
src/components/theme.ts   new: shared Lit `css` chunks
```

`base.css` falls from 510 lines to roughly 150. It keeps the body grid,
`.container`, `.panel`, `.masthead`, `.status`, `.skip-link`, typography and
tables. Every rule that reached into a component leaves, because those rules
move inside the component that owns them.

`src/components/theme.ts` exports two `CSSResult` chunks that every component
adopts: a shadow-scoped reset (`box-sizing`, control font inheritance — a
page-level reset does not cross a shadow boundary) and the control primitives
(button, input, select, summary). Lit shares one `CSSStyleSheet` instance across
every component that adopts the same `CSSResult`, so this costs nothing at
runtime.

This contradicts the rule in `AGENTS.md` and the `ui-components` skill that each
component imports nothing. That rule becomes "imports nothing but the shared
style chunks". The alternative is `box-sizing` duplicated nine times, which is
worse.

## Visual direction: arcade console

Dark-first, high contrast, hard edges. The tool should look like it belongs to
the game it serves.

### Tokens

```css
:root {
  --cr-bg: #0e0e12;
  --cr-surface: #17171f;
  --cr-surface-2: #1f1f2b;
  --cr-text: #f2f2f5;
  --cr-muted: #9a9aae;
  --cr-line: #2e2e3d;
  --cr-accent: #ff3d7f;    /* magenta: interactive, current, focus */
  --cr-accent-2: #ffd23f;  /* amber: the code itself */
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
}
```

Custom properties inherit through shadow boundaries, which is what makes them
the single theming surface. A component never reads a colour any other way.

### Rules

- Two-pixel borders on every surface. Offset block shadows, never a blur.
- Uppercase, letter-spaced labels: legends, entry-control summary names, table
  headers, the sidebar title.
- Monospace for chrome and code; `system-ui` for prose paragraphs only.
- The code is amber and large — `clamp(1.5rem, 5vw, 2.25rem)` at `0.22em`
  tracking. It is the loudest thing on the page, which is the point of the page.
- Focus is a 2px magenta outline at 2px offset. Buttons additionally shift 2px
  into their block shadow on `:active`.
- Current and selected share one gesture everywhere they appear — a filled 2px
  magenta left bar over a 14% tint — in the sidebar and in entry rows alike.

### Theme states

The three-state control stays: system, light, dark. "System" remains the absence
of `data-theme`, so the cascade is:

```css
:root { /* dark tokens */ }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { /* light tokens */ }
}
:root[data-theme="light"] { /* light tokens */ }
```

The light variant keeps the arcade language rather than softening it: paper
`#f4f4f0`, near-black `#12121a` for lines and block shadows, the same magenta
and amber accents.

The inline `theme-boot` block in each page head is unchanged.

## Components

| Component | Internal change |
| --- | --- |
| all nine | `LitElement`, shadow root, `static styles = [base, controls, css\`…\`]`, `@property` / `@state` |
| `check-group` | `selected` stops reading `input:checked` out of the DOM and moves to an internal `Set` fed by a `@change` handler. Required: Lit owns the DOM now. The getter still filters the element's own `options`, so boosts stay in slot order and cookie powers in bit order |
| `copy-code` | its own tooltip bubble via `[data-tooltip]::after`, since Pico's is gone. The attribute name `data-tooltip` is kept, so the `hints` API and its tests are untouched. `class="outline secondary"` is dropped; the component styles its own button |
| `entry-picker`, `entry-set` | the filter, the 50-row cap and the roving tabindex port unchanged. Focus restoration moves into `updated()`. Lit reuses row nodes across renders, so the common case no longer loses focus at all; the explicit restore stays for the case where a filter hid the row that was clicked |
| `site-nav` | its styles move inside, and the triple-type-selector fight with Pico's `nav`/`nav li` rules disappears with the framework that caused it |
| `theme-toggle` | `readTheme`, `writeTheme` and `applyTheme` are unchanged. `renderThemeControl` is deleted: it existed only so the storage-refused test had a function that could throw rather than a custom element that swallows the exception, and those three functions are directly testable on their own |
| `labelled-select`, `tool-index`, `auto-verdict` | mechanical: imperative DOM building becomes one `render()` template |

`entry-picker` and `entry-set` keep their separate `Option` type declarations. A
shared type between two components remains the first step towards a component
that cannot be read on its own.

## Tests

Assertions do not change. Wire-format ordering, ARIA roles, the 50-row cap, the
focus rules, the tab-stop counts — all of it is asserted exactly as it is today.
What changes is how a test reaches the DOM and when it may look:

```ts
const el = mount();
el.selected = ["000", "002"];
await el.updateComplete;                        // Lit batches into a microtask
expect(el.shadowRoot?.querySelector("summary")?.textContent)…
expect(el.shadowRoot?.activeElement)…           // not document.activeElement
```

Eight component test files change this way, plus
`src/routes/combi-name/index.test.ts`, which asserts on `copy-code`'s hint
spans and so has to reach through a shadow root to find them.

`src/lib/tools.test.ts` is untouched: it asserts each page carries a
`theme-boot` block, which is still true.

### The one real risk, and what the spike found

happy-dom 20 has to support shadow DOM, `adoptedStyleSheets` and
`shadowRoot.activeElement` well enough for these tests under `bun test`. A
throwaway Lit component exercising exactly that has been run and deleted. It
passed on everything the plan depends on:

- a shadow root exists and Lit renders into it
- `adoptedStyleSheets` carries `static styles`
- a property set is visible after `await updateComplete`
- a click handler re-renders, and `aria-selected` follows
- `shadowRoot.activeElement` reports focus inside the shadow root
- Lit reuses row nodes across a re-render, so a focused row keeps focus
- a `keydown` listener on an inner list sees bubbling events from its rows
- an event dispatched from the host still bubbles out to the page

Two findings change how the code gets written:

**No `accessor` keyword.** Under `experimentalDecorators: true` Bun's
transpiler rejects `accessor options: readonly string[] = []` outright —
"Expected ";" but found "options"". This is the `bun#43097` FIXME already in
`tsconfig.json`. Reactive properties are therefore declared the legacy way,
as plain fields:

```ts
@property({ attribute: false })
options: readonly Option[] = [];
```

**happy-dom does not resolve inherited custom properties.** `getComputedStyle`
returns `""` for an inherited `--cr-*` value — in the light DOM as much as in a
shadow root, so this is not a shadow-DOM limitation but a pre-existing gap in
the test environment. No current test asserts a computed style and none of the
new ones will; the token layer is verified in a browser, not in `bun test`.

## Order of work

Pico stays installed until the last step, so the site is never half-styled.

```
0. spike: prove happy-dom handles shadow DOM under bun test (done, throwaway)
1. feat: arcade token layer and hand-written base stylesheet
2. feat: site-nav, theme-toggle, tool-index on Lit
3. feat: labelled-select, check-group, copy-code on Lit
4. feat: entry-picker, entry-set on Lit
5. chore: drop @picocss/pico
6. docs: update AGENTS.md and the ui-components skill
```

Each of steps 2 through 4 carries its own test updates. `bun run check` and
`bun run test` pass at every commit.

## Documentation to update at the end

- `AGENTS.md`: the components description, and the "imports nothing" rule.
- `.claude/skills/ui-components/SKILL.md`: the light-DOM rationale, the Pico
  specificity notes, the `color: inherit` trap, the `renderThemeControl`
  paragraph, and the component table's note about where styles live.
- `.claude/skills/build-and-deploy/SKILL.md`: the stylesheet import chain.
- `.claude/skills/adding-a-tool/SKILL.md`: what a new page's stylesheet imports.

Those three skills are the files that name Pico today; a search finds it
nowhere else in the documentation.

## Out of scope

- No change to the codec, the asset pipeline, the build tooling or the worker.
- No new routes or components.
- No change to any component's public attributes or properties.
- No redesign of the page content or copy — only its presentation.
