/**
 * One self-contained file per page. `--compile --target=browser` inlines each
 * page's JavaScript, CSS, and referenced assets, which is what leaves each
 * file with no assumption about where it is served from and what makes the
 * home page work offline from file://. The combi page is the exception: its
 * cookie, pet, and treasure icons are too large to inline, so `bun run build`
 * runs `scripts/copy-assets.ts` after this to ship them as a sibling
 * `assets/` directory instead — that page still works from an intact
 * `dist/`, just not as a single file. `dist/` is also what wrangler serves.
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
