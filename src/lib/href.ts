import type { ToolSlug } from "./tools.ts";

/**
 * Links are written as directories - `./combi-name/`, `../` - so a served site
 * shows `/combi-name` rather than a filename. Nothing serves a directory index
 * when the standalone build is opened straight from disk, though, so under
 * `file:` the filename goes back on. Relative either way: GitHub Pages puts the
 * site under a project subpath, where a root-relative `/combi-name` would miss.
 *
 * Every page renders the same list from a different depth - the home page at
 * the root, a tool page one directory down - so the prefix is explicit.
 */
export function hrefFor(
	target: ToolSlug | null,
	from: ToolSlug | null,
	protocol: string = globalThis.location?.protocol ?? "https:",
): string {
	const directory = `${from === null ? "./" : "../"}${target === null ? "" : `${target}/`}`;
	return protocol === "file:" ? `${directory}index.html` : directory;
}
