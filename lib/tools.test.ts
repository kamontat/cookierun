import { expect, test } from "bun:test";

import { TOOLS } from "./tools.ts";

const root = new URL("../", import.meta.url);

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

async function pages(): Promise<string[]> {
  const paths = ["web/index.html", ...TOOLS.map(({ slug }) => `web/${slug}/index.html`)];
  return Promise.all(paths.map((path) => Bun.file(new URL(path, root)).text()));
}

// Navigation lives in the sidebar every page renders from this registry, so a
// page without the element is a page you cannot leave.
test("every page hosts the sidebar", async () => {
  for (const page of await pages()) {
    expect(page).toContain("<site-nav");
  }
});

// The sidebar is the first thing in the DOM, so without this every page opens
// with a keyboard walk through the navigation before reaching the content.
test("every page offers a skip link to its content", async () => {
  for (const page of await pages()) {
    expect(page).toContain('href="#content"');
    expect(page).toContain('id="content"');
  }
});

// The module scripts are deferred, so a page without this paints in the
// system theme and flips once the saved choice is read.
test("every page applies a saved theme before it paints", async () => {
  for (const page of await pages()) {
    expect(page).toContain('id="theme-boot"');
    expect(page).toContain('localStorage.getItem("theme")');
  }
});

test("the home page hosts the tool index", async () => {
  const [home] = await pages();
  expect(home).toContain('id="tools"');
});
