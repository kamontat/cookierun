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
import { describeCombi, type AutoVerdict } from "#lib/combi-name/describe.ts";
import {
  ACTION_LABELS,
  BOOST_LABELS,
  COOKIE_POWER_LABELS,
  EPISODE_LABELS,
  RANDOM_BOOST_LABELS,
  TYPE_LABELS,
} from "#lib/combi-name/labels.ts";

import "#components/check-group.ts";
import "#components/labelled-select.ts";
import "#components/site-nav.ts";

import type { CheckGroup } from "#components/check-group.ts";
import type { LabelledSelect } from "#components/labelled-select.ts";

import { need } from "../shared/chrome.ts";

const typeSelect = need<LabelledSelect>("type");
const episodeSelect = need<LabelledSelect>("episode");
const boostsGroup = need<CheckGroup>("boosts");
const randomBoostSelect = need<LabelledSelect>("randomBoost");
const cookiePowersGroup = need<CheckGroup>("cookiePowers");
const actionSelect = need<LabelledSelect>("action");

const builderForm = need<HTMLFormElement>("builder");
const codeElement = need("code");
const copyButton = need<HTMLButtonElement>("copy");
const copyStatus = need("copy-status");
const builderVerdict = need("builder-verdict");

const codeInput = need<HTMLInputElement>("code-input");
const readerMessage = need("reader-message");
const readerRows = need<HTMLDListElement>("reader-rows");
const readerVerdict = need("reader-verdict");
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

function renderVerdict(
  host: HTMLElement,
  auto: AutoVerdict | null,
  prefix: string,
): void {
  if (auto === null) {
    host.replaceChildren();
    return;
  }

  const name = document.createElement("strong");
  name.textContent = auto.semi ? "Semi-auto" : "Full auto";

  const tail = auto.semi
    ? ` - ${auto.reasons.join(", ")} ${
        auto.reasons.length === 1 ? "needs" : "need"
      } manual work each run.`
    : " - nothing needs manual work each run.";

  host.replaceChildren(
    document.createTextNode(`${prefix} `),
    name,
    document.createTextNode(tail),
  );
}

function renderBuilder(): void {
  const code = encode(readForm());
  codeElement.textContent = code;
  setStatus(copyStatus, "");

  // Read the code back so the verdict reflects the character actually written
  // into slot 2, not the type the select still shows.
  const { combi } = decode(code);
  renderVerdict(builderVerdict, describeCombi(combi).auto, "Stored as");
}

function clearReader(): void {
  readerRows.replaceChildren();
  readerWarnings.replaceChildren();
  readerVerdict.replaceChildren();
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
  renderVerdict(readerVerdict, described.auto, "This code is");
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

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(codeElement.textContent ?? "");
    setStatus(copyStatus, "Copied.");
  } catch {
    setStatus(
      copyStatus,
      "The browser blocked the clipboard. Select the code and copy it by hand.",
      true,
    );
  }
});

codeInput.addEventListener("input", renderReader);

loadButton.addEventListener("click", () => {
  const { combi } = decode(codeInput.value);
  writeForm(combi);
  renderBuilder();
  typeSelect.focus();
});

renderBuilder();
renderReader();
