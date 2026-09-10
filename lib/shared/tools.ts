/**
 * The one place that knows what tools exist. The slug drives the library
 * namespace (`lib/<slug>/`), the page directory (`web/<slug>/`), and the URL,
 * so a tool cannot be registered under one name and served under another.
 */
export type Tool = {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
};

export const TOOLS = [
  {
    slug: "combi-name",
    name: "Combi name codes",
    tagline:
      "Pack a run configuration - type, episode, boosts, random boost, cookie power+, and action - into a 10-character combi name.",
  },
] as const satisfies readonly Tool[];

/**
 * Pages link to `./<slug>/index.html` rather than `./<slug>/`. A server
 * resolves both, but only the explicit filename works when the standalone
 * build is opened from the filesystem.
 */
export function toolHref(slug: string): string {
  return `./${slug}/index.html`;
}
