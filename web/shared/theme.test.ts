/// <reference lib="dom" />

import { expect, test } from "bun:test";

import {
  applyTheme,
  readTheme,
  renderThemeControl,
  writeTheme,
  THEME_KEY,
} from "./theme.ts";

function fakeStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    read: () => store.get(THEME_KEY) ?? null,
  };
}

function hostAndRoot() {
  return {
    host: document.createElement("div"),
    root: document.createElement("html"),
  };
}

test("an unset or unrecognised choice falls back to following the system", () => {
  expect(readTheme(fakeStorage())).toBe("system");
  expect(readTheme(fakeStorage({ [THEME_KEY]: "sepia" }))).toBe("system");
  expect(readTheme(fakeStorage({ [THEME_KEY]: "dark" }))).toBe("dark");
});

// Pico reads prefers-color-scheme only when the attribute is absent, so
// "system" has to remove it rather than write some third value.
test("applying system removes the attribute instead of setting one", () => {
  const root = document.createElement("html");

  applyTheme("dark", root);
  expect(root.getAttribute("data-theme")).toBe("dark");

  applyTheme("system", root);
  expect(root.hasAttribute("data-theme")).toBe(false);
});

test("system is stored as the absence of a choice", () => {
  const storage = fakeStorage({ [THEME_KEY]: "light" });

  writeTheme("dark", storage);
  expect(storage.read()).toBe("dark");

  writeTheme("system", storage);
  expect(storage.read()).toBe(null);
});

test("a browser that refuses storage still themes the page", () => {
  const hostile = {
    getItem: () => {
      throw new Error("denied");
    },
    setItem: () => {
      throw new Error("denied");
    },
    removeItem: () => {
      throw new Error("denied");
    },
  };
  const { host, root } = hostAndRoot();

  expect(readTheme(hostile)).toBe("system");
  expect(() => writeTheme("dark", hostile)).not.toThrow();
  expect(() => renderThemeControl(host, root, hostile)).not.toThrow();
});

test("the control offers the three choices and starts on the stored one", () => {
  const { host, root } = hostAndRoot();
  const storage = fakeStorage({ [THEME_KEY]: "light" });

  renderThemeControl(host, root, storage);
  const select = host.querySelector("select")!;

  expect([...select.options].map((option) => option.value)).toEqual([
    "system",
    "light",
    "dark",
  ]);
  expect(select.value).toBe("light");
  expect(root.getAttribute("data-theme")).toBe("light");
  expect(host.querySelector("label")?.htmlFor).toBe(select.id);
});

test("choosing a theme paints the page and remembers it", () => {
  const { host, root } = hostAndRoot();
  const storage = fakeStorage();

  renderThemeControl(host, root, storage);
  const select = host.querySelector("select")!;

  select.value = "dark";
  select.dispatchEvent(new Event("change"));

  expect(root.getAttribute("data-theme")).toBe("dark");
  expect(storage.read()).toBe("dark");

  select.value = "system";
  select.dispatchEvent(new Event("change"));

  expect(root.hasAttribute("data-theme")).toBe(false);
  expect(storage.read()).toBe(null);
});
