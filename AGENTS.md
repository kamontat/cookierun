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
bun run dev                           # dev server with hot reload; / is the home pane, /combi-name/ is the combi tool
bun test                              # whole suite, ~3.5s (the exhaustive test dominates)
bun test lib/combi-name/codec.test.ts # one file
bun test -t "decodes every slot"      # one test by name substring
bun run typecheck                     # tsc --noEmit; the test files are typechecked too
bun run build                         # writes one self-contained file per page: dist/index.html, dist/combi-name/index.html
bun run fetch-assets                  # re-scrapes icons into assets/ (idempotent, skips existing)
```

`bun run dev` runs `web/dev.ts`, a small `Bun.serve()` whose route table is generated from `TOOLS`. Handing Bun the HTML files directly (`bun web/index.html web/combi-name/index.html`) registers only `/` and `/combi-name`, which 404s on both links the sidebar actually renders — `./combi-name/index.html` from the home pane and `../index.html` from the tool page. So each page answers to every spelling: `/` and `/index.html` for the home pane, `/<slug>`, `/<slug>/`, and `/<slug>/index.html` for each tool. Bun's 404 body is a bare `Not found` with no `<head>`, which reads like a page that lost its `<meta>` tags — check the status code before believing that.

`bunfig.toml` preloads `happydom.ts` for every test run, so `document` and `window` exist in all test files, not just the DOM ones.

## Architecture

The character tables at the top of `lib/combi-name/codec.ts` are the single source of truth, and everything else derives from them:

- `TYPE_CHARS`, `EPISODE_CHARS`, `BOOST_SLOTS`, `RANDOM_BOOST_CHARS`, `COOKIE_POWER_BITS`, `ACTION_CHARS` define both the encoding and the set of valid values.
- `ALL_TYPES`, `ALL_EPISODES`, `ALL_BOOSTS`, `ALL_RANDOM_BOOSTS`, `ALL_COOKIE_POWERS`, `ALL_ACTIONS`, and `BOOST_LABELS` are computed from those tables — never hand-maintain a parallel list.
- `lib/combi-name/labels.ts` maps every value to a display name. A test asserts key-for-key parity with the `ALL_*` arrays, so a new value cannot ship unlabeled. Boost names live in `codec.ts` instead, because `decode`'s error messages quote them.
- `lib/combi-name/describe.ts` turns a `Combi` into display rows plus an auto/semi-auto verdict. It is the only place that decides how a combi reads in prose.
- `web/combi-name/main.ts` generates every select and checkbox from the `ALL_*` arrays and the label tables. `web/combi-name/index.html` holds empty container elements on purpose — do not hardcode options into the markup.

To add a boost, episode, or cookie power: add it to its character table and its label table. Nothing else needs touching, and tests fail until both are done.

### Ordering is part of the wire format

`Object.keys` order determines the `ALL_*` order, which determines the boost slot order (slots 4-6) and the cookie power+ bit values. Reordering a table silently changes what existing codes mean. If the slot layout or a character mapping has to change, bump `VERSION` in `lib/combi-name/codec.ts` — `decode` rejects any other version outright.

`checkedValues` in `web/combi-name/main.ts` filters the canonical `ALL_*` list rather than reading DOM order, which is what keeps boosts in slot order and cookie powers in bit order.

### Library layout

Cross-directory imports go through `#lib/*`, declared in `package.json`'s `imports` field, so `web/combi-name/main.ts` can write `from "#lib/combi-name/codec.ts"` instead of a relative `../../lib/combi-name/codec.ts`. `lib/shared/` holds code more than one tool uses (today, just the tool registry); `lib/<slug>/` holds one tool's own code. There are two "shared" directories and they own different things: `lib/shared/` is cross-tool logic with no DOM in it, `web/shared/` is what pages share — `styles.css` and `chrome.ts`, the sidebar every page renders plus the `need<T>()` element lookup they all use.

### Hard errors vs soft warnings

`decode` throws only when a code is unreadable: wrong length, unknown version, an unknown character in a slot, or a cookie mask above `7F`. It returns `{ combi, warnings }` and never throws when slot 2 (`A` vs `H`) disagrees with the flag slots, because hand-typed codes can contradict themselves. `isSemiAuto` is always the authority; `encode` normalizes slot 2 to match it. Keep that split — the UI depends on being able to show a contradictory code rather than refusing it.

### The exhaustive test

`lib/combi-name/exhaustive.test.ts` round-trips all 1,769,472 combinations and asserts encoding yields exactly 1,474,560 distinct codes (the auto/semi-auto character is derived, so the auto family collapses). Both numbers are hardcoded; changing the configuration space means recomputing them, and a mismatch usually means a table changed size rather than that the test is stale.

### Adding a tool

1. Add an entry to `TOOLS` in `lib/shared/tools.ts`.
2. Create `web/<slug>/index.html` with `<aside id="sidebar" class="sidebar"></aside>` as the first body child, a `../shared/styles.css` link, and Pico's `container` class on `header`, `main`, and `footer`. A page that forgets the stylesheet or the container is unstyled and no test catches it; a page that forgets the sidebar host fails `lib/shared/tools.test.ts`.
3. In the page's script, call `renderSidebar(need("sidebar"), "<slug>")` from `../shared/chrome.ts` — that is what draws the navigation, from the registry.
4. Create `lib/<slug>/` for its logic.
5. Add `web/<slug>/index.html` to the `build` script in `package.json`.
6. Import the page in `web/dev.ts` and add it to `TOOL_PAGES`.

`lib/shared/tools.test.ts` fails until the page exists, hosts the sidebar, the build script lists it, and `web/dev.ts` imports it. Step 6 is also a typecheck failure on its own: `TOOL_PAGES` is a `Record<ToolSlug, HTMLBundle>`, so a registered slug with no page there does not compile. Nothing in the markup names another tool — the sidebar is generated, so the registry stays the only list.

## Web build

`bun run build` takes one entrypoint per page — `web/index.html` and `web/combi-name/index.html` are both named explicitly in the `build` script — and `--compile --target=browser` inlines each page's JavaScript, CSS, and referenced assets into its own self-contained file: `dist/index.html` and `dist/combi-name/index.html`. That is deliberate: it removes any base-path concern when GitHub Pages serves the site from a project subpath, and each file works offline from `file://`.

Never replace the explicit entrypoint list with a glob. `sh` expands `**` as `*`, which would silently drop `web/index.html` from the build (the shell's glob doesn't recurse the way you'd expect). `web/dev.ts` covers the same ground for development by importing each page by name.

The consequence of inlining is that anything a page references gets embedded as a data URI. Read the Assets section below before wiring an icon into a page.

`web/shared/styles.css` is the only stylesheet. It imports Pico's amber theme (`@picocss/pico/css/pico.amber.min.css`) and adds only the overrides Pico has no opinion about; colors come from Pico's custom properties, not a local palette.

## Assets

`bun run fetch-assets` scrapes cookie, pet, and treasure icons from cookierundb.com into `assets/` and writes `assets/index.json`, mapping each entry's display name to its icon path relative to `assets/`. It is idempotent — icons already on disk are skipped, so re-running only fills gaps.

Two things about `index.json` that matter to whatever consumes it. A display name can cover several entries; when their icons differ the key is disambiguated as `Name [slug]`, and when they share an icon the duplicate collapses into one key. So treat the keys as opaque strings rather than assuming one name means one entry.

Nothing consumes `assets/` yet. The codec deliberately does not model the cookie, relay, pet, or treasure: the game already stores those four in the combi, which is precisely why the 10 characters are spent on everything else. Don't add them to the code.

`assets/` is 14 MB (868 treasures account for 11 MB) and, unlike `dist/`, is not gitignored — whether the scrape output belongs in the repository is still open. Since the page build inlines every referenced asset into one file, a feature that displays icons needs either a curated subset or a non-standalone build that copies files alongside the HTML.

## Deployment

`.github/workflows/deploy.yml` runs on pushes to `main` and on manual dispatch: install with a frozen lockfile, test, typecheck, build, then publish `dist/`. Bun's version comes from the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically — keep it in sync with `mise.toml`.

Every action is pinned to a full commit SHA with the release tag in a trailing comment, so a moved tag cannot change what runs. Bump one by resolving the tag again rather than editing the SHA by hand:

```bash
gh api repos/actions/checkout/releases/latest --jq .tag_name          # e.g. v7.0.1
gh api repos/actions/checkout/commits/v7.0.1 --jq .sha                # the SHA to pin
```

Update the comment in the same edit — a stale comment is worse than none, since it is the only readable record of which version the SHA is.

Two things that are easy to trip over:

- The repository needs **Settings → Pages → Source** set to **GitHub Actions**, or the deploy job fails no matter what the workflow says.
- Pushing any change under `.github/workflows/` requires a token with the `workflow` scope. `gh auth refresh -h github.com -u <account> -s workflow` grants it.
