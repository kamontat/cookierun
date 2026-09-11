---
name: build-and-deploy
description: Use when changing `bun run build`, routes/base.css or a route stylesheet, wrangler.jsonc, the dist/ output shape, or anything under .github/workflows/ — including bumping a pinned action SHA or debugging a Cloudflare deploy.
---

# Web build and deployment

## Build

`bun run build` takes one entrypoint per page, and `--compile --target=browser` inlines each page's JavaScript, CSS, and referenced assets into its own self-contained file: `dist/index.html` and `dist/combi-name/index.html`. `dist/` is also what Cloudflare serves — `wrangler.jsonc` names it as the asset directory — so the build's output shape is part of the deployment contract, not just a local convenience. Each file works offline from `file://` as well.

`scripts/build.ts` gets those entrypoints from `pageEntrypoints()` in `lib/tools.ts` rather than from a list, which is what retired the old warning about never globbing that list away — `sh` expands `**` as `*`, so a glob would have silently dropped the home page. `lib/tools.test.ts` asserts the build script still calls `pageEntrypoints()`, so a hand-maintained list slipped back in fails the suite rather than passing it. `scripts/dev.ts` covers the same ground for development by importing each page by name.

The consequence of inlining is that anything a page references gets embedded as a data URI — read the `assets` skill before wiring an icon into a page.

## Stylesheets

`routes/base.css` is the base stylesheet, and it belongs to no route. It imports Pico's amber theme (`@picocss/pico/css/pico.amber.min.css`), holds the body grid and every component's rules, and adds only the overrides Pico has no opinion about; colors come from Pico's custom properties, not a local palette. Every route's `index.css` opens by importing it and then adds that page's own rules — the home pane's sheet carries the `tool-index` rules and nothing else. The build inlines that two-level chain, so nothing ships an `@import`.

The base sheet is a separate file rather than the home pane's sheet doubling as one, which it used to be. Two things fell out of that arrangement: the home pane could never hold a rule the other routes should not see, and a new route whose sheet held only the import hashed byte-identical to the base and stopped the build with `Multiple files share the same output path` — two entry stylesheets that hash alike cannot both be written, and nothing in that message says so.

One declaration is still split across both levels: the base sheet gives `main > :only-child` the full grid width, which is what makes a single-section page span both columns, and the combi page's sheet spans `.result, .legend` the same way. Neither file can see the other's selectors, and losing either half is a layout break no test catches.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` names the worker `cookierun`, sets `build.command` to `bun run build`, and points `assets.directory` at `dist/` — so wrangler runs the build itself, and neither deploy workflow builds beforehand. Nothing else reads `dist/`; changing where the build writes means changing that file too.

Three workflows, each pinning every action to a full commit SHA with the release tag in a trailing comment:

- `main.yml` — install, `bun test`, `bun run check`, `bun run build`. This is the only place the suite runs in CI. It calls `bun test` directly rather than `bun run test`, so the wrapper script is for local callers only.
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
