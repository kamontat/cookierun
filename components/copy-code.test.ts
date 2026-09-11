/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./copy-code.ts";

import type { CopyCode } from "./copy-code.ts";

function mount(value: string): CopyCode {
  document.body.replaceChildren();
  const element = document.createElement("copy-code");
  element.setAttribute("value", value);
  document.body.append(element);
  return element;
}

function stubClipboard(writeText: () => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
}

test("the value shows as code", () => {
  expect(mount("1S0---000-").querySelector("code")?.textContent).toBe(
    "1S0---000-",
  );
});

test("setting the property updates the code and the attribute", () => {
  const element = mount("1S0---000-");

  element.value = "1H0--F000-";

  expect(element.querySelector("code")?.textContent).toBe("1H0--F000-");
  expect(element.getAttribute("value")).toBe("1H0--F000-");
  expect(element.value).toBe("1H0--F000-");
});

test("copying reports that it worked", async () => {
  const element = mount("1S0---000-");
  let copied = "";
  stubClipboard(async () => void (copied = element.value));

  element.querySelector("button")!.click();
  await Bun.sleep(0);

  expect(copied).toBe("1S0---000-");
  expect(element.querySelector(".status")?.textContent).toBe("Copied.");
});

test("a blocked clipboard tells the reader to copy by hand", async () => {
  const element = mount("1S0---000-");
  stubClipboard(() => Promise.reject(new Error("denied")));

  element.querySelector("button")!.click();
  await Bun.sleep(0);

  const status = element.querySelector(".status")!;
  expect(status.textContent).toContain("copy it by hand");
  expect(status.classList.contains("error")).toBe(true);
});

// A stale "Copied." next to a code that has since changed is a lie.
test("a new value clears the status", async () => {
  const element = mount("1S0---000-");
  stubClipboard(async () => {});

  element.querySelector("button")!.click();
  await Bun.sleep(0);
  element.value = "1H0--F000-";

  expect(element.querySelector(".status")?.textContent).toBe("");
});
