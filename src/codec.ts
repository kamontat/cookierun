export type CombiType = "score" | "money" | "exp" | "box" | "auto" | "semiauto";

export type Episode =
  | "any"
  | "episode1"
  | "episode2"
  | "episode3"
  | "episode4"
  | "episode5"
  | "episode6"
  | "episode7"
  | "special1"
  | "special2"
  | "special3"
  | "specialExp";

export type Boost = "hpExtension" | "powerJellyBoost" | "fastStart";

export type RandomBoost =
  | "doubleCoins"
  | "scoreBonus"
  | "hpDrain"
  | "revive"
  | "crushChance"
  | "baseSpeed"
  | "goldCoinMagic"
  | "collisionDamage"
  | "potionHp"
  | "magneticAura"
  | "pitLifts";

export type CookiePower =
  | "cheerleader"
  | "specialForce"
  | "fairy"
  | "cheesecake"
  | "seaFairy"
  | "serenadeOfLove"
  | "expParty";

export type Action = "none" | "jumpAtStart";

export type Combi = {
  type: CombiType;
  episode: Episode;
  boosts: Boost[];
  randomBoost: RandomBoost | null;
  cookiePowers: CookiePower[];
  action: Action;
};

export const VERSION = "1";

const TYPE_CHARS: Record<CombiType, string> = {
  score: "S",
  money: "M",
  exp: "E",
  box: "B",
  auto: "A",
  semiauto: "H",
};

const EPISODE_CHARS: Record<Episode, string> = {
  any: "0",
  episode1: "1",
  episode2: "2",
  episode3: "3",
  episode4: "4",
  episode5: "5",
  episode6: "6",
  episode7: "7",
  special1: "A",
  special2: "B",
  special3: "C",
  specialExp: "X",
};

/** Slot order for the three boost flag slots (4, 5, 6). */
const BOOST_SLOTS: { boost: Boost; char: string; label: string }[] = [
  { boost: "hpExtension", char: "H", label: "HP Extension" },
  { boost: "powerJellyBoost", char: "P", label: "Power Jelly Boost" },
  { boost: "fastStart", char: "F", label: "Fast Start" },
];

const RANDOM_BOOST_CHARS: Record<RandomBoost, string> = {
  doubleCoins: "1",
  scoreBonus: "2",
  hpDrain: "3",
  revive: "4",
  crushChance: "5",
  baseSpeed: "6",
  goldCoinMagic: "7",
  collisionDamage: "8",
  potionHp: "9",
  magneticAura: "A",
  pitLifts: "B",
};

const COOKIE_POWER_BITS: Record<CookiePower, number> = {
  cheerleader: 1,
  specialForce: 2,
  fairy: 4,
  cheesecake: 8,
  seaFairy: 16,
  serenadeOfLove: 32,
  expParty: 64,
};

const ACTION_CHARS: Record<Action, string> = {
  none: "-",
  jumpAtStart: "J",
};

const OFF = "-";

// Derived from the tables above so the lists can never drift from the codes.
export const ALL_TYPES = Object.keys(TYPE_CHARS) as CombiType[];
export const ALL_EPISODES = Object.keys(EPISODE_CHARS) as Episode[];
export const ALL_BOOSTS = BOOST_SLOTS.map(({ boost }) => boost);
export const ALL_RANDOM_BOOSTS = Object.keys(
  RANDOM_BOOST_CHARS,
) as RandomBoost[];
export const ALL_COOKIE_POWERS = Object.keys(
  COOKIE_POWER_BITS,
) as CookiePower[];
export const ALL_ACTIONS = Object.keys(ACTION_CHARS) as Action[];

/** Boost display names, shared by decode error messages and the UI. */
export const BOOST_LABELS = Object.fromEntries(
  BOOST_SLOTS.map(({ boost, label }) => [boost, label]),
) as Record<Boost, string>;

export type DecodeResult = {
  combi: Combi;
  warnings: string[];
};

function invert<K extends string>(table: Record<K, string>): Map<string, K> {
  return new Map(
    (Object.entries(table) as [K, string][]).map(([key, char]) => [char, key]),
  );
}

const TYPE_BY_CHAR = invert(TYPE_CHARS);
const EPISODE_BY_CHAR = invert(EPISODE_CHARS);
const ACTION_BY_CHAR = invert(ACTION_CHARS);
const RANDOM_BOOST_BY_CHAR = new Map<string, RandomBoost | null>([
  ["0", null],
  ...invert(RANDOM_BOOST_CHARS),
]);

function lookup<V>(table: Map<string, V>, char: string, slot: string): V {
  if (!table.has(char)) {
    throw new Error(`slot ${slot}: unknown char "${char}"`);
  }
  return table.get(char) as V;
}

/**
 * The type slot stores auto vs semi-auto for readability, but the flag slots
 * are the truth. Encoding rewrites the slot so a generated code never
 * contradicts itself. Non-auto types are untouched — the rule does not apply.
 */
function normalizeType(combi: Combi): CombiType {
  if (combi.type !== "auto" && combi.type !== "semiauto") return combi.type;
  return isSemiAuto(combi) ? "semiauto" : "auto";
}

export function encode(combi: Combi): string {
  const boostSlots = BOOST_SLOTS.map(({ boost, char }) =>
    combi.boosts.includes(boost) ? char : OFF,
  ).join("");

  const cookieMask = combi.cookiePowers.reduce(
    (mask, power) => mask | COOKIE_POWER_BITS[power],
    0,
  );

  return [
    VERSION,
    TYPE_CHARS[normalizeType(combi)],
    EPISODE_CHARS[combi.episode],
    boostSlots,
    combi.randomBoost === null ? "0" : RANDOM_BOOST_CHARS[combi.randomBoost],
    cookieMask.toString(16).toUpperCase().padStart(2, "0"),
    ACTION_CHARS[combi.action],
  ].join("");
}

export const CODE_LENGTH = 10;

const COOKIE_MASK_MAX = 0x7f;

function decodeBoosts(code: string): Boost[] {
  const boosts: Boost[] = [];

  BOOST_SLOTS.forEach(({ boost, char, label }, index) => {
    const slotChar = code[3 + index];
    if (slotChar === char) {
      boosts.push(boost);
    } else if (slotChar !== OFF) {
      throw new Error(
        `slot ${4 + index} (${label}): unknown char "${slotChar}", expected "${char}" or "${OFF}"`,
      );
    }
  });

  return boosts;
}

function decodeCookiePowers(code: string): CookiePower[] {
  const maskText = code.slice(7, 9);

  if (!/^[0-9A-F]{2}$/.test(maskText)) {
    throw new Error(
      `slots 8-9 (cookie power+): "${maskText}" is not 2 uppercase hex digits`,
    );
  }

  const mask = Number.parseInt(maskText, 16);
  if (mask > COOKIE_MASK_MAX) {
    throw new Error(
      `slots 8-9 (cookie power+): mask ${maskText} exceeds 7F`,
    );
  }

  return (Object.entries(COOKIE_POWER_BITS) as [CookiePower, number][])
    .filter(([, bit]) => (mask & bit) !== 0)
    .map(([power]) => power);
}

export function decode(code: string): DecodeResult {
  if (code.length !== CODE_LENGTH) {
    throw new Error(
      `code must be exactly ${CODE_LENGTH} characters, got ${code.length}: "${code}"`,
    );
  }

  if (code[0] !== VERSION) {
    throw new Error(`unsupported version "${code[0]}"`);
  }

  const combi: Combi = {
    type: lookup(TYPE_BY_CHAR, code[1] as string, "2 (type)"),
    episode: lookup(EPISODE_BY_CHAR, code[2] as string, "3 (episode)"),
    boosts: decodeBoosts(code),
    randomBoost: lookup(
      RANDOM_BOOST_BY_CHAR,
      code[6] as string,
      "7 (random boost)",
    ),
    cookiePowers: decodeCookiePowers(code),
    action: lookup(ACTION_BY_CHAR, code[9] as string, "10 (action)"),
  };

  return { combi, warnings: typeWarnings(combi) };
}

/**
 * A stored type slot can disagree with the flag slots when a code is typed by
 * hand. That is a soft problem: decoding still succeeds, `combi.type` keeps
 * what the code actually says, and `isSemiAuto` remains the authority.
 */
function typeWarnings(combi: Combi): string[] {
  const semi = isSemiAuto(combi);

  if (combi.type === "auto" && semi) {
    return [
      "slot 2 says Auto but Fast Start, a random boost, or an action is present — treating as Semi-auto",
    ];
  }

  if (combi.type === "semiauto" && !semi) {
    return [
      "slot 2 says Semi-auto but there is no Fast Start, random boost, or action",
    ];
  }

  return [];
}

/**
 * Semi-auto is derived, never trusted from the stored type slot:
 * Fast Start OR any random boost OR a jump action means manual work per run.
 */
export function isSemiAuto(combi: Combi): boolean {
  return (
    combi.boosts.includes("fastStart") ||
    combi.randomBoost !== null ||
    combi.action !== "none"
  );
}
