/// <reference lib="dom" />

import { expect, test } from "bun:test";

import { need } from "../shared/chrome.ts";

const page = await Bun.file(new URL("./index.html", import.meta.url)).text();
const body = page.slice(
  page.indexOf("<body>") + "<body>".length,
  page.indexOf("</body>"),
);

document.body.innerHTML = body;
await import("./main.ts");

function fire(node: HTMLElement): void {
  node.dispatchEvent(new Event("input", { bubbles: true }));
}

function check(hostId: string, value: string, checked: boolean): void {
  const input = need(hostId).querySelector<HTMLInputElement>(
    `input[value="${value}"]`,
  );
  if (input === null) throw new Error(`missing ${value} checkbox in #${hostId}`);
  input.checked = checked;
  fire(input);
}

const codeOutput = need("code-output");
const code = codeOutput.querySelector("code")!;
const typeSelect = need<HTMLSelectElement>("type");
const episodeSelect = need<HTMLSelectElement>("episode");
const randomBoostSelect = need<HTMLSelectElement>("randomBoost");
const builderVerdict = need("builder-verdict");
const codeInput = need<HTMLInputElement>("code-input");
const readerMessage = need("reader-message");
const readerRows = need("reader-rows");
const readerVerdict = need("reader-verdict");
const loadButton = need<HTMLButtonElement>("load");

test("the builder starts on a valid code", () => {
  expect(code.textContent).toBe("1S0---000-");
  expect(builderVerdict.textContent).toBe("");
});

test("the builder rewrites the type slot to H once a boost forces manual work", () => {
  typeSelect.value = "auto";
  fire(typeSelect);
  expect(code.textContent).toBe("1A0---000-");

  check("boosts", "fastStart", true);

  expect(code.textContent).toBe("1H0--F000-");
  expect(builderVerdict.textContent).toContain("Semi-auto");
  expect(builderVerdict.textContent).toContain("Fast Start");
});

test("the builder folds cookie power+ picks into the hex slots", () => {
  check("cookiePowers", "fairy", true);
  check("cookiePowers", "seaFairy", true);

  expect(code.textContent).toBe("1H0--F014-");

  check("cookiePowers", "fairy", false);
  check("cookiePowers", "seaFairy", false);
  check("boosts", "fastStart", false);
});

test("the reader uppercases what you type and spells the combi out", () => {
  codeInput.value = "1e3-pf400j";
  fire(codeInput);

  expect(codeInput.value).toBe("1E3-PF400J");
  expect(readerMessage.textContent).toBe("");
  expect(readerRows.textContent).toContain("Episode 3");
  expect(readerRows.textContent).toContain("Revive once with 80 HP");
  expect(loadButton.hidden).toBe(false);
  // Exp is played by hand, so auto vs semi-auto is not a question worth asking.
  expect(readerVerdict.textContent).toBe("");
});

test("the reader counts characters while a code is still short", () => {
  codeInput.value = "1E3";
  fire(codeInput);

  expect(readerMessage.textContent).toBe("3 of 10 characters.");
  expect(readerRows.textContent).toBe("");
  expect(loadButton.hidden).toBe(true);
});

test("the reader reports an unreadable slot instead of guessing", () => {
  codeInput.value = "1Z0---000-";
  fire(codeInput);

  expect(readerMessage.textContent).toContain('slot 2 (type): unknown char "Z"');
  expect(readerMessage.classList.contains("error")).toBe(true);
  expect(loadButton.hidden).toBe(true);
});

test("the reader surfaces a soft warning without refusing the code", () => {
  codeInput.value = "1A3H-F400-";
  fire(codeInput);

  expect(readerMessage.textContent).toBe("");
  expect(need("reader-warnings").textContent).toContain("slot 2 says Auto");
  expect(readerVerdict.textContent).toContain("Semi-auto");
});

test("loading a code into the builder fills every control", () => {
  codeInput.value = "1E3-PF400J";
  fire(codeInput);
  loadButton.click();

  expect(typeSelect.value).toBe("exp");
  expect(episodeSelect.value).toBe("episode3");
  expect(randomBoostSelect.value).toBe("revive");
  expect(code.textContent).toBe("1E3-PF400J");
});
