import { expect, test } from "bun:test";

import { TOOLS, toolHref } from "./tools.ts";

const root = new URL("../../", import.meta.url);

test("tool slugs are unique", () => {
  const slugs = TOOLS.map((tool) => tool.slug);
  expect(new Set(slugs).size).toBe(slugs.length);
});

test("every registered tool has a page on disk", async () => {
  for (const { slug } of TOOLS) {
    const page = Bun.file(new URL(`web/${slug}/index.html`, root));
    expect(await page.exists()).toBe(true);
  }
});

// A registered tool that no script builds would ship as a dashboard card
// pointing at a page that was never written.
test("every tool page is an entrypoint of both the dev and build scripts", async () => {
  const { scripts } = (await Bun.file(new URL("package.json", root)).json()) as {
    scripts: Record<string, string>;
  };

  for (const { slug } of TOOLS) {
    const entrypoint = `web/${slug}/index.html`;
    expect(scripts.dev).toContain(entrypoint);
    expect(scripts.build).toContain(entrypoint);
  }
});

test("toolHref names the page file so file:// resolves it too", () => {
  expect(toolHref("combi-name")).toBe("./combi-name/index.html");
});

test("the dashboard itself is an entrypoint of both scripts", async () => {
  const { scripts } = (await Bun.file(new URL("package.json", root)).json()) as {
    scripts: Record<string, string>;
  };

  expect(scripts.dev).toContain("web/index.html");
  expect(scripts.build).toContain("web/index.html");
});

test("every tool page links back to the dashboard", async () => {
  for (const { slug } of TOOLS) {
    const page = await Bun.file(
      new URL(`web/${slug}/index.html`, root),
    ).text();
    expect(page).toContain('href="../index.html"');
  }
});
