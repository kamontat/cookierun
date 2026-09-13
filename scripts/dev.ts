import type { HTMLBundle } from "bun";

import { TOOLS, type ToolSlug } from "#lib/tools.ts";
import combiName from "../routes/combi-name/index.html";
import home from "../routes/index.html";

const ASSETS = new URL("../assets/", import.meta.url).pathname;

/**
 * The built page loads icons from `../assets/`, which wrangler serves out of
 * `dist/`. In development nothing writes `dist/`, so the dev server answers for
 * the repository's own `assets/` directory instead.
 */
const serveAsset = (request: Request): Response => {
	const path = new URL(request.url).pathname.slice("/assets/".length);
	if (path.includes("..")) return new Response("no", { status: 400 });
	return new Response(Bun.file(ASSETS + path));
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
const routes: Record<string, HTMLBundle | ((request: Request) => Response)> = {
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
