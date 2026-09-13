import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { HTMLBundle } from "bun";

import { TOOLS, type ToolSlug } from "#lib/tools.ts";
import combiName from "../routes/combi-name/index.html";
import home from "../routes/index.html";

/**
 * `fileURLToPath` rather than `.pathname`: `pathname` percent-encodes, so a
 * checkout under a path containing a space (or any other reserved character)
 * would give an `ASSETS` that never matches what `resolve()` — which works in
 * literal filesystem paths — returns, and the containment check below would
 * fail for every request.
 */
const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));

/**
 * The built page loads icons from `../assets/`, which wrangler serves out of
 * `dist/`. In development nothing writes `dist/`, so the dev server answers for
 * the repository's own `assets/` directory instead.
 *
 * Containment is checked by resolving the path rather than by looking for
 * "..": `pathname` has already collapsed literal dot segments by the time the
 * handler sees it, and a percent-encoded one never matches a substring test, so
 * a ".." check would be reassuring and useless.
 */
const serveAsset = async (request: Request): Promise<Response> => {
	const { pathname } = new URL(request.url);
	// Decoded before the containment check, never after: the check has to see
	// the literal path the filesystem will, or an encoded ".." would sail
	// through as harmless-looking characters and a legitimately encoded
	// filename would 404.
	const segment = decodeURIComponent(pathname.slice("/assets/".length));
	const resolved = resolve(ASSETS + segment);
	if (!resolved.startsWith(ASSETS)) {
		return new Response("outside the asset directory", { status: 403 });
	}

	const file = Bun.file(resolved);
	if (!(await file.exists())) {
		return new Response("no such asset", { status: 404 });
	}
	return new Response(file);
};

/**
 * Each page needs a literal import so the bundler can find it, but the routes
 * themselves come from the registry. `Record<ToolSlug, ...>` is what makes a
 * registered tool with no page here a typecheck failure rather than a 404.
 */
const TOOL_PAGES: Record<ToolSlug, HTMLBundle> = {
	"combi-name": combiName,
};

/**
 * Pages link to directories (`./<slug>/`, `../`) so a served URL reads
 * `/combi-name`, and fall back to the filename under `file:`. Rather than
 * track which spelling is in play, every page answers to all of them.
 */
const routes: Record<
	string,
	HTMLBundle | ((request: Request) => Promise<Response>)
> = {
	"/": home,
	"/index.html": home,
	"/assets/*": serveAsset,
};

for (const { slug } of TOOLS) {
	const page = TOOL_PAGES[slug];
	routes[`/${slug}`] = page;
	routes[`/${slug}/`] = page;
	routes[`/${slug}/index.html`] = page;
}

const server = Bun.serve({
	routes,
	development: { hmr: true, console: true },
});

console.log(`Serving ${TOOLS.length + 1} pages at ${server.url}`);
