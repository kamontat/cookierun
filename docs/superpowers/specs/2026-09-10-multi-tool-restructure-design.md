# Multi-tool restructure

Date: 2026-09-10

## Context

The repository holds one tool — the combi name encoder — and its layout says so. `src/` is the codec, `web/` is the page, and `bun run build` compiles `web/index.html` into a single `dist/index.html` served at the site root.

A second tool has no place to go. Adding one would either pile a second concern into `src/` and `web/`, or start a parallel structure with no shared entry point for a visitor.

This design makes the site a small collection: a dashboard at `/` that lists the tools, each tool at its own path, and a `lib/` split by tool with a shared namespace for code more than one tool uses.

## Goals

- A dashboard at `/` listing every tool, generated from one registry rather than hand-maintained markup.
- The combi tool moves to `/combi-name/`, self-contained as it is today.
- `src/` becomes `lib/`, namespaced per tool, with `lib/shared/` for cross-tool code.
- Imports read `#lib/combi-name/codec.ts`, not `../../lib/combi-name/codec.ts`.
- Most hand-written CSS is replaced by a framework.
- Every page stays a standalone HTML file that works offline from `file://`.

## Non-goals

- No second tool is built here. This makes room for one.
- No cross-page navigation bar. One tool does not justify generating a nav; a back link is enough.
- No change to the codec, the wire format, or `VERSION`. Files move; their contents change only where an import path or a class name does.
- No change to `.github/workflows/deploy.yml`. It publishes `dist/`, which is still the whole site.

## Layout

```
lib/
  shared/
    tools.ts               tool registry
    tools.test.ts
  combi-name/
    codec.ts               codec.test.ts
    describe.ts            describe.test.ts
    labels.ts              labels.test.ts
                           exhaustive.test.ts
web/
  index.html               dashboard          ->  /
  dashboard.ts
  dashboard.test.ts
  shared/
    styles.css             Pico import + overrides
  combi-name/
    index.html             combi tool         ->  /combi-name/
    main.ts
    main.test.ts
```

Every move uses `git mv`, so history follows the files.

`web/shared/styles.css` is the only stylesheet. Both pages link it — `./shared/styles.css` from the dashboard, `../shared/styles.css` from the tool. The standalone build inlines it into each page separately, so sharing the file costs nothing at runtime and keeps one place to edit.

## Subpath imports

`package.json` gains:

```json
"imports": { "#lib/*": "./lib/*" }
```

Verified against this repository's `tsconfig.json`: `#lib/combi-name/codec.ts` resolves under `tsc --noEmit`, `bun run`, and `bun build --compile --target=browser`. No compiler option changes.

Use `#lib/...` for any import that would otherwise climb out of its directory. Within a directory, keep relative imports — `./codec.ts` from `describe.ts` stays as it is.

## Tool registry

`lib/shared/tools.ts` is the single source of truth for what tools exist:

```ts
export type Tool = {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
};

export const TOOLS = [
  {
    slug: "combi-name",
    name: "Combi name codes",
    tagline: "Pack a run configuration into a 10-character combi name.",
  },
] as const satisfies readonly Tool[];

export function toolHref(slug: string): string {
  return `./${slug}/index.html`;
}
```

The slug is the only identifier. The directory (`web/<slug>/`), the URL (`/<slug>/`), and the link are all derived from it, so a tool cannot be registered under one name and served under another.

Links point at `./<slug>/index.html` rather than `./<slug>/`. GitHub Pages resolves both, but only the explicit filename works when the page is opened from `file://`, which the standalone build exists to support.

`lib/shared/tools.test.ts` asserts:

- slugs are unique;
- each slug has a `web/<slug>/index.html` on disk;
- both the `dev` and `build` scripts in `package.json` list that entrypoint.

The third assertion catches the real failure mode: someone adds a tool and a registry entry, forgets the build script, and ships a dashboard card linking to a page that was never built.

## Dashboard

`web/index.html` holds a masthead and an empty container, following the convention already set by the combi page: containers in markup, content generated in TypeScript. `web/dashboard.ts` renders one `<article>` per registry entry — Pico styles `<article>` as a card without any class — containing the name as a link to `toolHref(slug)` and the tagline beneath it.

`web/dashboard.test.ts` loads the page body into the document, imports `dashboard.ts`, and asserts one link per registry entry with the expected `href` and text.

In the other direction, each tool page carries a static back link to `../index.html` in its masthead. It is one line of markup per page, which is why the chrome is duplicated rather than generated.

## Build and dev

Entrypoints are listed explicitly in both scripts:

```
dev:   bun web/index.html web/combi-name/index.html
build: bun build --compile --target=browser web/index.html web/combi-name/index.html --outdir=dist --minify
```

A glob is tempting and wrong: `sh` expands `**` the same as `*`, so `./web/**/*.html` matches `web/combi-name/index.html` but drops `web/index.html`, silently building a site with no dashboard. The registry test is what keeps the explicit lists honest.

Verified: a multi-entrypoint `--compile --target=browser` build writes `dist/index.html` and `dist/combi-name/index.html`, each self-contained. Bun derives the output structure from the longest common prefix of the entrypoints, which is `web/`.

## Styling

`web/shared/styles.css` becomes:

```css
@import "@picocss/pico/css/pico.amber.min.css";

/* overrides */
```

Pico is classless, and the existing markup is already semantic — `header`, `main`, `section`, `form`, `label`, `select`, `table`, `dl` — so it styles nearly everything untouched. The full build rather than the classless one, because `.container` and `.grid` handle the dashboard card grid and the builder/reader columns without hand-written layout. Amber, because it suits the subject.

The current 289-line `web/styles.css` collapses to roughly 40 lines covering what Pico has no opinion about: the monospace code display and copy row, the slot diagram `<pre>`, the warning list, and the verdict line.

Verified: `@import "@picocss/pico"` resolves from `node_modules` and inlines into the standalone output.

The cost is page weight. Each standalone page goes from 17 KB to roughly 85 KB, since the framework is inlined per page and there are two pages. For a static site with no runtime dependencies this is an accepted trade for deleting most of the stylesheet.

## Testing

Test-driven, tests moving with their subjects. The existing 35 tests keep passing with only import paths edited; `bunfig.toml` and `happydom.ts` are unchanged, so `document` and `window` still exist in every test file.

New tests:

- `lib/shared/tools.test.ts` — the registry assertions above.
- `web/dashboard.test.ts` — one card per registry entry, correct `href` and name.

`src/exhaustive.test.ts` moves to `lib/combi-name/exhaustive.test.ts` with its hardcoded counts untouched. The configuration space does not change here; if those numbers move, something is wrong with the move itself.

## Documentation

`AGENTS.md`: the new tree, the `#lib/` import convention, the registry as the source of truth for tools, Pico as the stylesheet, and a checklist for adding a tool — registry entry, `web/<slug>/index.html`, `lib/<slug>/`, both package.json scripts.

`README.md`: a short note that the site is a dashboard at `/` with the combi tool at `/combi-name/`. The slot format documentation is unaffected.

## Migration order

1. Add `imports` to `package.json`; `git mv src lib/combi-name`; rewrite imports to `#lib/...`; tests green.
2. Add `lib/shared/tools.ts` and its test.
3. `git mv web/{index.html,main.ts,main.test.ts} web/combi-name/`; add the dashboard page, `dashboard.ts`, and its test; add the back link.
4. Install `@picocss/pico`; move `web/styles.css` to `web/shared/styles.css`; replace its body with the Pico import plus overrides.
5. Update both package.json scripts; update `AGENTS.md` and `README.md`.

Each step ends with `bun test` and `bun run typecheck` passing.

## Risks

- **Registry and build scripts drift.** Mitigated by the registry test asserting both scripts list every tool's entrypoint.
- **Pico restyles something subtly wrong.** The pages are checked in a browser after step 4; the DOM tests assert behavior, not appearance, so they will not catch it.
- **Page weight.** Accepted, quantified above.
