# AGENTS.md

Guidance for agents working in this repository. `CLAUDE.md` points here.

## What this project is

A Cookie Run combi name is 10 characters, and the game stores only the cookie, relay, pet, and treasure in it. This project packs the rest of a run's configuration — type, episode, boosts, random boost, cookie power+ selections, and starting action — into those 10 characters, plus a browser page for building and reading codes. `README.md` documents the slot format for humans; this file covers how the code is put together.

## Runtime

Default to Bun instead of Node.js.

- `bun <file>` instead of `node <file>` or `ts-node <file>`
- `bun test` instead of `jest` or `vitest`
- `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- `bun install` / `bun run <script>` / `bunx <package>` instead of the npm, yarn, or pnpm equivalents
- Bun loads `.env` automatically — don't add `dotenv`
- Prefer `Bun.file` and `Bun.write` over `node:fs`; ``Bun.$`ls` `` instead of `execa`
- `Bun.serve()` for HTTP and WebSockets (no `express`), `bun:sqlite` (no `better-sqlite3`), `Bun.sql` (no `pg`), `Bun.redis` (no `ioredis`), built-in `WebSocket` (no `ws`)

Bun's own API docs are vendored at `node_modules/bun-types/docs/**.mdx` — read those rather than guessing at an API.

## Commands

```bash
bun install
bun run dev                                  # dev server with hot reload; / is the home pane, /combi-name/ is the combi tool
bun run test                                 # whole suite, ~3s (the exhaustive test dominates)
bun run test routes/combi-name/codec.test.ts # one file
bun run test -t "decodes every slot"         # one test by name substring
bun run check:type                           # tsc --noEmit; the test files are typechecked too
bun run check:biome                          # formatting and lint; --write applies what Biome can fix
bun run check                                # both checks, in one pass
bun run build                                # writes one self-contained file per page: dist/index.html, dist/combi-name/index.html
bun run fetch-assets                         # re-scrapes icons into assets/ (idempotent, skips existing)
bun run deploy                               # publishes to Cloudflare; wrangler builds first
```

Every script is a file under `scripts/`, so `package.json` holds a delegation rather than a command. Each one forwards its arguments and propagates the child's exit code, which is what keeps the two filtered test forms above working and what makes a failure fail whatever called it. `check` is the two check scripts chained with `&&`, so a type error stops before Biome runs.

`bunx`, not a bare binary name, inside `check-type.ts`, `check-biome.ts`, and `deploy.ts`: running a file directly does not put `node_modules/.bin` on `PATH` the way an npm-style script does.

`check:biome` reports without touching anything. `bun run check:biome --write` applies what Biome can fix on its own. The repository's formatting comes from `@kcconfigs/biome` via `biome.json`, which also ignores `assets/` — that directory is 14 MB of generated scrape output and reformatting it would bury every real diff.

`bun run dev` runs `scripts/dev.ts`, a small `Bun.serve()` whose route table is generated from `TOOLS`. Handing Bun the HTML files directly (`bun routes/index.html routes/combi-name/index.html`) registers only `/` and `/combi-name`, which 404s on the trailing-slash links the sidebar renders. So each page answers to every spelling: `/` and `/index.html` for the home pane, `/<slug>`, `/<slug>/`, and `/<slug>/index.html` for each tool. An unrouted URL comes back as a 404 with an empty body, which paints as a blank page rather than as an error — check the status code before concluding the page itself broke.

### Theme

`components/theme-toggle.ts` owns the light/dark choice. Pico paints light by default, dark under `prefers-color-scheme`, and obeys `data-theme` on the root over both, so the whole feature is: remember a choice and write that attribute. Three states, and "system" is the absence of one — it removes `data-theme` and deletes the stored key rather than writing a third value, which is what hands the page back to the OS.

Each page's `<head>` carries a small inline copy of the read-and-apply step, marked `id="theme-boot"`. The module scripts are deferred, so without it a page paints in the system theme and flips once the saved choice loads. `lib/tools.test.ts` asserts every page has it.

Every storage call is wrapped: a browser that refuses `localStorage` still themes the page for that visit. `components/theme-toggle.ts` exports `renderThemeControl` as a plain function as well as defining `<theme-toggle>` around it, because a custom element hands a `connectedCallback` exception to the global error handler instead of throwing to whoever appended it — the storage-refused test would pass vacuously through the element, so it calls the function directly.

### Link shape

`hrefFor` in `lib/href.ts` writes every cross-page link, and writes it twice over:

- Served over http(s) it emits directories — `./combi-name/`, `../` — so the address bar reads `/combi-name`, not a filename.
- Under `file:` it appends `index.html`, because opening `dist/` from disk means nothing is there to serve a directory index and the bare directory link would dead-end.

Both forms stay relative, and that outlives the reason it started. The site was served from a GitHub Pages project subpath, where a root-relative `/combi-name` would have resolved against the domain root and missed; it now serves from a Cloudflare Worker at its own root, where such a link would happen to work. Relative links are still what the `file:` build needs, and they cost nothing, so the rule stands — but do not restate the old subpath justification as if it were live. A test covers all four combinations of depth and protocol; that is the guard against someone "simplifying" it back to one form.

## Architecture

The character tables at the top of `routes/combi-name/codec.ts` are the single source of truth, and everything else derives from them:

- `TYPE_CHARS`, `EPISODE_CHARS`, `BOOST_SLOTS`, `RANDOM_BOOST_CHARS`, `COOKIE_POWER_BITS`, `ACTION_CHARS` define both the encoding and the set of valid values.
- `ALL_TYPES`, `ALL_EPISODES`, `ALL_BOOSTS`, `ALL_RANDOM_BOOSTS`, `ALL_COOKIE_POWERS`, `ALL_ACTIONS`, and `BOOST_LABELS` are computed from those tables — never hand-maintain a parallel list.
- `routes/combi-name/labels.ts` maps every value to a display name. A test asserts key-for-key parity with the `ALL_*` arrays, so a new value cannot ship unlabeled. Boost names live in `codec.ts` instead, because `decode`'s error messages quote them.
- `routes/combi-name/describe.ts` turns a `Combi` into display rows plus an auto/semi-auto verdict. It is the only place that decides how a combi reads in prose.
- `routes/combi-name/index.ts` pairs each `ALL_*` array with its label table and hands the result to the form components as their `options` property. `routes/combi-name/index.html` declares those elements empty on purpose — do not hardcode options into the markup.

To add a boost, episode, or cookie power: add it to its character table and its label table. Nothing else needs touching, and tests fail until both are done.

### Ordering is part of the wire format

`Object.keys` order determines the `ALL_*` order, which determines the boost slot order (slots 4-6) and the cookie power+ bit values. Reordering a table silently changes what existing codes mean. If the slot layout or a character mapping has to change, bump `VERSION` in `routes/combi-name/codec.ts` — `decode` rejects any other version outright.

The form end of that guarantee is `<check-group>`'s `selected` getter, described under Components below.

### Hard errors vs soft warnings

`decode` throws only when a code is unreadable: wrong length, unknown version, an unknown character in a slot, or a cookie mask above `7F`. It returns `{ combi, warnings }` and never throws when slot 2 (`A` vs `H`) disagrees with the flag slots, because hand-typed codes can contradict themselves. `isSemiAuto` is always the authority; `encode` normalizes slot 2 to match it. Keep that split — the UI depends on being able to show a contradictory code rather than refusing it.

### The exhaustive test

`routes/combi-name/exhaustive.test.ts` round-trips all 1,769,472 combinations and asserts encoding yields exactly 1,474,560 distinct codes (the auto/semi-auto character is derived, so the auto family collapses). Both numbers are hardcoded; changing the configuration space means recomputing them, and a mismatch usually means a table changed size rather than that the test is stale.

### Project layout

Cross-directory imports go through `#lib/*` and `#components/*`, declared in `package.json`'s `imports` field, so a route writes `from "#components/check-group.ts"` rather than counting `../`s.

- `lib/` is code more than one route uses, reached as `#lib/*`. Today that is the tool registry and `hrefFor`. It owns no DOM, with one deliberate exception: `hrefFor` defaults its `protocol` argument to `globalThis.location?.protocol`, because every caller would otherwise pass the same thing. That is a default rather than a read — `lib/href.test.ts` hands the protocol in on every call and never touches `location`.
- `components/` is every custom element, reached as `#components/*`. It imports from `lib/` and never from `routes/` — `components/auto-verdict.ts` declares its own `Verdict` type rather than importing the structurally identical `AutoVerdict` from `routes/combi-name/describe.ts`, which is what keeps that arrow pointing one way.
- `routes/<slug>/` is one page: `index.html`, `index.css`, `index.ts`, and that route's own logic and tests. `routes/index.*` is the home pane.
- `scripts/` is one file per package script.
- `tests/` is test configuration only. `bunfig.toml` preloads `tests/happydom.ts` for every run, so `document` and `window` exist in all test files, not just the DOM ones. No test lives there.

Route-only logic stays in the route. The combi codec is imported by exactly one page, so it lives at `routes/combi-name/codec.ts` rather than in `lib/`.

### Components

Light DOM, no shadow root: Pico styles by element selector, and the two form components need `<form>` participation and label association. Component styles live in `routes/base.css` alongside the page frame, scoped by element name — including a `display` rule for each, since an unknown element is inline until a stylesheet says otherwise. They sit in the base sheet rather than beside each component or in the route that uses one, so that adopting an existing element in a new route is a markup change and nothing else.

The sidebar's rules reach through `nav` — `site-nav nav ul`, not `site-nav ul`. Pico styles `aside nav` and `aside li` directly, which used to cover this markup when the rail was an `<aside>`; with a custom element those rules match nothing, and the replacements need a third type selector to out-specify Pico's own `nav`/`nav li` rather than tie them and win on whichever sheet the bundler emits last.

Attributes carry markup-authored configuration; properties carry structured data the route hands over. Every `customElements.define` is guarded by `customElements.get`, because one `bun test` process shares one registry across every test file.

| Element | Attributes | Properties |
| --- | --- | --- |
| `<site-nav>` | `current` — tool slug, absent or empty means the home pane | — |
| `<theme-toggle>` | — | — |
| `<tool-index>` | — | — |
| `<labelled-select>` | `label` | `options`, `value` |
| `<check-group>` | `legend` | `options`, `selected` |
| `<copy-code>` | `value` | `value` |
| `<auto-verdict>` | `prefix` | `verdict` |

`<site-nav>` and `<tool-index>` read the registry themselves; no route passes them data. `<site-nav>` renders `<theme-toggle>` as one of its own children, so there is no mount order for a page to get wrong.

`<copy-code>` is the only element that observes an attribute, because the page sets a new code on every keystroke and the markup ships an initial one. Setting either the attribute or the property rewrites the code; setting the property also clears the copy status, since a stale "Copied." beside a code that has since changed is a lie.

`<check-group>`'s `selected` getter filters the element's own `options` rather than reading DOM order. That is what keeps boosts in slot order and cookie powers in bit order, and it is part of the wire format rather than a preference.

Each component is standalone by design. Only `site-nav.ts` and `tool-index.ts` import anything — `TOOLS` and `hrefFor` from `lib/`, plus `theme-toggle.ts` in the sidebar's case, since it renders one — and the other five import nothing at all. `<labelled-select>` and `<check-group>` even declare an `Option` pair type each rather than sharing one. A shared type between two components is the first step towards a component that cannot be read on its own.

### Adding a tool

1. Add an entry to `TOOLS` in `lib/tools.ts`.
2. Create `routes/<slug>/index.html`: `<a class="skip-link" href="#content">Skip to content</a>` then `<site-nav current="<slug>"></site-nav>` as the first two body children, a `<script id="theme-boot">` block copied from an existing page's head above the stylesheet link, `<link rel="stylesheet" href="./index.css" />`, `<script src="./index.ts" type="module"></script>`, `<main id="content" class="container" tabindex="-1">`, and Pico's `container` class on `header` and `footer` too. The skip link matters because the sidebar comes first in the DOM.
3. Create `routes/<slug>/index.css` starting with `@import "../base.css";`. That import is what gives the page Pico, the body grid, the sidebar rail, and every component's rules. A sheet holding nothing else is fine — the base sheet is its own file, so no route's stylesheet can collide with it.
4. Create `routes/<slug>/index.ts` and import the components the page declares, so their `customElements.define` calls run.
5. Import the page in `scripts/dev.ts` and add it to `TOOL_PAGES`.

`lib/tools.test.ts` fails until the page exists, links `./index.css`, has a stylesheet that imports the base sheet, hosts `<site-nav>` carrying its own slug as `current`, loads `./index.ts`, carries the skip link and the theme bootstrap, and is imported by `scripts/dev.ts`. Step 5 is also a typecheck failure on its own: `TOOL_PAGES` is a `Record<ToolSlug, HTMLBundle>`, so a registered slug with no page there does not compile. What no test checks is the rest of step 2: a page missing the `container` classes or the `tabindex` on `<main>` is merely ugly, and nothing catches it. The two failures that are silent and total — a page that never upgrades its elements, and a tool page whose sidebar links all point at the wrong directory — are the two the tests above do cover, because the alternative is a green suite and a broken site.

Nothing has to be added to the build — `pageEntrypoints()` in `lib/tools.ts` derives the list from the registry, and `scripts/build.ts` passes it straight to `bun build`. Nothing in any page's markup names another tool, so the registry stays the only list.

## Web build

`bun run build` takes one entrypoint per page, and `--compile --target=browser` inlines each page's JavaScript, CSS, and referenced assets into its own self-contained file: `dist/index.html` and `dist/combi-name/index.html`. `dist/` is also what Cloudflare serves — `wrangler.jsonc` names it as the asset directory — so the build's output shape is part of the deployment contract, not just a local convenience. Each file works offline from `file://` as well.

`scripts/build.ts` gets those entrypoints from `pageEntrypoints()` in `lib/tools.ts` rather than from a list, which is what retired the old warning about never globbing that list away — `sh` expands `**` as `*`, so a glob would have silently dropped the home page. `lib/tools.test.ts` asserts the build script still calls `pageEntrypoints()`, so a hand-maintained list slipped back in fails the suite rather than passing it. `scripts/dev.ts` covers the same ground for development by importing each page by name.

The consequence of inlining is that anything a page references gets embedded as a data URI. Read the Assets section below before wiring an icon into a page.

`routes/base.css` is the base stylesheet, and it belongs to no route. It imports Pico's amber theme (`@picocss/pico/css/pico.amber.min.css`), holds the body grid and every component's rules, and adds only the overrides Pico has no opinion about; colors come from Pico's custom properties, not a local palette. Every route's `index.css` opens by importing it and then adds that page's own rules — the home pane's sheet carries the `tool-index` rules and nothing else. The build inlines that two-level chain, so nothing ships an `@import`.

The base sheet is a separate file rather than the home pane's sheet doubling as one, which it used to be. Two things fell out of that arrangement: the home pane could never hold a rule the other routes should not see, and a new route whose sheet held only the import hashed byte-identical to the base and stopped the build with `Multiple files share the same output path` — two entry stylesheets that hash alike cannot both be written, and nothing in that message says so.

One declaration is still split across both levels: the base sheet gives `main > :only-child` the full grid width, which is what makes a single-section page span both columns, and the combi page's sheet spans `.result, .legend` the same way. Neither file can see the other's selectors, and losing either half is a layout break no test catches.

## Assets

`bun run fetch-assets` scrapes cookie, pet, and treasure icons from cookierundb.com into `assets/` and writes `assets/index.json`, mapping each entry's display name to its icon path relative to `assets/`. It is idempotent — icons already on disk are skipped, so re-running only fills gaps.

Two things about `index.json` that matter to whatever consumes it. A display name can cover several entries; when their icons differ the key is disambiguated as `Name [slug]`, and when they share an icon the duplicate collapses into one key. So treat the keys as opaque strings rather than assuming one name means one entry.

Nothing consumes `assets/` yet. The codec deliberately does not model the cookie, relay, pet, or treasure: the game already stores those four in the combi, which is precisely why the 10 characters are spent on everything else. Don't add them to the code.

`assets/` is 14 MB (868 treasure icons account for 11 MB) and, unlike `dist/`, is committed on purpose: a planned feature reads it, so the scrape output stays in the repository rather than being fetched per clone. Since the page build inlines every referenced asset into one file, that feature needs either a curated subset or a non-standalone build that copies files alongside the HTML — 14 MB of data URIs in one page is not an option.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` names the worker `cookierun`, sets `build.command` to `bun run build`, and points `assets.directory` at `dist/` — so wrangler runs the build itself, and neither deploy workflow builds beforehand. Nothing else reads `dist/`; changing where the build writes means changing that file too.

Three workflows, each pinning every action to a full commit SHA with the release tag in a trailing comment:

- `main.yml` — install, `bun test`, `bun run check:type`, `bun run build`. This is the only place the suite runs in CI.
- `deploy-preview.yml` — on pull requests, `wrangler versions upload`, reporting into the `preview` environment.
- `deploy-production.yml` — on pushes to `main`, `wrangler deploy`, reporting into the `production` environment.

Both deploy workflows need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository secrets, and grant `deployments: write` on the job rather than at the top of the file — the workflows open with `permissions: {}` and hand back only what each job needs. Keep that shape in anything new.

Bun's version comes from the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically — keep it in sync with `mise.toml`.

A pinned SHA is bumped by resolving the tag again rather than editing it by hand:

```bash
gh api repos/actions/checkout/releases/latest --jq .tag_name          # e.g. v7.0.1
gh api repos/actions/checkout/commits/v7.0.1 --jq .sha                # the SHA to pin
```

Update the comment in the same edit — a stale comment is worse than none, since it is the only readable record of which version the SHA is.

Pushing any change under `.github/workflows/` requires a token with the `workflow` scope. `gh auth refresh -h github.com -u <account> -s workflow` grants it.
