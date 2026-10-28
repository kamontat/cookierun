/**
 * What a run aims for. A run aims for a set of these: Score alone, or 1-3 of
 * the other three — `GOAL_CHARS` lists every set a code can say.
 */
export type Goal = "score" | "money" | "exp" | "box";

/**
 * Who plays the run. Semi-auto is never picked: it is what an auto run becomes
 * once something in it needs a hand, and `encode` derives it.
 */
export type Mode = "manual" | "auto" | "semiauto";

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

export type Boost =
	| "hpExtension"
	| "powerJellyBoost"
	| "fastStart"
	| "doubleXp";

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
	/** In `ALL_GOALS` order once normalized; one of `GOAL_CHARS`' sets. */
	goals: Goal[];
	mode: Mode;
	episode: Episode;
	/** The tower floor, on Special Episode 2 only. Null is any floor. */
	floor: number | null;
	boosts: Boost[];
	randomBoost: RandomBoost | null;
	cookiePowers: CookiePower[];
	action: Action;
};

/**
 * Slot 1: who plays the run, a letter from its name. A jump at the start is
 * one more thing a hand does, so it has no slot of its own: `J` is a
 * semi-auto run that jumps, and a manual run never jumps.
 */
const MODE_CHARS: Record<Mode, string> = {
	manual: "M",
	auto: "A",
	semiauto: "S",
};

/** Slot 1 for a semi-auto run that jumps at the start. */
const JUMP_CHAR = "J";

/**
 * Slots 2-3: the goals, two characters for the few sets a run aims for. A
 * single goal is a letter from its name — Exp is `X`, for eXp — padded with
 * `0`; a pair is its two letters; all three of Money, Exp and Box is `AA`.
 * Score is played for on its own, so no set holds it beside another.
 *
 * Keys are the members in `ALL_GOALS` order, and that order is also the one
 * `ALL_GOALS` reads in.
 */
const GOAL_CHARS: Readonly<Record<string, string>> = {
	score: "S0",
	money: "M0",
	exp: "X0",
	box: "B0",
	"money exp": "MX",
	"money box": "MB",
	"exp box": "XB",
	"money exp box": "AA",
};

/**
 * Slot 4. Numbered episodes are their number. The special episodes are a
 * letter from their own names: Island of Coins, Tower of Frozen Waves,
 * Mysterious Rabbit Hole, and the XP-Elixir Workshop. Any is `A`.
 */
const EPISODE_CHARS: Record<Episode, string> = {
	any: "A",
	episode1: "1",
	episode2: "2",
	episode3: "3",
	episode4: "4",
	episode5: "5",
	episode6: "6",
	episode7: "7",
	special1: "C",
	special2: "T",
	special3: "R",
	specialExp: "X",
};

/**
 * One slot holding any set of a few values. A value on its own is its own
 * letter and no value is `0`; every combination of two or more takes a
 * character from `combos`, keyed by its members' letters in `members` order.
 */
type SetSlot<T extends string> = {
	members: readonly { value: T; char: string }[];
	combos: Readonly<Record<string, string>>;
};

/**
 * Slot 5: every set of boosts in one character. A single boost is its own
 * letter and all four are `A`. HP Extension and Power Jelly, the pair most
 * runs take, is `2`, and with Double XP `3`; the other pairs and triples take
 * the characters left, in order. Member order is also `ALL_BOOSTS`' order.
 */
const BOOST_SLOT: SetSlot<Boost> = {
	members: [
		{ value: "hpExtension", char: "H" },
		{ value: "powerJellyBoost", char: "P" },
		{ value: "fastStart", char: "F" },
		{ value: "doubleXp", char: "X" },
	],
	combos: {
		HP: "2",
		HPX: "3",
		HF: "1",
		HX: "4",
		PF: "5",
		PX: "6",
		FX: "7",
		HPF: "8",
		HFX: "9",
		PFX: "B",
		HPFX: "A",
	},
};

/**
 * Slots 6-7: two characters from each boost's own name, or its number where
 * it has one — Double Coins is `2C` and +17% Base Speed `17`. No random boost
 * is `00`.
 */
const RANDOM_BOOST_CHARS: Record<RandomBoost, string> = {
	doubleCoins: "2C",
	scoreBonus: "BS",
	hpDrain: "HD",
	revive: "RV",
	crushChance: "CC",
	baseSpeed: "17",
	goldCoinMagic: "GC",
	collisionDamage: "CO",
	potionHp: "PO",
	magneticAura: "MA",
	pitLifts: "PL",
};

/**
 * Slots 8-10: cookie power+, any number of them, so the seven powers are split
 * into three groups of one slot each, and each slot is a set slot of its own.
 * A run with at most one power per group reads as plain letters. Cheesecake
 * is `K`, since `C` is the cheerleader's; Sea Fairy is `W` for water, since
 * `S` and `F` are taken; Serenade of Love is `L` for love. A whole group on
 * is `A`, as all four boosts are, so all seven powers read `AAA`.
 */
const COOKIE_POWER_SLOTS: readonly SetSlot<CookiePower>[] = [
	{
		members: [
			{ value: "cheerleader", char: "C" },
			{ value: "specialForce", char: "S" },
			{ value: "fairy", char: "F" },
		],
		combos: { CS: "1", CF: "2", SF: "3", CSF: "A" },
	},
	{
		members: [
			{ value: "cheesecake", char: "K" },
			{ value: "seaFairy", char: "W" },
		],
		combos: { KW: "A" },
	},
	{
		members: [
			{ value: "serenadeOfLove", char: "L" },
			{ value: "expParty", char: "E" },
		],
		combos: { LE: "A" },
	},
];

/**
 * `0` is "off" or "none" wherever a slot can be off. A code is letters and
 * digits only, so a double-click or a word-wise selection takes the whole of
 * it, and a code read aloud or pasted into a chat has no punctuation to lose.
 */
const OFF = "0";

/** Zero-based index of each field's first character. */
const AT = {
	mode: 0,
	goal: 1,
	episode: 3,
	boosts: 4,
	randomBoost: 5,
	cookiePowers: 7,
	floor: 4,
	/** The three characters a floor leaves after it, to the end of the code. */
	floorRest: 7,
} as const;

const GOAL_WIDTH = 2;
const RANDOM_BOOST_WIDTH = 2;
const FLOOR_MAX = 100;
const FLOOR_DIGITS = 3;

/**
 * The game's combi name field takes this many. There is no version character
 * here: the format version is the full code's, the first character before the
 * `-`, and these ten are only ever read as the version that page writes.
 */
export const CODE_LENGTH = 10;

// Derived from the tables above so the lists can never drift from the codes.
export const ALL_GOALS: readonly Goal[] = ["score", "money", "exp", "box"];
/** Every set of goals a code can say, each in `ALL_GOALS` order. */
export const ALL_GOAL_SETS = Object.keys(GOAL_CHARS).map(
	(key) => key.split(" ") as Goal[],
);
export const ALL_MODES = Object.keys(MODE_CHARS) as Mode[];
export const ALL_EPISODES = Object.keys(EPISODE_CHARS) as Episode[];
export const ALL_BOOSTS = BOOST_SLOT.members.map(({ value }) => value);
export const ALL_RANDOM_BOOSTS = Object.keys(
	RANDOM_BOOST_CHARS,
) as RandomBoost[];
export const ALL_COOKIE_POWERS = COOKIE_POWER_SLOTS.flatMap(({ members }) =>
	members.map(({ value }) => value),
);
export const ALL_ACTIONS: readonly Action[] = ["none", "jumpAtStart"];

/** The goals an auto run can aim for, any 1-3 of them. Score is played by hand. */
export const AUTO_GOALS: readonly Goal[] = ["money", "exp", "box"];

/**
 * The goals a run played by hand can aim for: Score on its own, or any 1-3
 * of the other three.
 */
export const MANUAL_GOALS: readonly Goal[] = ALL_GOALS;

/** The one goal that stands alone: picking it is picking nothing else. */
export const SOLO_GOAL: Goal = "score";

/**
 * What an episode lets a run carry. `boosts` covers the boost slot, the random
 * boost and cookie power+ together; `relay` and `treasures` are the loadout's,
 * which the codec does not model but is the one place that knows an episode.
 */
export type EpisodeLimits = {
	boosts: boolean;
	relay: boolean;
	treasures: boolean;
	floor: boolean;
};

const EVERYTHING: EpisodeLimits = {
	boosts: true,
	relay: true,
	treasures: true,
	floor: false,
};

const EPISODE_LIMITS: Partial<Record<Episode, EpisodeLimits>> = {
	special1: { boosts: false, relay: false, treasures: true, floor: false },
	special2: { boosts: false, relay: false, treasures: true, floor: true },
	specialExp: { boosts: false, relay: false, treasures: false, floor: false },
};

export function limitsOf(episode: Episode): EpisodeLimits {
	return EPISODE_LIMITS[episode] ?? EVERYTHING;
}

export type DecodeResult = {
	combi: Combi;
	warnings: string[];
};

function invert<K extends string>(table: Record<K, string>): Map<string, K> {
	return new Map(
		(Object.entries(table) as [K, string][]).map(([key, char]) => [char, key]),
	);
}

const MODE_BY_CHAR = new Map<string, { mode: Mode; action: Action }>([
	...[...invert(MODE_CHARS)].map(
		([char, mode]) => [char, { mode, action: "none" as Action }] as const,
	),
	[JUMP_CHAR, { mode: "semiauto", action: "jumpAtStart" }],
]);
const GOALS_BY_CHARS = new Map(
	Object.entries(GOAL_CHARS).map(([key, chars]) => [
		chars,
		key.split(" ") as Goal[],
	]),
);
const EPISODE_BY_CHAR = invert(EPISODE_CHARS);
const RANDOM_BOOST_BY_CHARS = new Map<string, RandomBoost | null>([
	[OFF.repeat(RANDOM_BOOST_WIDTH), null],
	...invert(RANDOM_BOOST_CHARS),
]);

/** The character for a set, and each character back to its set. */
type SetCodec<T extends string> = {
	encode: (picked: readonly T[]) => string;
	decode: Map<string, T[]>;
};

function setCodec<T extends string>({
	members,
	combos,
}: SetSlot<T>): SetCodec<T> {
	const table: Record<string, string> = { "": OFF, ...combos };
	for (const { char } of members) table[char] = char;

	const decode = new Map<string, T[]>(
		Object.entries(table).map(([letters, char]) => [
			char,
			members
				.filter(({ char: letter }) => letters.includes(letter))
				.map(({ value }) => value),
		]),
	);

	return {
		encode: (picked) =>
			table[
				members
					.filter(({ value }) => picked.includes(value))
					.map(({ char }) => char)
					.join("")
			] as string,
		decode,
	};
}

const BOOST_CODEC = setCodec(BOOST_SLOT);
const COOKIE_POWER_CODECS = COOKIE_POWER_SLOTS.map(setCodec);

function lookup<V>(table: Map<string, V>, chars: string, slot: string): V {
	if (!table.has(chars)) {
		const noun = chars.length === 1 ? "char" : "chars";
		throw new Error(`${slot}: unknown ${noun} "${chars}"`);
	}
	return table.get(chars) as V;
}

/** Table order, whatever order the caller listed them in. */
function inOrder<T>(all: readonly T[], picked: readonly T[]): T[] {
	return all.filter((value) => picked.includes(value));
}

/**
 * The combi as a code can say it: whatever the episode or the mode leaves no
 * room for is dropped, and lists are put in table order. The mode is left
 * exactly as given — whether an auto run is semi-auto is `encode`'s to derive
 * and `decode`'s to report, not this function's to correct.
 */
export function normalize(combi: Combi): Combi {
	const limits = limitsOf(combi.episode);
	return {
		...combi,
		goals: inOrder(ALL_GOALS, combi.goals),
		floor: limits.floor ? combi.floor : null,
		boosts: limits.boosts ? inOrder(ALL_BOOSTS, combi.boosts) : [],
		randomBoost: limits.boosts ? combi.randomBoost : null,
		cookiePowers: limits.boosts
			? inOrder(ALL_COOKIE_POWERS, combi.cookiePowers)
			: [],
		action: combi.mode === "manual" ? "none" : combi.action,
	};
}

/**
 * Slot 1. The mode slot stores auto vs semi-auto for readability, but the
 * flag slots are the truth, so encoding writes it from them and a generated
 * code never contradicts itself. A manual run is untouched — the rule does not
 * apply — and a jump says `J`, which is already semi-auto.
 */
function encodeMode(combi: Combi, forced: boolean): string {
	if (combi.mode === "manual") return MODE_CHARS.manual;
	if (combi.action === "jumpAtStart") return JUMP_CHAR;
	return MODE_CHARS[forced || isSemiAuto(combi) ? "semiauto" : "auto"];
}

function encodeGoals(goals: readonly Goal[]): string {
	const chars = GOAL_CHARS[goals.join(" ")];
	if (chars === undefined) {
		throw new Error(
			`goals must be Score alone or 1-3 of Money, Exp and Box, got [${goals.join(", ")}]`,
		);
	}
	return chars;
}

function encodeFloor(floor: number | null): string {
	if (floor === null) return OFF.repeat(FLOOR_DIGITS);
	if (!Number.isInteger(floor) || floor < 1 || floor > FLOOR_MAX) {
		throw new Error(`floor must be 1-${FLOOR_MAX}, got ${floor}`);
	}
	return String(floor).padStart(FLOOR_DIGITS, "0");
}

/** Slots 5-10: the floor on an episode that has one, or what a run carries. */
function encodeCarried(combi: Combi): string {
	if (limitsOf(combi.episode).floor) {
		return encodeFloor(combi.floor) + OFF.repeat(CODE_LENGTH - AT.floorRest);
	}

	return [
		BOOST_CODEC.encode(combi.boosts),
		combi.randomBoost === null
			? OFF.repeat(RANDOM_BOOST_WIDTH)
			: RANDOM_BOOST_CHARS[combi.randomBoost],
		...COOKIE_POWER_CODECS.map((codec) => codec.encode(combi.cookiePowers)),
	].join("");
}

/**
 * `forcedSemiAuto` is how a caller says that something outside these ten
 * characters makes the run semi-auto — the loadout's relay cookie does, and the
 * codec does not model a loadout and must not start to. It only ever adds: a
 * combi whose own flags already force manual work is semi-auto either way.
 *
 * Throws on a set of goals no code can say: Score beside another goal, or
 * none at all.
 */
export function encode(combi: Combi, forcedSemiAuto = false): string {
	const canonical = normalize(combi);

	return [
		encodeMode(canonical, forcedSemiAuto),
		encodeGoals(canonical.goals),
		EPISODE_CHARS[canonical.episode],
		encodeCarried(canonical),
	].join("");
}

function decodeFloor(code: string): number | null {
	const text = code.slice(AT.floor, AT.floor + FLOOR_DIGITS);
	if (!/^[0-9]{3}$/.test(text)) {
		throw new Error(`slots 5-7 (floor): "${text}" is not 3 digits`);
	}

	const floor = Number.parseInt(text, 10);
	if (floor > FLOOR_MAX) {
		throw new Error(`slots 5-7 (floor): ${text} is above ${FLOOR_MAX}`);
	}

	const rest = code.slice(AT.floorRest);
	const expected = OFF.repeat(CODE_LENGTH - AT.floorRest);
	if (rest !== expected) {
		throw new Error(
			`slots 8-10 (reserved on this episode): "${rest}", expected "${expected}"`,
		);
	}

	return floor === 0 ? null : floor;
}

function decodeCookiePowers(code: string): CookiePower[] {
	return COOKIE_POWER_CODECS.flatMap((codec, index) => {
		const at = AT.cookiePowers + index;
		return lookup(
			codec.decode,
			code[at] as string,
			`slot ${at + 1} (cookie power+)`,
		);
	});
}

/**
 * `forcedSemiAuto` says the same thing it says to `encode`: something outside
 * these ten characters already forces manual work. It only silences the
 * contradiction warnings, since a stored `S` that the loadout explains is not a
 * contradiction — and the caller that knows about the loadout says so itself.
 *
 * What the episode or the mode leaves no room for is dropped with a warning
 * rather than refused: a hand-typed code may carry it, and the rest of that
 * code still says something worth reading.
 */
export function decode(code: string, forcedSemiAuto = false): DecodeResult {
	if (code.length !== CODE_LENGTH) {
		throw new Error(
			`code must be exactly ${CODE_LENGTH} characters, got ${code.length}: "${code}"`,
		);
	}

	// Slot 1 first, so a code in some other layout is refused by its first
	// character rather than by whichever slot happened to be read first.
	const { mode, action } = lookup(
		MODE_BY_CHAR,
		code[AT.mode] as string,
		"slot 1 (mode)",
	);
	const episode = lookup(
		EPISODE_BY_CHAR,
		code[AT.episode] as string,
		"slot 4 (episode)",
	);
	const hasFloor = limitsOf(episode).floor;

	const written: Combi = {
		goals: lookup(
			GOALS_BY_CHARS,
			code.slice(AT.goal, AT.goal + GOAL_WIDTH),
			"slots 2-3 (goal)",
		),
		mode,
		episode,
		floor: hasFloor ? decodeFloor(code) : null,
		boosts: hasFloor
			? []
			: lookup(
					BOOST_CODEC.decode,
					code[AT.boosts] as string,
					"slot 5 (boosts)",
				),
		randomBoost: hasFloor
			? null
			: lookup(
					RANDOM_BOOST_BY_CHARS,
					code.slice(AT.randomBoost, AT.randomBoost + RANDOM_BOOST_WIDTH),
					"slots 6-7 (random boost)",
				),
		cookiePowers: hasFloor ? [] : decodeCookiePowers(code),
		action,
	};

	const combi = normalize(written);

	return {
		combi,
		warnings: [
			...droppedWarnings(written),
			...goalWarnings(combi),
			...modeWarnings(combi, forcedSemiAuto),
		],
	};
}

/** What `normalize` is about to drop from a code as written. */
function droppedWarnings(combi: Combi): string[] {
	if (
		!limitsOf(combi.episode).boosts &&
		(combi.boosts.length > 0 ||
			combi.randomBoost !== null ||
			combi.cookiePowers.length > 0)
	) {
		return [
			"this episode takes no boosts, random boost, or cookie power+ — ignoring them",
		];
	}
	return [];
}

function goalWarnings(combi: Combi): string[] {
	if (combi.mode === "manual") return [];
	if (combi.goals.every((goal) => AUTO_GOALS.includes(goal))) return [];
	return [
		"slots 2-3 say Score but an auto run aims for Money, Exp, or Box — Score is played by hand",
	];
}

/**
 * A stored mode slot can disagree with the flag slots when a code is typed by
 * hand. That is a soft problem: decoding still succeeds, `combi.mode` keeps
 * what the code actually says, and `isSemiAuto` remains the authority. `J`
 * cannot disagree: the jump it carries is a reason of its own.
 */
function modeWarnings(combi: Combi, forced: boolean): string[] {
	const semi = isSemiAuto(combi);

	// Whatever forces manual work from outside these ten characters is the
	// caller's to explain: it knows what the reason is called, and this file
	// deliberately does not.
	if (forced) return [];

	if (combi.mode === "auto" && semi) {
		return [
			"slot 1 says Auto but Fast Start or a random boost is present — treating as Semi-auto",
		];
	}

	if (combi.mode === "semiauto" && !semi) {
		return ["slot 1 says Semi-auto but there is no Fast Start or random boost"];
	}

	return [];
}

/**
 * Semi-auto is derived, never trusted from the stored mode slot:
 * Fast Start OR any random boost OR a jump action means manual work per run.
 */
export function isSemiAuto(combi: Combi): boolean {
	return (
		combi.boosts.includes("fastStart") ||
		combi.randomBoost !== null ||
		combi.action !== "none"
	);
}

/** Whether a run is auto at all, semi-auto or not. */
export function isAutoMode(mode: Mode): boolean {
	return mode !== "manual";
}
