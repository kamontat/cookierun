import { hrefFor } from "#lib/href.ts";
import { TOOLS, type ToolSlug } from "#lib/tools.ts";

import "./theme-toggle.ts";

type Entry = {
  readonly href: string;
  readonly label: string;
  readonly current: boolean;
};

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
 * The sidebar every page carries. Navigation comes from the registry, so
 * nothing in any page's markup names another tool, and the theme control is
 * rendered here rather than left as a slot for the page to fill.
 */
export class SiteNav extends HTMLElement {
  connectedCallback(): void {
    const raw = this.getAttribute("current");
    const active = raw === null || raw === "" ? null : (raw as ToolSlug);

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
    title.className = "title";
    title.textContent = "Cookie Run tools";

    this.replaceChildren(title, nav, document.createElement("theme-toggle"));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "site-nav": SiteNav;
  }
}

if (!customElements.get("site-nav")) {
  customElements.define("site-nav", SiteNav);
}
