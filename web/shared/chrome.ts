import { TOOLS, type ToolSlug } from "#lib/shared/tools.ts";

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
 * Every page renders the same list, but from a different depth: the home page
 * sits at the root and a tool page one directory down. Pages link by filename
 * rather than by directory so the standalone build works from `file://`, which
 * means the prefix has to be written out rather than left to the server.
 */
function entries(active: ToolSlug | null): Entry[] {
  const prefix = active === null ? "./" : "../";

  return [
    { href: `${prefix}index.html`, label: "Home", current: active === null },
    ...TOOLS.map(({ slug, name }) => ({
      href: `${prefix}${slug}/index.html`,
      label: name,
      current: slug === active,
    })),
  ];
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

  host.replaceChildren(title, nav);
}
