/**
 * One self-contained file per page. `--compile --target=browser` inlines each
 * page's JavaScript, CSS, and referenced assets, which is what removes any
 * base-path concern when GitHub Pages serves the site from a project subpath
 * and what makes each file work offline from file://.
 *
 * Entrypoints come from the registry rather than a list here: `sh` expands
 * `**` as `*`, so a glob would silently drop routes/index.html.
 */
import { $ } from "bun";

import { pageEntrypoints } from "#lib/tools.ts";

const { exitCode } =
  await $`bun build --compile --target=browser ${pageEntrypoints()} --outdir=dist --minify`.nothrow();

process.exit(exitCode);
