import {
  ALL_ACTIONS,
  ALL_BOOSTS,
  ALL_COOKIE_POWERS,
  ALL_EPISODES,
  ALL_RANDOM_BOOSTS,
  ALL_TYPES,
  CODE_LENGTH,
  decode,
  encode,
  type Action,
  type Boost,
  type Combi,
  type CombiType,
  type CookiePower,
  type Episode,
  type RandomBoost,
} from "#lib/combi-name/codec.ts";
import { describeCombi } from "#lib/combi-name/describe.ts";
import {
  ACTION_LABELS,
  BOOST_LABELS,
  COOKIE_POWER_LABELS,
  EPISODE_LABELS,
  RANDOM_BOOST_LABELS,
  TYPE_LABELS,
} from "#lib/combi-name/labels.ts";

import "#components/auto-verdict.ts";
import "#components/check-group.ts";
import "#components/copy-code.ts";
import "#components/labelled-select.ts";
import "#components/site-nav.ts";

import type { AutoVerdictElement } from "#components/auto-verdict.ts";
import type { CheckGroup } from "#components/check-group.ts";
import type { CopyCode } from "#components/copy-code.ts";
import type { LabelledSelect } from "#components/labelled-select.ts";

/** Exported for this route's test, which drives the page through the same lookups. */
export function need<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (node === null) throw new Error(`the page is missing #${id}`);
  return node as T;
}

const typeSelect = need<LabelledSelect>("type");
const episodeSelect = need<LabelledSelect>("episode");
const boostsGroup = need<CheckGroup>("boosts");
const randomBoostSelect = need<LabelledSelect>("randomBoost");
const cookiePowersGroup = need<CheckGroup>("cookiePowers");
const actionSelect = need<LabelledSelect>("action");

const builderForm = need<HTMLFormElement>("builder");
const codeOutput = need<CopyCode>("code-output");
const builderVerdict = need<AutoVerdictElement>("builder-verdict");

const codeInput = need<HTMLInputElement>("code-input");
const readerMessage = need("reader-message");
const readerRows = need<HTMLDListElement>("reader-rows");
const readerVerdict = need<AutoVerdictElement>("reader-verdict");
const readerWarnings = need<HTMLUListElement>("reader-warnings");
const loadButton = need<HTMLButtonElement>("load");

const NO_RANDOM_BOOST = "";

function readForm(): Combi {
  const randomBoost = randomBoostSelect.value;

  return {
    type: typeSelect.value as CombiType,
    episode: episodeSelect.value as Episode,
    boosts: boostsGroup.selected as Boost[],
    randomBoost:
      randomBoost === NO_RANDOM_BOOST ? null : (randomBoost as RandomBoost),
    cookiePowers: cookiePowersGroup.selected as CookiePower[],
    action: actionSelect.value as Action,
  };
}

function writeForm(combi: Combi): void {
  typeSelect.value = combi.type;
  episodeSelect.value = combi.episode;
  randomBoostSelect.value = combi.randomBoost ?? NO_RANDOM_BOOST;
  actionSelect.value = combi.action;
  boostsGroup.selected = combi.boosts;
  cookiePowersGroup.selected = combi.cookiePowers;
}

function setStatus(host: HTMLElement, text: string, isError = false): void {
  host.textContent = text;
  host.classList.toggle("error", isError);
}

function renderBuilder(): void {
  const code = encode(readForm());
  codeOutput.value = code;

  // Read the code back so the verdict reflects the character actually written
  // into slot 2, not the type the select still shows.
  const { combi } = decode(code);
  builderVerdict.verdict = describeCombi(combi).auto;
}

function clearReader(): void {
  readerRows.replaceChildren();
  readerWarnings.replaceChildren();
  readerVerdict.verdict = null;
  loadButton.hidden = true;
}

function renderReader(): void {
  const canonical = codeInput.value.toUpperCase();
  if (codeInput.value !== canonical) {
    const caret = codeInput.selectionStart;
    codeInput.value = canonical;
    if (caret !== null) codeInput.setSelectionRange(caret, caret);
  }

  if (canonical.length === 0) {
    setStatus(readerMessage, "");
    clearReader();
    return;
  }

  if (canonical.length !== CODE_LENGTH) {
    setStatus(
      readerMessage,
      `${canonical.length} of ${CODE_LENGTH} characters.`,
    );
    clearReader();
    return;
  }

  let combi: Combi;
  let warnings: string[];
  try {
    ({ combi, warnings } = decode(canonical));
  } catch (error) {
    setStatus(
      readerMessage,
      error instanceof Error ? error.message : String(error),
      true,
    );
    clearReader();
    return;
  }

  const described = describeCombi(combi);

  setStatus(readerMessage, "");
  readerRows.replaceChildren(
    ...described.rows.flatMap(({ field, value }) => {
      const term = document.createElement("dt");
      term.textContent = field;
      const detail = document.createElement("dd");
      detail.textContent = value;
      return [term, detail];
    }),
  );
  readerWarnings.replaceChildren(
    ...warnings.map((warning) => {
      const item = document.createElement("li");
      item.textContent = warning;
      return item;
    }),
  );
  readerVerdict.verdict = described.auto;
  loadButton.hidden = false;
}

/** Pairs the canonical value list with its labels, keeping the list's order. */
function pairs<K extends string>(
  values: readonly K[],
  labels: Record<K, string>,
): readonly (readonly [string, string])[] {
  return values.map((value) => [value, labels[value]] as const);
}

typeSelect.options = pairs(ALL_TYPES, TYPE_LABELS);
episodeSelect.options = pairs(ALL_EPISODES, EPISODE_LABELS);
randomBoostSelect.options = [
  // `as const` or this literal infers as string[] and will not assign to a
  // [value, label] tuple.
  [NO_RANDOM_BOOST, "None"] as const,
  ...pairs(ALL_RANDOM_BOOSTS, RANDOM_BOOST_LABELS),
];
actionSelect.options = pairs(ALL_ACTIONS, ACTION_LABELS);
boostsGroup.options = pairs(ALL_BOOSTS, BOOST_LABELS);
cookiePowersGroup.options = pairs(ALL_COOKIE_POWERS, COOKIE_POWER_LABELS);

builderForm.addEventListener("input", renderBuilder);

codeInput.addEventListener("input", renderReader);

loadButton.addEventListener("click", () => {
  const { combi } = decode(codeInput.value);
  writeForm(combi);
  renderBuilder();
  typeSelect.focus();
});

renderBuilder();
renderReader();
