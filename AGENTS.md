# AGENTS.md

Guidance for agents working in this repository. `CLAUDE.md` points here.

This file is the always-loaded core: what the project is, how to run it, and where everything lives. The detailed rules — the ones you must not guess at — live as skills under `.claude/skills/`, listed at the bottom. Read the relevant skill before you touch that area.

## What this project is

A Cookie Run combi name is 10 characters, and the game stores only the cookie, relay, pet, and treasure in it. This project packs the rest of a run's configuration — type, episode, boosts, random boost, cookie power+ selections, and starting action — into those 10 characters, plus a browser page for building and reading codes. `README.md` documents the slot format for humans.

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
bun run dev                                  # dev server on :3000; / is the home pane, /combi-name/ is the combi tool, /assets/* the icons
bun run test                                 # whole suite, ~3s (the exhaustive test dominates)
bun run test src/routes/combi-name/codec.test.ts # one file
bun run test -t "decodes every slot"         # one test by name substring
bun run check:type                           # tsc --noEmit; the test files are typechecked too
bun run check:biome                          # formatting and lint; --write applies what Biome can fix
bun run format:biome                         # the same check with --write --unsafe; read the diff after (`format` is an alias)
bun run check                                # both checks, in one pass
bun run build                                # writes dist/index.html and dist/combi-name/index.html with their shared chunks, plus dist/assets/ for the icons
bun run preview                              # serves the built dist/ on :4000 the way Cloudflare does; build first
bun run fetch:assets                         # re-scrapes into assets/, records fetchedAt, reports what changed
bun run verify:assets                        # asks cookierundb.com whether index.json is still complete
bun run deploy                               # publishes to Cloudflare; wrangler builds first
```

Every script but two is the command itself in `package.json` — `bun-server`, `tsc`, `biome`, `wrangler`, `bun test` — resolved from `node_modules/.bin` by `bun run`. Only `fetch:assets` and `verify:assets` are files under `scripts/`, because both are programs rather than invocations: `fetch-assets.ts` scrapes the site, `verify-assets.ts` asks it whether the committed index is still complete. See the `repo-scripts` skill before editing one.

`dev`, `build` and `preview` are all `@kctools/bun-server` invocations. With no input argument it scans `src/routes/` for HTML files, so the route table is the directory itself and adding a page needs no edit anywhere; `--statics 'assets/**/*.png'` puts the icons at `/assets/...` in both the dev server and `dist/`. See the `build-and-deploy` skill.

## Project layout

Everything the site is built from lives under `src/`; `assets/`, `scripts/`, and `tests/` sit beside it at the root. `tsconfig.json`'s `rootDir` is the repository root and its `include` names all four, so a script is typechecked like a route is.

Cross-directory imports go through `#lib/*` and `#components/*`, declared in `package.json`'s `imports` field, so a route writes `from "#components/card-group"` rather than counting `../`s. The subpaths keep their short names — the alias is `#lib/*`, not `#src/lib/*` — so moving a directory is a change in `package.json` and nowhere else.

No import carries a file extension. The two aliases supply it (`"#lib/*": "./src/lib/*.ts"`), and a relative import is resolved without one, so `tsconfig.json` needs no `allowImportingTsExtensions`. `#assets/*` is the exception: it maps to `./assets/*` unchanged, since `#assets/index.json` names the extension itself. `lit/decorators.js` is another: it is a published package subpath, not a local import, and the extension is part of its name — the no-extension rule only governs imports this repository resolves itself.

- `src/lib/` is code more than one route uses, reached as `#lib/*`. Today that is the tool registry and `hrefFor`. It owns no DOM, with one deliberate exception documented in the `ui-components` skill.
- `src/components/` is every custom element — a `LitElement` with its own shadow root — reached as `#components/*`. It imports from `src/lib/` and the shared style chunks in `src/components/theme.ts`, and never from `src/routes/`.
- `src/routes/<slug>/` is one page: `index.html`, `index.css`, `index.ts`, and that route's own logic and tests. `src/routes/index.*` is the home pane. `src/routes/base.css` is the page frame — the reset, the body grid, the sidebar layout, and shared typography — and belongs to no route; component styles live in the components, not here. `src/routes/tokens.css`, which `base.css` imports, defines every `--cr-*` custom property the page and the components both read.
- `scripts/` holds the two asset programs and the helpers they share in `scripts/utils/`. Nothing else: a package script that is just a command lives in `package.json` as that command.
- `tests/` is test configuration only. `bunfig.toml` preloads `tests/happydom.ts` for every run, so `document` and `window` exist in all test files, not just the DOM ones. No test lives there.

Route-only logic stays in the route. The combi codec is imported by exactly one page, so it lives at `src/routes/combi-name/codec.ts` rather than in `src/lib/`.

## Where the rest of the guidance lives

| Skill | Read it before |
| --- | --- |
| `combi-codec` | touching `src/routes/combi-name/` — the tables are the wire format, and their order is load-bearing |
| `ui-components` | editing `src/components/`, using a custom element, styling `src/routes/base.css`, or touching theming or `src/lib/href.ts` |
| `adding-a-tool` | adding a `src/routes/<slug>/` page, or debugging one that fails `src/lib/tools.test.ts` |
| `repo-scripts` | editing `scripts/`, or fixing a `check:type` / `check:biome` failure — the two checks are stricter together than either alone |
| `build-and-deploy` | changing the build, a stylesheet's import chain, `wrangler.jsonc`, or `.github/workflows/` |
| `assets` | touching `assets/` or putting an icon in a page — a new icon is inlined by default, which has a size consequence |
