---
name: build-and-deploy
description: Use when changing `bun run build`, `bun run dev`, `bun run preview`, the `--statics` glob that ships the icons, src/routes/base.css or a route stylesheet, wrangler.jsonc, the dist/ output shape, or anything under .github/workflows/ — including bumping a pinned action SHA or debugging a Cloudflare deploy.
---

# Web build and deployment

## Build

`dev`, `build` and `preview` are each one `@kctools/bun-server` command in `package.json`, with no wrapper script (see the `repo-scripts` skill). None of the three names a page: with no input argument the tool scans `src/routes/` for `**/*.html`, and `src/routes/index.html` becomes `/`, `src/routes/<slug>/index.html` becomes `/<slug>` plus a `/<slug>/*` wildcard that covers the trailing-slash and `/index.html` spellings the sidebar renders. So adding a page is a directory, and no script changes.

`build` writes `dist/index.html` and `dist/combi-name/index.html` with `splitting: true` and `sourcemap: "linked"`, so the JavaScript and CSS they share land beside them as `chunk-*.js`, `chunk-*.css`, and `.map` files, and the favicon is extracted as a hashed sibling rather than inlined. Pages link all of it relatively, so `dist/` carries no base-path assumption — but a built page is a directory now, not one self-contained file, and `file://` no longer opens it: module scripts from a `file://` origin are blocked. `bun run preview` serves `dist/` on :4000, which is how you look at a build locally.

`build` sets `NODE_ENV=production` ahead of the command, and that is not decoration: `lit-html`'s export map carries a `development` condition, and Bun's bundler resolves it unless `NODE_ENV` says otherwise. Without it every visitor downloads Lit's development build — 12,636 B gzip in the shared chunk against 8,421 B, Lit's per-update assertions on every keystroke in the builder, and a `lit.dev/msg/dev-mode` warning on every page. It sits on the script rather than on a caller because there are three callers and all of them are the same command: `wrangler.jsonc`'s `build.command`, `main.yml`, and whoever types it. `dev` deliberately does not set it — the warnings are the point there.

`--statics 'assets/**/*.png'` is what ships the icons. Quote the glob — an unquoted one is expanded by the shell, and every extra path lands as a positional argument, which `bun-server` reads as another entrypoint to build. The source root (`assets/`) becomes the target directory, so a file arrives at `dist/assets/cookies/ch26.png` and is served at `/assets/cookies/ch26.png`. `dev.ts` passes the same flag, where the files are served from the repository's own `assets/` rather than copied, so the combi page's icons load identically in development and against a built `dist/`. Only `.png` matches, which is why `assets/index.json` stays out of `dist/` — the page bundles the index already, and shipping it twice would be 1 MB for nothing.

The build refuses to copy a static file over something it just wrote, so a glob that collides with build output fails the run rather than corrupting `dist/` silently. What it does not do is clean: `dist/` is never emptied first, so a stale file from an earlier build with different options survives. `rm -rf dist` before a build whose output shape you intend to inspect.

`dist/` is what Cloudflare serves — `wrangler.jsonc` names it as the asset directory — so the output shape is part of the deployment contract, not just a local convenience.

Everything else a page references still gets inlined as a data URI — read the `assets` skill before wiring a new icon into a page. The combi page's cookie, pet, and treasure icons are the deliberate exception: at 14 MB, inlining was never on the table, so the page loads them at runtime from `../assets/...` and `--statics` puts them there.

`pageEntrypoints()` in `src/lib/tools.ts` no longer feeds the build. It is the test's list: `src/lib/tools.test.ts` asserts the registry and the `src/routes/` directory name the same pages in both directions, so a registered tool with no page fails, and so does a page nobody registered — which the build would now happily ship and no sidebar would link to.

## Stylesheets

`src/routes/base.css` is the base stylesheet, and it belongs to no route. It imports the reset (`@kcstyles/reset.css`) and `src/routes/tokens.css` — the `--cr-*` custom properties every colour, space, and edge on the site reads — then holds the body grid, the sidebar layout, and shared typography; component styles are not here, since every custom element now carries its own inside its shadow root. Every route's `index.css` opens by importing it and then adds whatever page-level rules that route still needs — the home pane's sheet holds nothing but the import, now that the `tool-index` rules it used to carry live in the component instead. The build resolves that chain — `route index.css` → `base.css` → `@kcstyles/reset.css` + `tokens.css` — into the page's CSS chunk, so nothing ships an `@import`.

The base sheet is a separate file rather than the home pane's sheet doubling as one, which it used to be. Two things fell out of that arrangement: the home pane could never hold a rule the other routes should not see, and a new route whose sheet held only the import hashed byte-identical to the base and stopped the build with `Multiple files share the same output path` — two entry stylesheets that hash alike cannot both be written, and nothing in that message says so.

The two levels still have to be read together. The base sheet lays `main` out as two columns above 62rem and gives `main > :only-child` the full width, which is what makes the single-section home pane span both; the combi page's sheet overrides that back to one column, because its own sections are a sequence rather than a pair of panels, and does the widening inside them instead. Two other base rules are only correct because of what the routes do with them: the reset lays every `div` out as a flex column, so `.actions` spells out `flex-flow: row wrap`, and `scroll-padding-top` is sized to the combi page's sticky code panel, which is what a jump from a clicked run of the code has to clear. Resize that panel — it holds the code and the button bar, and deliberately nothing else, since on a phone it was taking half the screen — and that number moves with it. Neither file can see the other's selectors, and losing either half is a layout break no test catches.

## Deployment

The site is a Cloudflare Worker serving static assets. `wrangler.jsonc` names the worker `cookierun`, sets `build.command` to `bun run build`, and points `assets.directory` at `dist/` — so wrangler runs the build itself, and neither deploy workflow builds beforehand. Nothing else reads `dist/`; changing where the build writes means changing that file too.

Four workflows, each pinning every action to a full commit SHA with the release tag in a trailing comment:

- `main.yml` — install, `bun test`, `bun run check`, `bun run build`. This is the only place the suite runs in CI. It calls `bun test` directly rather than `bun run test`, so the wrapper script is for local callers only.
- `deploy-preview.yml` — on pull requests, `wrangler versions upload`, reporting into the `preview` environment.
- `deploy-production.yml` — on pushes to `main`, `wrangler deploy`, reporting into the `production` environment.
- `assets.yml` — Mondays at 06:00 UTC and on `workflow_dispatch`, `bun run verify:assets`. It is the only workflow that reaches cookierundb.com, and the only one on a schedule. It is deliberately not part of `main.yml`: it fails whenever the site gains an entry, and `main.yml` gates the deploys.

Both deploy workflows need `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` in repository secrets, and grant `deployments: write` on the job rather than at the top of the file — the workflows open with `permissions: {}` and hand back only what each job needs. Keep that shape in anything new.

Bun's version comes from the `packageManager` field in `package.json`, which `oven-sh/setup-bun` reads automatically — keep it in sync with `mise.toml`.

A pinned SHA is bumped by resolving the tag again rather than editing it by hand:

```bash
gh api repos/actions/checkout/releases/latest --jq .tag_name          # e.g. v7.0.1
gh api repos/actions/checkout/commits/v7.0.1 --jq .sha                # the SHA to pin
```

Update the comment in the same edit — a stale comment is worse than none, since it is the only readable record of which version the SHA is.

Pushing any change under `.github/workflows/` requires a token with the `workflow` scope. `gh auth refresh -h github.com -u <account> -s workflow` grants it.
