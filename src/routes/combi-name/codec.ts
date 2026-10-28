/**
 * What a run aims for. A run aims for a set of these; an empty set is an auto
 * run that specialises in nothing, while a run played by hand always aims for
 * something.
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
	/** In `ALL_GOALS` order once normalized. Empty is Any. */
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

export const VERSION = "1";

/**
 * Manual is `0` because it is auto switched off. Semi-auto is `H`, for a run
 * that needs a hand.
 */
const MODE_CHARS: Record<Mode, string> = {
	manual: "0",
	auto: "A",
	semiauto: "H",
};

/**
 * Numbered episodes are their number. The special episodes are a letter from
 * their own names: Island of Coins, Tower of Frozen Waves, Mysterious Rabbit
 * Hole, and the XP-Elixir Workshop.
 */
const EPISODE_CHARS: Record<Episode, string> = {
	any: "0",
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
 * The combinations have no letter of their own to borrow, so they run in
 * order instead — digits first, since a digit says "more than one" at a
 * glance.
 */
type SetSlot<T extends string> = {
	members: readonly { value: T; char: string }[];
	combos: Readonly<Record<string, string>>;
};

/**
 * Slot 3: every set of goals in one character. A single goal is a letter from
 * its own name and none in particular is `0`, as they were before a run could
 * aim for more than one; the pairs and triples run `1`-`9`, then `C`, since
 * `B` is the box's, and all four are `A`, as all four boosts are. Member
 * order is also `ALL_GOALS`' order.
 */
const GOAL_SLOT: SetSlot<Goal> = {
	members: [
		{ value: "score", char: "S" },
		{ value: "money", char: "M" },
		{ value: "exp", char: "E" },
		{ value: "box", char: "B" },
	],
	combos: {
		SM: "1",
		SE: "2",
		SB: "3",
		ME: "4",
		MB: "5",
		EB: "6",
		SME: "7",
		SMB: "8",
		SEB: "9",
		MEB: "C",
		SMEB: "A",
	},
};

/**
 * Slot 5: every set of boosts in one character. A single boost is its own
 * letter and all four are `A`; the pairs and triples run `1`-`9`, then `B`.
 * Member order is also `ALL_BOOSTS`' order.
 */
const BOOST_SLOT: SetSlot<Boost> = {
	members: [
		{ value: "hpExtension", char: "H" },
		{ value: "powerJellyBoost", char: "P" },
		{ value: "fastStart", char: "F" },
		{ value: "doubleXp", char: "X" },
	],
	combos: {
		HP: "1",
		HF: "2",
		HX: "3",
		PF: "4",
		PX: "5",
		FX: "6",
		HPF: "7",
		HPX: "8",
		HFX: "9",
		PFX: "B",
		HPFX: "A",
	},
};

/**
 * A letter from each boost's own name rather than a running count, so a code
 * says which boost it carries to anyone who has read this table once.
 * Collision Damage is `X` for crash: `C` and `D` were already taken.
 */
const RANDOM_BOOST_CHARS: Record<RandomBoost, string> = {
	doubleCoins: "D",
	scoreBonus: "S",
	hpDrain: "H",
	revive: "R",
	crushChance: "C",
	baseSpeed: "B",
	goldCoinMagic: "G",
	collisionDamage: "X",
	potionHp: "P",
	magneticAura: "M",
	pitLifts: "L",
};

/**
 * Slots 7-9: cookie power+, any number of them, so the seven powers are split
 * into three groups of one slot each, and each slot is a set slot of its own.
 * A run with at most one power per group reads as plain letters. Cheesecake
 * is `K`, since `C` is the cheerleader's; Sea Fairy is `W` for water, since
 * `S` and `F` are taken; Serenade of Love is `L` for love. A whole group on
 * is `A`, as all four boosts and all four goals are, so all seven powers read
 * `AAA`.
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

const ACTION_CHARS: Record<Action, string> = {
	none: "0",
	jumpAtStart: "J",
};

/**
 * `0` is "off" or "none" in every slot. A code is letters and digits only, so
 * a double-click or a word-wise selection takes the whole of it, and a code
 * read aloud or pasted into a chat has no punctuation to lose.
 */
const OFF = "0";

/** Zero-based index of each field's first character. */
const AT = {
	mode: 1,
	goal: 2,
	episode: 3,
	boosts: 4,
	randomBoost: 5,
	cookiePowers: 6,
	action: 9,
	floor: 4,
	/** The two characters a floor leaves after it, before the action. */
	floorRest: 7,
} as const;

const FLOOR_MAX = 100;
const FLOOR_DIGITS = 3;

// Derived from the tables above so the lists can never drift from the codes.
export const ALL_GOALS = GOAL_SLOT.members.map(({ value }) => value);
export const ALL_MODES = Object.keys(MODE_CHARS) as Mode[];
export const ALL_EPISODES = Object.keys(EPISODE_CHARS) as Episode[];
export const ALL_BOOSTS = BOOST_SLOT.members.map(({ value }) => value);
export const ALL_RANDOM_BOOSTS = Object.keys(
	RANDOM_BOOST_CHARS,
) as RandomBoost[];
export const ALL_COOKIE_POWERS = COOKIE_POWER_SLOTS.flatMap(({ members }) =>
	members.map(({ value }) => value),
);
export const ALL_ACTIONS = Object.keys(ACTION_CHARS) as Action[];

/** The goals an auto run can aim for, any 1-3 of them. Score is played by hand. */
export const AUTO_GOALS: readonly Goal[] = ["money", "exp", "box"];

/** The goals a run played by hand can aim for, any 1-4 of them. */
export const MANUAL_GOALS: readonly Goal[] = ALL_GOALS;

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

const MODE_BY_CHAR = invert(MODE_CHARS);
const EPISODE_BY_CHAR = invert(EPISODE_CHARS);
const ACTION_BY_CHAR = invert(ACTION_CHARS);
const RANDOM_BOOST_BY_CHAR = new Map<string, RandomBoost | null>([
	[OFF, null],
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

const GOAL_CODEC = setCodec(GOAL_SLOT);
const BOOST_CODEC = setCodec(BOOST_SLOT);
const COOKIE_POWER_CODECS = COOKIE_POWER_SLOTS.map(setCodec);

function lookup<V>(table: Map<string, V>, char: string, slot: string): V {
	if (!table.has(char)) {
		throw new Error(`slot ${slot}: unknown char "${char}"`);
	}
	return table.get(char) as V;
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
 * The mode slot stores auto vs semi-auto for readability, but the flag slots
 * are the truth. Encoding rewrites the slot so a generated code never
 * contradicts itself. A manual run is untouched — the rule does not apply.
 */
function normalizeMode(combi: Combi, forced: boolean): Mode {
	if (combi.mode === "manual") return "manual";
	return forced || isSemiAuto(combi) ? "semiauto" : "auto";
}

function encodeFloor(floor: number | null): string {
	if (floor === null) return OFF.repeat(FLOOR_DIGITS);
	if (!Number.isInteger(floor) || floor < 1 || floor > FLOOR_MAX) {
		throw new Error(`floor must be 1-${FLOOR_MAX}, got ${floor}`);
	}
	return String(floor).padStart(FLOOR_DIGITS, "0");
}

/** Slots 5-9: the floor on an episode that has one, or what a run carries. */
function encodeCarried(combi: Combi): string {
	if (limitsOf(combi.episode).floor) {
		return encodeFloor(combi.floor) + OFF.repeat(2);
	}

	return [
		BOOST_CODEC.encode(combi.boosts),
		combi.randomBoost === null ? OFF : RANDOM_BOOST_CHARS[combi.randomBoost],
		...COOKIE_POWER_CODECS.map((codec) => codec.encode(combi.cookiePowers)),
	].join("");
}

/**
 * `forcedSemiAuto` is how a caller says that something outside these ten
 * characters makes the run semi-auto — the loadout's relay cookie does, and the
 * codec does not model a loadout and must not start to. It only ever adds: a
 * combi whose own flags already force manual work is semi-auto either way.
 */
export function encode(combi: Combi, forcedSemiAuto = false): string {
	const canonical = normalize(combi);

	return [
		VERSION,
		MODE_CHARS[normalizeMode(canonical, forcedSemiAuto)],
		GOAL_CODEC.encode(canonical.goals),
		EPISODE_CHARS[canonical.episode],
		encodeCarried(canonical),
		ACTION_CHARS[canonical.action],
	].join("");
}

export const CODE_LENGTH = 10;

function decodeFloor(code: string): number | null {
	const text = code.slice(AT.floor, AT.floor + FLOOR_DIGITS);
	if (!/^[0-9]{3}$/.test(text)) {
		throw new Error(`slots 5-7 (floor): "${text}" is not 3 digits`);
	}

	const floor = Number.parseInt(text, 10);
	if (floor > FLOOR_MAX) {
		throw new Error(`slots 5-7 (floor): ${text} is above ${FLOOR_MAX}`);
	}

	const rest = code.slice(AT.floorRest, AT.action);
	if (rest !== OFF.repeat(2)) {
		throw new Error(
			`slots 8-9 (reserved on this episode): "${rest}", expected "${OFF.repeat(2)}"`,
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
			`${at + 1} (cookie power+)`,
		);
	});
}

/**
 * `forcedSemiAuto` says the same thing it says to `encode`: something outside
 * these ten characters already forces manual work. It only silences the
 * contradiction warnings, since a stored `H` that the loadout explains is not a
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

	if (code[0] !== VERSION) {
		throw new Error(`unsupported version "${code[0]}"`);
	}

	const episode = lookup(
		EPISODE_BY_CHAR,
		code[AT.episode] as string,
		"4 (episode)",
	);
	const hasFloor = limitsOf(episode).floor;

	const written: Combi = {
		goals: lookup(GOAL_CODEC.decode, code[AT.goal] as string, "3 (goal)"),
		mode: lookup(MODE_BY_CHAR, code[AT.mode] as string, "2 (mode)"),
		episode,
		floor: hasFloor ? decodeFloor(code) : null,
		boosts: hasFloor
			? []
			: lookup(BOOST_CODEC.decode, code[AT.boosts] as string, "5 (boosts)"),
		randomBoost: hasFloor
			? null
			: lookup(
					RANDOM_BOOST_BY_CHAR,
					code[AT.randomBoost] as string,
					"6 (random boost)",
				),
		cookiePowers: hasFloor ? [] : decodeCookiePowers(code),
		action: lookup(ACTION_BY_CHAR, code[AT.action] as string, "10 (action)"),
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
	const warnings: string[] = [];

	if (
		!limitsOf(combi.episode).boosts &&
		(combi.boosts.length > 0 ||
			combi.randomBoost !== null ||
			combi.cookiePowers.length > 0)
	) {
		warnings.push(
			"this episode takes no boosts, random boost, or cookie power+ — ignoring them",
		);
	}

	if (combi.mode === "manual" && combi.action !== "none") {
		warnings.push(
			"slot 10 sets an action but the run is played by hand — ignoring it",
		);
	}

	return warnings;
}

function goalWarnings(combi: Combi): string[] {
	if (combi.mode === "manual") {
		if (combi.goals.length > 0) return [];
		return [
			"slot 3 says Any but a run played by hand aims for Score, Money, Exp, or Box",
		];
	}
	if (combi.goals.every((goal) => AUTO_GOALS.includes(goal))) return [];
	return [
		"slot 3 says Score but an auto run aims for Money, Exp, or Box — Score is played by hand",
	];
}

/**
 * A stored mode slot can disagree with the flag slots when a code is typed by
 * hand. That is a soft problem: decoding still succeeds, `combi.mode` keeps
 * what the code actually says, and `isSemiAuto` remains the authority.
 */
function modeWarnings(combi: Combi, forced: boolean): string[] {
	const semi = isSemiAuto(combi);

	// Whatever forces manual work from outside these ten characters is the
	// caller's to explain: it knows what the reason is called, and this file
	// deliberately does not.
	if (forced) return [];

	if (combi.mode === "auto" && semi) {
		return [
			"slot 2 says Auto but Fast Start, a random boost, or an action is present — treating as Semi-auto",
		];
	}

	if (combi.mode === "semiauto" && !semi) {
		return [
			"slot 2 says Semi-auto but there is no Fast Start, random boost, or action",
		];
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
