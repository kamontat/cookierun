/**
 * Copies the icon directories next to the built pages.
 *
 * The page build inlines everything a page references, and the treasure icons
 * alone are 11 MB — as data URIs that is not a page. So they ship as sibling
 * files instead: `dist/combi-name/index.html` stays one file and loads
 * `../assets/...` lazily. `file://` still works from an intact `dist/`; what is
 * given up is the single-file property for that one page.
 *
 * This runs after `build`, which is why it is its own script: `execAsync` exits
 * the process, so nothing can follow it inside one file.
 *
 * `cp -R` only adds and overwrites; it never deletes. A local `dist/` reused
 * across builds can end up with an icon that was renamed or removed from
 * `assets/` after an earlier build. CI and deploys always start from a fresh
 * checkout, so this has no production consequence.
 */

import { execAsync } from "./utils/shell";

await execAsync(
	"bash",
	"-c",
	"mkdir -p dist/assets && cp -R assets/cookies assets/pets assets/treasures dist/assets/",
);
