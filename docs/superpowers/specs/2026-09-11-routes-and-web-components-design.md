# Routes, web components, and script files

Date: 2026-09-11

## Purpose

The project is laid out by technical tier — `lib/` for logic, `web/` for pages — with a `shared/` subdirectory on each side. Two directories are named "shared" and own different things, which the current `AGENTS.md` has to spend a paragraph explaining. The page code is imperative: markup declares empty container elements and a module script fills them in by id, so reading `index.html` tells you almost nothing about what the page contains.

This refactor reorganizes the project by route, moves every piece of reusable UI into a custom element, and moves the npm scripts into TypeScript files. The encoding itself does not change: the character tables, the slot layout, and the format version are carried across untouched.

## Goals

- One directory per route, holding that route's markup, styles, script, and route-only logic.
- `lib/` reserved for code more than one route uses.
- Every reusable piece of UI is a custom element declared in the markup, not a container filled in by id.
- `package.json` scripts become one-line delegations to `scripts/*.ts`.
- Every dependency pinned to an exact version, and future installs pinned by default.

## Non-goals

- No change to the wire format. `VERSION` stays `1`, the character tables keep their key order, and `lib/combi-name/exhaustive.test.ts` keeps both of its hardcoded counts.
- No new features. The home pane and the combi-name tool do exactly what they do today.
- No work on `assets/`. Nothing consumes it before this refactor and nothing consumes it after.
- No shadow DOM (see Decisions).

## Target layout

```
lib/                        cross-route code
  tools.ts                  TOOLS, ToolSlug, pageEntrypoints()
  tools.test.ts
  href.ts                   hrefFor()
  href.test.ts

components/                 every custom element
  site-nav.ts               <site-nav>
  site-nav.test.ts
  theme-toggle.ts           <theme-toggle>, readTheme, writeTheme, applyTheme
  theme-toggle.test.ts
  tool-index.ts             <tool-index>
  tool-index.test.ts
  labelled-select.ts        <labelled-select>
  labelled-select.test.ts
  check-group.ts            <check-group>
  check-group.test.ts
  copy-code.ts              <copy-code>
  copy-code.test.ts
  auto-verdict.ts           <auto-verdict>
  auto-verdict.test.ts

routes/
  index.html                home pane
  index.css                 base stylesheet: Pico, layout, component rules
  index.ts
  combi-name/
    index.html
    index.css               @import "../index.css" plus page-only rules
    index.ts
    index.test.ts
    codec.ts      codec.test.ts
    labels.ts     labels.test.ts
    describe.ts   describe.test.ts
    exhaustive.test.ts

scripts/
  dev.ts  build.ts  test.ts  typecheck.ts  fetch-assets.ts

tests/
  happydom.ts               unchanged
```

`web/` is deleted. The mapping from the old tree:

| Today | Becomes |
| --- | --- |
| `web/index.html` | `routes/index.html` |
| `web/home.ts` | `routes/index.ts` |
| `web/shared/styles.css` | `routes/index.css` plus `routes/combi-name/index.css` |
| `web/shared/chrome.ts` | `lib/href.ts`, `components/site-nav.ts`, `components/tool-index.ts` |
| `web/shared/theme.ts` | `components/theme-toggle.ts` |
| `web/combi-name/index.html` | `routes/combi-name/index.html` |
| `web/combi-name/main.ts` | `routes/combi-name/index.ts` |
| `web/dev.ts` | `scripts/dev.ts` |
| `lib/shared/tools.ts` | `lib/tools.ts` |
| `lib/combi-name/*.ts` | `routes/combi-name/*.ts` |

`need<T>()` does not survive as a shared helper. Only the combi-name route still looks elements up by id, so the four-line function moves to the top of `routes/combi-name/index.ts` and is exported from there for that route's test.

## Decisions

### Light DOM, no shadow root

Every component attaches its children directly to itself. Pico styles by element selector, so a shadow root would leave each component's internals unstyled, and it would also break `<form>` participation and implicit label association for the two form components. Nothing here needs style isolation; the whole site is one stylesheet.

The cost is that component styles live in `routes/index.css` alongside the page layout rather than next to the component. That is accepted: it keeps `components/` to `.ts` files as the layout requires, avoids CSS-in-JS, and avoids a flash of unstyled component areas after the deferred module script runs.

### Attributes for configuration, properties for data

Static, markup-authored configuration arrives as attributes: `current`, `label`, `legend`, `prefix`, `value`. Structured data arrives as properties set from the route script: `options`, `selected`, `verdict`. Attributes cannot carry arrays or objects without a serialization step that buys nothing here.

### Registration is guarded

Each component file calls `customElements.define` at module scope, guarded by `customElements.get(name)`. Under `bun test` every test file shares one process and one `customElements` registry, so an unguarded define throws the second time a component is imported.

### `components/` never imports from `routes/`

`<auto-verdict>` renders a combi's auto verdict, whose type is `AutoVerdict` in `routes/combi-name/describe.ts`. Rather than import across that boundary, the component declares its own structural property type:

```ts
type Verdict = { readonly semi: boolean; readonly reasons: readonly string[] };
```

`AutoVerdict` is structurally assignable to it, so the route passes `describeCombi(combi).auto` directly and the dependency arrow only ever points from `routes/` into `components/` and `lib/`.

### Build entrypoints come from the registry

`lib/tools.ts` gains `pageEntrypoints()`, returning `routes/index.html` followed by one path per registered tool. `scripts/build.ts` passes that list to `bun build`, and `lib/tools.test.ts` asserts each returned path exists on disk.

This replaces two things at once. The `AGENTS.md` warning about never replacing the entrypoint list with a glob becomes moot, since there is no glob and no hand-maintained list. And the test that grepped `package.json` for each page path is no longer needed, because a registered tool with no page is now a failing existence assertion on a derived path.

`scripts/build.ts` shells out to `bun build` through `Bun.$` rather than calling `Bun.build`. The `--compile --target=browser` combination is what produces one self-contained file per page, and shelling out keeps that behaviour byte-identical to today rather than betting the JavaScript API accepts the same combination.

### `<site-nav>` owns the theme control

Today `renderSidebar` renders an empty `#theme` element and each page then calls `renderThemeControl(need("theme"))`, an ordering that `AGENTS.md` has to flag as not optional. `<site-nav>` renders `<theme-toggle>` as one of its own children instead, so the ordering constraint disappears along with the empty slot. A page's only obligation is to place `<site-nav>` in its markup.

The `<aside id="sidebar">` element goes away. CSS targets `site-nav` by element name.

### `check-group` owns the ordering guarantee

`AGENTS.md` calls out that `checkedValues` filters the canonical `ALL_*` list rather than reading DOM order, because that is what keeps boosts in slot order and cookie powers in bit order. That logic moves into `<check-group>`: the `selected` getter filters the component's own `options` array, so the order it returns is the order the route handed it. A component test covers it directly, checking that boxes ticked in reverse order still read back canonically.

## Component contracts

| Element | Attributes | Properties | Renders | Events |
| --- | --- | --- | --- | --- |
| `<site-nav>` | `current` — tool slug; absent means the home pane | — | sidebar title, `<nav aria-label="Tools">` with one link per registry entry plus Home, `aria-current="page"` on the active one, and a `<theme-toggle>` | — |
| `<theme-toggle>` | — | — | `<label>` plus `<select>` over System / Light / Dark | — |
| `<tool-index>` | — | — | `<dl>` with a linked `<dt>` name and a `<dd>` tagline per registry entry | — |
| `<labelled-select>` | `label` | `options: readonly (readonly [string, string])[]`, `value: string` | `<label>` wrapping `<select>` | native `input`, bubbling from the select |
| `<check-group>` | `legend` | `options: readonly (readonly [string, string])[]`, `selected: readonly string[]` | `<fieldset>` with `<legend>` and one labelled checkbox per option | native `input`, bubbling from the checkboxes |
| `<copy-code>` | `value` | `value: string` | `<code>` with the value, a Copy button, and a `role="status"` line | — |
| `<auto-verdict>` | `prefix` | `verdict: Verdict \| null` | the verdict sentence, or nothing when `verdict` is null | — |

`<labelled-select>` associates its label by nesting the select inside it, which avoids generating ids. `<copy-code>` keeps today's clipboard failure path: when `navigator.clipboard.writeText` rejects, the status line tells the reader to select the code and copy it by hand.

The two registry-driven components, `<site-nav>` and `<tool-index>`, import `TOOLS` from `#lib/tools.ts` and `hrefFor` from `#lib/href.ts` themselves. No route passes them data.

That is why `routes/index.ts` ends up as nothing but two imports. The home pane is entirely `<site-nav>` and `<tool-index>`, both of which draw their own content, so the script's only job is to import the two component modules and let their `customElements.define` calls run. The file stays rather than being folded into the markup as an inline script, because a page's script is where its components get registered and the next route added to the home pane would need it back.

## `hrefFor` moves to `lib/`

`hrefFor` is unchanged in behaviour: directories over http(s), `index.html` appended under `file:`, always relative. Its signature keeps the third `protocol` parameter defaulting to `globalThis.location?.protocol`.

Today's `AGENTS.md` says anything reading `document`, `location`, or `localStorage` belongs on the `web/` side. There is no `web/` side after this refactor. The new rule: `lib/` holds code that does not own DOM, and `hrefFor` reads one value off `location` behind a default parameter that every test overrides. `components/` is where DOM ownership lives.

## Imports, scripts, dependencies

```json
"imports": {
  "#lib/*": "./lib/*",
  "#components/*": "./components/*"
},
"scripts": {
  "dev": "bun scripts/dev.ts",
  "build": "bun scripts/build.ts",
  "test": "bun scripts/test.ts",
  "typecheck": "bun scripts/typecheck.ts",
  "fetch-assets": "bun scripts/fetch-assets.ts"
}
```

Routes import their own files relatively and cross into `#lib/*` and `#components/*` by subpath.

`scripts/test.ts` and `scripts/typecheck.ts` shell out through `Bun.$`, forward `Bun.argv.slice(2)` so `bun run test -t "decodes every slot"` still works, and exit with the child process's code so CI still fails on a failing suite.

`scripts/dev.ts` keeps the shape of today's `web/dev.ts`: a static `import` per page so the bundler can find it, a `Record<ToolSlug, HTMLBundle>` so a registered tool with no page fails to typecheck, and a route table registering all three URL spellings per tool plus `/` and `/index.html` for the home pane.

Dependencies pinned exact, and `bunfig.toml` gains `[install] exact = true` so a later `bun install` does not reintroduce a range:

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

`@types/bun` was `latest`, which is not a version at all; it resolves to whatever the registry serves on install day. The `module` field, currently pointing at `lib/combi-name/codec.ts`, is deleted — the package is private and nothing reads it.

`packageManager` stays `bun@1.4.2`, in sync with `mise.toml`, because `oven-sh/setup-bun` reads it.

## Tests

Moved with imports rewritten and assertions unchanged: `codec.test.ts`, `describe.test.ts`, `labels.test.ts`, `exhaustive.test.ts`. The exhaustive test's two expected counts are written as factor products — `6 * 12 * 8 * 12 * 128 * 2` combinations checked, `5 * 12 * 8 * 12 * 128 * 2` distinct codes, or 1,769,472 and 1,474,560 — and both must still pass as written. If either moves, a character table changed size and the refactor broke the format.

`web/shared/chrome.test.ts` splits three ways. The `hrefFor` cases, including all four combinations of depth and protocol, go to `lib/href.test.ts`. The sidebar cases go to `components/site-nav.test.ts`. The tool-list cases go to `components/tool-index.test.ts`. One case is dropped: "the sidebar leaves a slot for the theme control" is replaced by asserting `<site-nav>` renders a `<theme-toggle>`.

`web/shared/theme.test.ts` becomes `components/theme-toggle.test.ts`, keeping its coverage of the three states, the storage-refused path, and the fact that "system" removes the attribute and deletes the key rather than writing a third value.

`lib/shared/tools.test.ts` becomes `lib/tools.test.ts`. Slug uniqueness is unchanged. The two build-script greps collapse into one existence assertion over `pageEntrypoints()`. The markup assertions change target: `id="sidebar"` becomes `<site-nav`, and `id="tools"` becomes `<tool-index`. The skip-link, `#content`, and `theme-boot` assertions stay as they are, since those remain plain markup every page must carry.

Each component gets a test file. Two carry real weight: `check-group` must return `selected` in its own options order regardless of the order boxes were ticked, and `labelled-select` must associate its label with its select so the control is reachable by name.

`web/combi-name/main.test.ts` becomes `routes/combi-name/index.test.ts`, keeping all seven of its cases — the builder's starting code, the type slot rewriting to `H`, cookie powers folding into the hex slots, the reader uppercasing input, the short-code character count, the unreadable-slot error, the soft warning that does not refuse the code, and loading a code back into the builder. Its queries change from `need("code")` and `need("boosts")` to reaching into `<copy-code>` and `<check-group>` internals.

## Verified before writing this spec

Two assumptions the design rests on were probed rather than assumed.

**happy-dom upgrades custom elements already in the DOM.** The route test sets `document.body.innerHTML` from the page file and then imports the route script, which is what defines the elements — so upgrade has to happen on `define`, after the elements are already parsed. A probe defining an element after setting `innerHTML` saw `connectedCallback` run and the attribute readable.

**The build inlines a two-level `@import` chain.** `routes/combi-name/index.css` imports `routes/index.css`, which imports Pico. A probe of that exact shape through `bun build --compile --target=browser` produced a 138 KB single file with Pico embedded, both marker declarations present, and no `@import` surviving.

## Documentation and CI

`AGENTS.md` needs a real rewrite, not a path substitution. These sections describe structure that stops existing: Commands, Theme, Link shape, Architecture, Library layout, and Web build. The "Adding a tool" checklist drops from seven steps to five — the build entrypoint is derived from the registry, and the theme control is rendered by `<site-nav>` rather than wired per page. A new section documents the component contracts, since a custom element's attribute and property names are now part of the interface between markup and script.

`README.md` documents the slot format for humans and needs only its path references updated.

`.github/workflows/deploy.yml` needs no change. It runs `bun install --frozen-lockfile`, `bun test`, `bun run typecheck`, and `bun run build`. The first two are direct Bun commands that stay valid, and the last two resolve through `package.json` to the new script files. The lockfile will change when dependencies are re-pinned, so that commit must include `bun.lock` or the frozen-lockfile install fails in CI.

## Success criteria

- `bun test` passes, with the exhaustive test reporting the same two counts.
- `bun run typecheck` is clean.
- `bun run build` writes `dist/index.html` and `dist/combi-name/index.html`, each self-contained, each working when opened from `file://`.
- `bun run dev` serves all five URL spellings — `/`, `/index.html`, `/combi-name`, `/combi-name/`, `/combi-name/index.html` — and the home pane's tool index links resolve.
- `web/` no longer exists, and no file outside `routes/` imports anything inside it.
- Every dependency in `package.json` is an exact version, and `bunfig.toml` sets `exact = true`.
