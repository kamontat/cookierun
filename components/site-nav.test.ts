/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { TOOLS } from "#lib/tools.ts";

import "./site-nav.ts";

// Connecting the element is what renders it, so every case mounts one. The
// default protocol under happy-dom is http:, which is the served form.
function mount(current: string | null): HTMLElement {
  document.body.replaceChildren();
  const nav = document.createElement("site-nav");
  if (current !== null) nav.setAttribute("current", current);
  document.body.append(nav);
  return nav;
}

test("the sidebar lists home plus every registered tool", () => {
  expect(mount(null).querySelectorAll("a").length).toBe(TOOLS.length + 1);
});

test("links from the home page stay in the current directory", () => {
  const links = mount(null).querySelectorAll("a");

  expect(links[0]?.getAttribute("href")).toBe("./");
  expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});

test("links from a tool page climb out of it first", () => {
  const links = mount("combi-name").querySelectorAll("a");

  expect(links[0]?.getAttribute("href")).toBe("../");
  expect(links[1]?.getAttribute("href")).toBe("../combi-name/");
});

test("the current tool is the only entry marked", () => {
  const marked = mount("combi-name").querySelectorAll('[aria-current="page"]');

  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Combi name codes");
});

test("home is marked when no tool is active", () => {
  const marked = mount(null).querySelectorAll('[aria-current="page"]');

  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Home");
});

// A slug that was never registered - a typo copied from another page, or a
// tool that got renamed - used to pass straight through an `as ToolSlug`
// cast. That handed hrefFor a non-null `from`, which writes `../`-prefixed
// links: a root-level page would get links that climb out of the site
// entirely instead of merely landing on the home pane.
test("an unregistered current value is treated as the home pane", () => {
  const nav = mount("not-a-real-tool");

  const marked = nav.querySelectorAll('[aria-current="page"]');
  expect(marked.length).toBe(1);
  expect(marked[0]?.textContent).toBe("Home");

  const links = nav.querySelectorAll("a");
  expect(links[0]?.getAttribute("href")).toBe("./");
  expect(links[1]?.getAttribute("href")).toBe("./combi-name/");
});

// The pages used to wire this themselves, in an order that had to be right.
test("the sidebar renders the theme control itself", () => {
  expect(mount(null).querySelector("theme-toggle")).not.toBeNull();
});
