/**
 * One self-contained file per page. `--compile --target=browser` inlines each
 * page's JavaScript, CSS, and referenced assets, which is what leaves each
 * file with no assumption about where it is served from and what makes it work
 * offline from file://. `dist/` is also what wrangler serves.
 *
 * Entrypoints come from the registry rather than a list here: `sh` expands
 * `**` as `*`, so a glob would silently drop routes/index.html.
 */

import { pageEntrypoints } from "#lib/tools.ts";
import { execAsync } from "./utils/shell";

await execAsync(
	"bun",
	"build",
	"--compile",
	"--target=browser",
	...pageEntrypoints(),
	"--outdir=dist",
	"--minify",
);
