/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/shared/tools.ts";

import { renderSidebar, renderToolList } from "./chrome.ts";

function sidebar(active: Parameters<typeof renderSidebar>[1]): HTMLElement {
  const host = document.createElement("aside");
  renderSidebar(host, active);
  return host;
}

test("the sidebar lists home plus every registered tool", () => {
  expect(sidebar(null).querySelectorAll("a").length).toBe(TOOLS.length + 1);
});

test("links from the home page stay in the current directory", () => {
  const links = sidebar(null).querySelectorAll("a");

  expect(links[0]?.getAttribute("href")).toBe("./index.html");
  expect(links[1]?.getAttribute("href")).toBe("./combi-name/index.html");
});

// A tool page sits one directory down, so the same list has to be written
// differently there. Getting this wrong is a 404 on every link but one.
test("links from a tool page climb out of it first", () => {
  const links = sidebar("combi-name").querySelectorAll("a");

  expect(links[0]?.getAttribute("href")).toBe("../index.html");
  expect(links[1]?.getAttribute("href")).toBe("../combi-name/index.html");
});

test("the current tool is the only entry marked", () => {
  const marked = sidebar("combi-name").querySelectorAll('[aria-current="page"]');

  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Combi name codes");
});

test("home is marked when no tool is active", () => {
  const marked = sidebar(null).querySelectorAll('[aria-current="page"]');

  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Home");
});

test("the home index says what each tool does, not just its name", () => {
  const host = document.createElement("dl");
  renderToolList(host);

  expect(host.querySelectorAll("dt").length).toBe(TOOLS.length);

  TOOLS.forEach((tool, index) => {
    const link = host.querySelectorAll("dt")[index]?.querySelector("a");
    expect(link?.getAttribute("href")).toBe(`./${tool.slug}/index.html`);
    expect(link?.textContent).toBe(tool.name);
    expect(host.querySelectorAll("dd")[index]?.textContent).toBe(tool.tagline);
  });
});
