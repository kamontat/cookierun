/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools.ts";

import { renderToolList } from "./chrome.ts";

test("the home index says what each tool does, not just its name", () => {
  const host = document.createElement("dl");
  renderToolList(host);

  expect(host.querySelectorAll("dt").length).toBe(TOOLS.length);

  TOOLS.forEach((tool, index) => {
    const link = host.querySelectorAll("dt")[index]?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`./${tool.slug}/`);
    expect(link?.textContent).toBe(tool.name);
    expect(host.querySelectorAll("dd")[index]?.textContent).toBe(tool.tagline);
  });
});
