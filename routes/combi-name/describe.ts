import { isSemiAuto, type Combi } from "./codec.ts";
import {
  ACTION_LABELS,
  BOOST_LABELS,
  COOKIE_POWER_LABELS,
  EPISODE_LABELS,
  RANDOM_BOOST_LABELS,
  TYPE_LABELS,
} from "./labels.ts";

export type DescribedRow = {
  field: string;
  value: string;
};

export type AutoVerdict = {
  semi: boolean;
  /** What forces manual work each run. Empty when the combi is full auto. */
  reasons: string[];
};

export type DescribedCombi = {
  rows: DescribedRow[];
  /** Null for the hand-played types, where auto vs semi-auto means nothing. */
  auto: AutoVerdict | null;
};

const NONE = "None";

function list(values: string[]): string {
  return values.length === 0 ? NONE : values.join(", ");
}

function verdict(combi: Combi): AutoVerdict | null {
  if (combi.type !== "auto" && combi.type !== "semiauto") return null;

  const reasons: string[] = [];
  if (combi.boosts.includes("fastStart")) reasons.push(BOOST_LABELS.fastStart);
  if (combi.randomBoost !== null) {
    reasons.push(RANDOM_BOOST_LABELS[combi.randomBoost]);
  }
  if (combi.action !== "none") reasons.push(ACTION_LABELS[combi.action]);

  return { semi: isSemiAuto(combi), reasons };
}

export function describeCombi(combi: Combi): DescribedCombi {
  return {
    rows: [
      { field: "Type", value: TYPE_LABELS[combi.type] },
      { field: "Episode", value: EPISODE_LABELS[combi.episode] },
      {
        field: "Boosts",
        value: list(combi.boosts.map((boost) => BOOST_LABELS[boost])),
      },
      {
        field: "Random boost",
        value:
          combi.randomBoost === null
            ? NONE
            : RANDOM_BOOST_LABELS[combi.randomBoost],
      },
      {
        field: "Cookie power+",
        value: list(
          combi.cookiePowers.map((power) => COOKIE_POWER_LABELS[power]),
        ),
      },
      { field: "Action", value: ACTION_LABELS[combi.action] },
    ],
    auto: verdict(combi),
  };
}
