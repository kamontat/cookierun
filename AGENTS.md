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
bun run dev                                  # dev server with hot reload; / is the home pane, /combi-name/ is the combi tool
bun run test                                 # whole suite, ~3s (the exhaustive test dominates)
bun run test routes/combi-name/codec.test.ts # one file
bun run test -t "decodes every slot"         # one test by name substring
bun run check:type                           # tsc --noEmit; the test files are typechecked too
bun run check:biome                          # formatting and lint; --write applies what Biome can fix
bun run format:biome                         # the same check with --write --unsafe; read the diff after (`format` is an alias)
bun run check                                # both checks, in one pass
bun run build                                # writes one self-contained file per page: dist/index.html, dist/combi-name/index.html
bun run fetch-assets                         # re-scrapes icons into assets/ (idempotent, skips existing)
bun run deploy                               # publishes to Cloudflare; wrangler builds first
```

Every script is a file under `scripts/`, each a docstring plus one `execAsync` call that never returns. See the `repo-scripts` skill before editing one.

## Project layout

Cross-directory imports go through `#lib/*` and `#components/*`, declared in `package.json`'s `imports` field, so a route writes `from "#components/check-group.ts"` rather than counting `../`s.

- `lib/` is code more than one route uses, reached as `#lib/*`. Today that is the tool registry and `hrefFor`. It owns no DOM, with one deliberate exception documented in the `ui-components` skill.
- `components/` is every custom element, reached as `#components/*`. It imports from `lib/` and never from `routes/`.
- `routes/<slug>/` is one page: `index.html`, `index.css`, `index.ts`, and that route's own logic and tests. `routes/index.*` is the home pane. `routes/base.css` is the base stylesheet and belongs to no route.
- `scripts/` is one file per package script, plus `scripts/utils/shell.ts` holding the `execAsync` every one of them calls.
- `tests/` is test configuration only. `bunfig.toml` preloads `tests/happydom.ts` for every run, so `document` and `window` exist in all test files, not just the DOM ones. No test lives there.

Route-only logic stays in the route. The combi codec is imported by exactly one page, so it lives at `routes/combi-name/codec.ts` rather than in `lib/`.

## Where the rest of the guidance lives

| Skill | Read it before |
| --- | --- |
| `combi-codec` | touching `routes/combi-name/` — the tables are the wire format, and their order is load-bearing |
| `ui-components` | editing `components/`, using a custom element, styling `routes/base.css`, or touching theming or `lib/href.ts` |
| `adding-a-tool` | adding a `routes/<slug>/` page, or debugging one that fails `lib/tools.test.ts` |
| `repo-scripts` | editing `scripts/`, or fixing a `check:type` / `check:biome` failure — the two checks are stricter together than either alone |
| `build-and-deploy` | changing the build, a stylesheet's import chain, `wrangler.jsonc`, or `.github/workflows/` |
| `assets` | touching `assets/` or putting an icon in a page — the build inlines every referenced asset |
