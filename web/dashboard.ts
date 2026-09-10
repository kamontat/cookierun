import { TOOLS, toolHref } from "#lib/shared/tools.ts";

function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}

const toolsHost = need("tools");

toolsHost.replaceChildren(
  ...TOOLS.map(({ slug, name, tagline }) => {
    const link = document.createElement("a");
    link.href = toolHref(slug);
    link.textContent = name;

    const heading = document.createElement("h2");
    heading.append(link);

    const description = document.createElement("p");
    description.textContent = tagline;

    const card = document.createElement("article");
    card.append(heading, description);
    return card;
  }),
);
