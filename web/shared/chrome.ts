import { hrefFor } from "#lib/href.ts";
import { TOOLS } from "#lib/tools.ts";

export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
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
