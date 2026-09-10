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
  type Combi,
  type CombiType,
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

import { need, renderSidebar } from "../shared/chrome.ts";

renderSidebar(need("sidebar"), "combi-name");

const typeSelect = need<HTMLSelectElement>("type");
const episodeSelect = need<HTMLSelectElement>("episode");
const boostsHost = need("boosts");
const randomBoostSelect = need<HTMLSelectElement>("randomBoost");
const cookiePowersHost = need("cookiePowers");
const actionSelect = need<HTMLSelectElement>("action");

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

function fillSelect(
  select: HTMLSelectElement,
  options: readonly (readonly [string, string])[],
): void {
  select.replaceChildren(
    ...options.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }),
  );
}

function fillChecks<K extends string>(
  host: HTMLElement,
  values: readonly K[],
  labels: Record<K, string>,
): void {
  host.replaceChildren(
    ...values.map((value) => {
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = value;

      const label = document.createElement("label");
      label.append(input, document.createTextNode(labels[value]));
      return label;
    }),
  );
}

/**
 * Filtering the canonical list rather than reading the DOM order keeps boosts
 * in slot order and cookie powers in bit order, which is what the codec expects.
 */
function checkedValues<K extends string>(
  host: HTMLElement,
  values: readonly K[],
): K[] {
  const checked = new Set(
    Array.from(
      host.querySelectorAll<HTMLInputElement>("input:checked"),
      (input) => input.value,
    ),
  );
  return values.filter((value) => checked.has(value));
}

function setChecks(host: HTMLElement, selected: readonly string[]): void {
  const wanted = new Set(selected);
  for (const input of host.querySelectorAll<HTMLInputElement>("input")) {
    input.checked = wanted.has(input.value);
  }
}

function readForm(): Combi {
  const randomBoost = randomBoostSelect.value;

  return {
    type: typeSelect.value as CombiType,
    episode: episodeSelect.value as Episode,
    boosts: checkedValues(boostsHost, ALL_BOOSTS),
    randomBoost:
      randomBoost === NO_RANDOM_BOOST ? null : (randomBoost as RandomBoost),
    cookiePowers: checkedValues(cookiePowersHost, ALL_COOKIE_POWERS),
    action: actionSelect.value as Action,
  };
}

function writeForm(combi: Combi): void {
  typeSelect.value = combi.type;
  episodeSelect.value = combi.episode;
  randomBoostSelect.value = combi.randomBoost ?? NO_RANDOM_BOOST;
  actionSelect.value = combi.action;
  setChecks(boostsHost, combi.boosts);
  setChecks(cookiePowersHost, combi.cookiePowers);
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

fillSelect(
  typeSelect,
  ALL_TYPES.map((type) => [type, TYPE_LABELS[type]] as const),
);
fillSelect(
  episodeSelect,
  ALL_EPISODES.map((episode) => [episode, EPISODE_LABELS[episode]] as const),
);
fillSelect(randomBoostSelect, [
  [NO_RANDOM_BOOST, "None"],
  ...ALL_RANDOM_BOOSTS.map(
    (boost) => [boost, RANDOM_BOOST_LABELS[boost]] as const,
  ),
]);
fillSelect(
  actionSelect,
  ALL_ACTIONS.map((action) => [action, ACTION_LABELS[action]] as const),
);
fillChecks(boostsHost, ALL_BOOSTS, BOOST_LABELS);
fillChecks(cookiePowersHost, ALL_COOKIE_POWERS, COOKIE_POWER_LABELS);

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
