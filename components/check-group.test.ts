/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./check-group.ts";

import type { CheckGroup } from "./check-group.ts";

function mount(id: string, legend: string): CheckGroup {
  document.body.replaceChildren();
  const element = document.createElement("check-group");
  element.id = id;
  element.setAttribute("legend", legend);
  document.body.append(element);
  element.options = [
    ["hp", "HP Extension"],
    ["power", "Power Jelly Boost"],
    ["fast", "Fast Start"],
  ];
  return element;
}

test("the legend names the group", () => {
  expect(mount("boosts", "Boosts").querySelector("legend")?.textContent).toBe(
    "Boosts",
  );
});

test("a checkbox is rendered per option, in the order given", () => {
  const inputs = mount("boosts", "Boosts").querySelectorAll("input");

  expect([...inputs].map((input) => input.value)).toEqual([
    "hp",
    "power",
    "fast",
  ]);
});

// This is the wire format. Boosts occupy slots 4-6 and cookie powers are bit
// positions, so reading back in DOM-click order would reorder the code.
test("selected reads back in the option order, not the order ticked", () => {
  const element = mount("boosts", "Boosts");
  const inputs = [...element.querySelectorAll("input")];

  inputs[2]!.checked = true;
  inputs[0]!.checked = true;

  expect(element.selected).toEqual(["hp", "fast"]);
});

test("setting selected ticks exactly those boxes", () => {
  const element = mount("boosts", "Boosts");

  element.selected = ["power"];
  expect([...element.querySelectorAll("input")].map((i) => i.checked)).toEqual([
    false,
    true,
    false,
  ]);

  element.selected = [];
  expect([...element.querySelectorAll("input")].map((i) => i.checked)).toEqual([
    false,
    false,
    false,
  ]);
});

test("a value that is not an option is ignored rather than invented", () => {
  const element = mount("boosts", "Boosts");

  element.selected = ["hp", "nonsense"];
  expect(element.selected).toEqual(["hp"]);
});

test("an input event from a checkbox bubbles out of the element", () => {
  const element = mount("boosts", "Boosts");

  let seen = 0;
  document.body.addEventListener("input", () => void (seen += 1));
  element
    .querySelector("input")!
    .dispatchEvent(new Event("input", { bubbles: true }));

  expect(seen).toBe(1);
});
