---
name: repo-scripts
description: Use when editing anything under scripts/, adding or changing a package script, running the dev server, or fixing a `bun run check:type` / `check:biome` failure. Covers where a package script lives, Biome/TypeScript strictness and what each check reads, and the dev server's route table.
---

# Scripts and checks

## Where a package script lives

A script that is just a command is that command in `package.json` — `bun-server dev`, `tsc --noEmit`, `biome check`, `wrangler deploy`, `bun test`. `bun run` puts `node_modules/.bin` on `PATH`, so the bare binary name resolves and no wrapper is needed; don't reintroduce `bunx`, and don't wrap one of these in a file under `scripts/` again. Arguments a caller passes are forwarded by `bun run` itself, which is what keeps `bun run test -t "decodes every slot"` and `bun run build --no-minify` working. `check` is the one composite: `bun run check:type && bun run check:biome`, so a type error stops before Biome runs.

A script that is a *program* is a file under `scripts/`, and there are exactly two: `bun run fetch:assets` scrapes cookierundb.com and rewrites `assets/index.json`; `bun run verify:assets` asks cookierundb.com whether that file is still complete, comparing each section's non-retired count against the site's listing. It needs the network, so it runs weekly in `.github/workflows/assets.yml` rather than on push. They share `scripts/utils/`. See the `assets` skill before touching either.

## Biome

`check:biome` reports without touching anything. `bun run check:biome --write` applies what Biome can fix on its own. `format:biome` is the same check with `--write --unsafe` — read the diff after (`format` is an alias).

The repository's formatting comes from `@kcconfigs/biome` via `biome.json`, which also ignores `assets/` — that directory is 14 MB of generated scrape output and reformatting it would bury every real diff.

## The two checks are stricter together than either is alone

`tsconfig.json` sets `noUncheckedIndexedAccess`, so every index and every regex capture group arrives as `T | undefined`; `@kcconfigs/biome` forbids `!`, so the usual escape hatch fails lint. Narrow instead: a destructuring default (`const [, href = ""] = match`), `??`, or pulling the element into a `const` and guarding it. `scripts/fetch-assets.ts` does all three. `!` after `?.` is worse still — that one is an error rather than a warning, and Biome is right that it defeats the optional chain.

`noPropertyAccessFromIndexSignature` is the same squeeze from the other side: a property that comes from an index signature — `element.dataset.theme`, or a field on the loose JSON shape `scripts/utils/asset-ids.ts` reads — cannot be reached with a dot. The subscript that satisfies TypeScript is what `useLiteralKeys` complains about, so reach for neither: use `setAttribute`/`removeAttribute` for `dataset`, and destructure (`const { key: scraped } = entry`) for a plain object.

## What `check:type` covers

`@kcconfigs/tsconfig` includes `src/**/*.ts` and nothing else, and its `rootDir` is `src/`. This repository widens both in `tsconfig.json`: `include` names `scripts/` and `tests/` as well, `rootDir` is the repository root, and `noEmit` is explicit because nothing under `scripts/` belongs in an `outDir`. Narrow the `include` back to the preset's and `bun run check:type` passes over the scripts without reading them.

No import carries a `.ts` extension, which is what keeps `allowImportingTsExtensions` out of that file. The `#lib/*` and `#components/*` aliases supply the extension from `package.json` (`"#lib/*": "./src/lib/*.ts"`) and relative imports resolve without one — so adding `.ts` to an import is a typecheck error, not a style preference.

## Dev server

`bun run dev` is `bun-server dev`, on :3000. It scans `src/routes/` for HTML and registers each page under both an exact route and a wildcard, so every spelling the sidebar renders answers: `/` and `/index.html` for the home pane, `/<slug>`, `/<slug>/`, and `/<slug>/index.html` for each tool. Nothing lists the pages, so adding one needs no edit to any script — see the `build-and-deploy` skill.

`--statics 'assets/**/*.png'` serves the repository's own icons at `/assets/...`, the path the combi page asks for, so development matches a built `dist/`. Keep the glob quoted: the shell would otherwise expand it and every extra path would arrive as another entrypoint to serve.

An unrouted URL comes back as a 404 with an empty body, which paints as a blank page rather than as an error — check the status code before concluding the page itself broke.
