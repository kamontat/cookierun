/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/shared/tools.ts";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();
const body = page.slice(
  page.indexOf("<body>") + "<body>".length,
  page.indexOf("</body>"),
);

// Append rather than replace: every test file shares one happy-dom document.
// This file stays independent of the others because `holder` is a detached
// element and `cards` below is a static NodeList, not a live query.
const holder = document.createElement("div");
holder.innerHTML = body;
document.body.append(holder);

await import("./dashboard.ts");

const cards = holder.querySelectorAll("#tools article");

test("the dashboard renders one card per registered tool", () => {
  expect(cards.length).toBe(TOOLS.length);
});

test("each card links to its tool page and carries its name and tagline", () => {
  TOOLS.forEach((tool, index) => {
    const card = cards[index];
    const link = card?.querySelector("a");

    expect(link?.getAttribute("href")).toBe(`./${tool.slug}/index.html`);
    expect(link?.textContent).toBe(tool.name);
    expect(card?.textContent).toContain(tool.tagline);
  });
});
