import { expect, test } from "bun:test";

import { hrefFor } from "./href.ts";

test("links from the home page stay in the current directory", () => {
  expect(hrefFor(null, null, "https:")).toBe("./");
  expect(hrefFor("combi-name", null, "https:")).toBe("./combi-name/");
});

// A tool page sits one directory down, so the same list has to be written
// differently there. Getting this wrong is a 404 on every link but one.
test("links from a tool page climb out of it first", () => {
  expect(hrefFor(null, "combi-name", "https:")).toBe("../");
  expect(hrefFor("combi-name", "combi-name", "https:")).toBe("../combi-name/");
});

// Directory links need something to serve the index. Opened from disk there
// is no server, so the filename goes back on rather than the link dying.
test("links keep the filename when the page is opened from disk", () => {
  expect(hrefFor(null, null, "file:")).toBe("./index.html");
  expect(hrefFor("combi-name", null, "file:")).toBe("./combi-name/index.html");
  expect(hrefFor(null, "combi-name", "file:")).toBe("../index.html");
  expect(hrefFor("combi-name", "combi-name", "file:")).toBe(
    "../combi-name/index.html",
  );
});

test("links stay relative so a project subpath still resolves", () => {
  for (const from of [null, "combi-name"] as const) {
    for (const target of [null, "combi-name"] as const) {
      for (const protocol of ["https:", "file:"]) {
        expect(hrefFor(target, from, protocol).startsWith("/")).toBe(false);
      }
    }
  }
});
