---
name: repo-scripts
description: Use when editing anything under scripts/, adding or changing a package script, running the dev server, or fixing a `bun run check:type` / `check:biome` failure. Covers the execAsync contract, Bun Shell binary resolution, Biome/TypeScript strictness and the dev server's route table.
---

# Scripts and checks

## Shape of a script

Every package script is a file under `scripts/`, so `package.json` holds a delegation rather than a command. Each one forwards its arguments and propagates the child's exit code, which is what keeps the filtered test forms (`bun run test <file>`, `bun run test -t <name>`) working and what makes a failure fail whatever called it. `check` is the two check scripts chained with `&&`, so a type error stops before Biome runs.

Every one of them is a docstring plus a single `execAsync` call, from `scripts/utils/shell.ts`. That helper echoes the command, runs it through Bun Shell with `.nothrow()`, and then calls `process.exit` with the child's code — on success as well as on failure. So `execAsync` never returns, and anything written after it in a script is dead code.

Bun Shell resolves `node_modules/.bin` itself, which is why a bare `tsc`, `biome`, or `wrangler` works here even though running a file directly does not put that directory on `PATH` the way an npm-style script does. (These scripts used to spell that out as `bunx`; they no longer do, so don't reintroduce the wrapper on the old reasoning.)

## Biome

`check:biome` reports without touching anything. `bun run check:biome --write` applies what Biome can fix on its own. `format:biome` is the same check with `--write --unsafe` — read the diff after (`format` is an alias).

The repository's formatting comes from `@kcconfigs/biome` via `biome.json`, which also ignores `assets/` — that directory is 14 MB of generated scrape output and reformatting it would bury every real diff.

## The two checks are stricter together than either is alone

`tsconfig.json` sets `noUncheckedIndexedAccess`, so every index and every regex capture group arrives as `T | undefined`; `@kcconfigs/biome` forbids `!`, so the usual escape hatch fails lint. Narrow instead: a destructuring default (`const [, href = ""] = match`), `??`, or pulling the element into a `const` and guarding it. `scripts/fetch-assets.ts` does all three. `!` after `?.` is worse still — that one is an error rather than a warning, and Biome is right that it defeats the optional chain.

## Dev server

`bun run dev` runs `scripts/dev.ts`, a small `Bun.serve()` whose route table is generated from `TOOLS`. Handing Bun the HTML files directly (`bun routes/index.html routes/combi-name/index.html`) registers only `/` and `/combi-name`, which 404s on the trailing-slash links the sidebar renders. So each page answers to every spelling: `/` and `/index.html` for the home pane, `/<slug>`, `/<slug>/`, and `/<slug>/index.html` for each tool.

An unrouted URL comes back as a 404 with an empty body, which paints as a blank page rather than as an error — check the status code before concluding the page itself broke.
