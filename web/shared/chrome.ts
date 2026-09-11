import { TOOLS, type ToolSlug } from "#lib/tools.ts";

export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}

type Entry = {
  readonly href: string;
  readonly label: string;
  readonly current: boolean;
};

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

function entries(active: ToolSlug | null): Entry[] {
  return [
    { href: hrefFor(null, active), label: "Home", current: active === null },
    ...TOOLS.map(({ slug, name }) => ({
      href: hrefFor(slug, active),
      label: name,
      current: slug === active,
    })),
  ];
}

/**
 * The home pane's index. The sidebar carries the same names, but only as
 * names - this is where a tool gets to say what it does.
 */
export function renderToolList(host: HTMLElement): void {
  host.replaceChildren(
    ...TOOLS.flatMap(({ slug, name, tagline }) => {
      const link = document.createElement("a");
      link.href = hrefFor(slug, null);
      link.textContent = name;

      const term = document.createElement("dt");
      term.append(link);

      const detail = document.createElement("dd");
      detail.textContent = tagline;

      return [term, detail];
    }),
  );
}

export function renderSidebar(host: HTMLElement, active: ToolSlug | null): void {
  const items = entries(active).map(({ href, label, current }) => {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    if (current) link.setAttribute("aria-current", "page");

    const item = document.createElement("li");
    item.append(link);
    return item;
  });

  const list = document.createElement("ul");
  list.append(...items);

  const nav = document.createElement("nav");
  nav.setAttribute("aria-label", "Tools");
  nav.append(list);

  const title = document.createElement("p");
  title.className = "sidebar-title";
  title.textContent = "Cookie Run tools";

  // The sidebar owns this slot rather than the markup, because rendering
  // replaces the host's children and would wipe anything a page put there.
  const foot = document.createElement("div");
  foot.id = "theme";
  foot.className = "sidebar-foot";

  host.replaceChildren(title, nav, foot);
}
