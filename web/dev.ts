import type { HTMLBundle } from "bun";

import { TOOLS, type ToolSlug } from "#lib/shared/tools.ts";

import home from "./index.html";
import combiName from "./combi-name/index.html";

/**
 * Each page needs a literal import so the bundler can find it, but the routes
 * themselves come from the registry. `Record<ToolSlug, ...>` is what makes a
 * registered tool with no page here a typecheck failure rather than a 404.
 */
const TOOL_PAGES: Record<ToolSlug, HTMLBundle> = {
  "combi-name": combiName,
};

/**
 * The pages link to `./<slug>/index.html` and `../index.html`, which is what a
 * static host and `file://` both resolve. Handing the dev server only the
 * shortest form would 404 on every link the site actually carries, so each
 * page answers to all of its spellings.
 */
const routes: Record<string, HTMLBundle> = {
  "/": home,
  "/index.html": home,
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
