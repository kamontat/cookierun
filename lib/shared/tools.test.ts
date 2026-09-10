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

// A registered tool that nothing builds would show up in the sidebar as a
// link to a page that was never written.
test("every tool page is an entrypoint of the build script", async () => {
  const { scripts } = (await Bun.file(new URL("package.json", root)).json()) as {
    scripts: Record<string, string>;
  };

  for (const { slug } of TOOLS) {
    expect(scripts.build).toContain(`web/${slug}/index.html`);
  }
});

// The dev server serves what it imports, so a tool missing from web/dev.ts is
// a 404 in development even though the build ships it. The Record<ToolSlug>
// in that file makes typecheck fail too; this catches it at test time.
test("every tool page is imported by the dev server", async () => {
  const devServer = await Bun.file(new URL("web/dev.ts", root)).text();

  for (const { slug } of TOOLS) {
    expect(devServer).toContain(`./${slug}/index.html`);
  }
});

test("toolHref names the page file so file:// resolves it too", () => {
  expect(toolHref("combi-name")).toBe("./combi-name/index.html");
});

test("the home page is built and served like the tools are", async () => {
  const { scripts } = (await Bun.file(new URL("package.json", root)).json()) as {
    scripts: Record<string, string>;
  };
  const devServer = await Bun.file(new URL("web/dev.ts", root)).text();

  expect(scripts.build).toContain("web/index.html");
  expect(devServer).toContain('"/": home');
});

// Every link the pages carry has to resolve in development too, or the dev
// server is a different site from the one that ships.
test("the dev server routes every URL form the pages link to", async () => {
  const devServer = await Bun.file(new URL("web/dev.ts", root)).text();

  expect(devServer).toContain('"/index.html": home');
  for (const suffix of ["", "/", "/index.html"]) {
    expect(devServer).toContain(`\`/\${slug}${suffix}\``);
  }
});

// Navigation lives in the sidebar every page renders from this registry, so a
// page without the host element is a page you cannot leave.
test("every tool page hosts the sidebar", async () => {
  for (const { slug } of TOOLS) {
    const page = await Bun.file(
      new URL(`web/${slug}/index.html`, root),
    ).text();
    expect(page).toContain('id="sidebar"');
  }
});
