/**
 * The loadout section: the cookie, relay, pet and treasure slots the game
 * already stores in a combi, carried so a whole build fits in one code.
 *
 * It is the left half of `loadout-combi`, variable length, and lives outside
 * the game's ten-character combi name — which is why it can afford tags and
 * separators the combi section cannot. Its separators are `_` and `.`, which a
 * word-wise selection reads as part of the word, so the whole loadout selects
 * as one; only the `-` before the combi breaks it.
 *
 *     1C2LR0BP1ZTU0FZ02_0FZ59_0RB3.0QQ9
 *     │└cookie      │ └ treasures: slot 1 accepts 0FZ at +0-2 or +5-9, or 0RB
 *     │  └relay     └pet            at +3; slot 2 wants 0QQ at +9
 *     └ this section's own version, independent of the combi section's
 *
 * Encoding canonicalizes — ids sorted within a slot, slots sorted when order
 * does not matter — so one build has exactly one code. Decoding accepts a
 * non-canonical code as written.
 */

import { type CatalogSection, hasId, ID_WIDTH, isAnyId } from "./catalog";

/** One acceptable treasure, and the upgrade levels it is accepted at. */
export type TreasurePick = {
	id: string;
	/** Accepted levels, each 0 to `MAX_LEVEL`. Never empty. */
	levels: number[];
};

export type Loadout = {
	/** Catalog id, or null when unset. */
	cookie: string | null;
	relay: string | null;
	pet: string | null;
	/** 0-3 slots, each holding one or more acceptable treasures. */
	treasures: TreasurePick[][];
	/** Whether slot position matters. Meaningless with fewer than two slots. */
	ordered: boolean;
};

export const LOADOUT_VERSION = "1";
export const MAX_TREASURE_SLOTS = 3;

/** A treasure runs from +0, not upgraded, to +9. */
export const MAX_LEVEL = 9;

/** A pick at the given levels; +0 alone by default. */
export function treasurePick(
	id: string,
	levels: readonly number[] = [0],
): TreasurePick {
	return { id, levels: [...levels] };
}

/** Every level from `min` to `max`, inclusive; empty when `max` is below `min`. */
export function levelRange(min: number, max = min): number[] {
	const levels: number[] = [];
	for (let level = min; level <= max; level++) levels.push(level);
	return levels;
}

/**
 * A level set as its maximal runs of consecutive levels, lowest first —
 * `[0, 1, 2, 5]` is `[[0, 2], [5, 5]]`. Each run is one copy on the wire and
 * one `+min-max` in prose.
 */
export function levelRuns(levels: readonly number[]): [number, number][] {
	const runs: [number, number][] = [];
	for (const level of [...new Set(levels)].sort((a, b) => a - b)) {
		const last = runs.at(-1);
		if (last !== undefined && level === last[1] + 1) last[1] = level;
		else runs.push([level, level]);
	}
	return runs;
}

/** A factory rather than a shared constant: the default must not be mutable. */
export function emptyLoadout(): Loadout {
	return {
		cookie: null,
		relay: null,
		pet: null,
		treasures: [],
		ordered: false,
	};
}

export function isEmptyLoadout(loadout: Loadout): boolean {
	return (
		loadout.cookie === null &&
		loadout.relay === null &&
		loadout.pet === null &&
		loadout.treasures.length === 0
	);
}

type SingleGroup = {
	tag: "C" | "R" | "P";
	section: CatalogSection;
	noun: string;
	field: "cookie" | "relay" | "pet";
	width: number;
};

/** Group order is the wire format: a loadout always reads C, R, P, T. */
const SINGLE_GROUPS: SingleGroup[] = [
	{
		tag: "C",
		section: "cookies",
		noun: "cookie",
		field: "cookie",
		width: ID_WIDTH.cookies,
	},
	{
		tag: "R",
		section: "cookies",
		noun: "cookie",
		field: "relay",
		width: ID_WIDTH.cookies,
	},
	{
		tag: "P",
		section: "pets",
		noun: "pet",
		field: "pet",
		width: ID_WIDTH.pets,
	},
];

const TREASURE_WIDTH = ID_WIDTH.treasures;
const TAG_ORDER = ["C", "R", "P", "T"];
/** Between two treasure slots. */
const SLOT_SEPARATOR = ".";
/** Between two acceptable treasures within one slot. */
const ALTERNATIVE_SEPARATOR = "_";

function fail(tag: string, detail: string): never {
	throw new Error(`loadout group "${tag}": ${detail}`);
}

/**
 * One copy of the id per run of levels, lowest first: the bare id for a run of
 * only +0, one digit for a one-level run, two for a longer one.
 */
function writePick({ id, levels }: TreasurePick): string {
	return levelRuns(levels)
		.map(([min, max]) => {
			if (min !== max) return `${id}${min}${max}`;
			return min === 0 ? id : `${id}${min}`;
		})
		.join(ALTERNATIVE_SEPARATOR);
}

/** One copy off the wire: its id and the run of levels its digits name. */
function readCopy(text: string): TreasurePick {
	const id = text.slice(0, TREASURE_WIDTH);
	const level = text.slice(TREASURE_WIDTH);
	if (!/^[0-9]{0,2}$/.test(level)) {
		fail("T", `"${text}" has level "${level}", expected at most two digits`);
	}
	const min = level.length === 0 ? 0 : Number(level[0]);
	const max = level.length === 2 ? Number(level[1]) : min;
	if (min > max) fail("T", `"${id}" level runs backwards, ${min}-${max}`);
	return treasurePick(id, levelRange(min, max));
}

/**
 * Every copy of one id in a slot merges into one pick, so a code that splits a
 * treasure's levels — or overlaps them, written by hand — reads as the one
 * treasure it names. First appearance keeps each pick's place.
 */
function readSlot(text: string): TreasurePick[] {
	if (text === "") return [];
	const merged = new Map<string, number[]>();
	for (const copy of text.split(ALTERNATIVE_SEPARATOR).map(readCopy)) {
		merged.set(copy.id, [...(merged.get(copy.id) ?? []), ...copy.levels]);
	}
	return [...merged].map(([id, levels]) =>
		treasurePick(
			id,
			[...new Set(levels)].sort((a, b) => a - b),
		),
	);
}

function checkLevels({ id, levels }: TreasurePick): void {
	if (levels.length === 0) fail("T", `"${id}" accepts no level`);
	for (const level of levels) {
		if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
			fail("T", `"${id}" level ${level} is outside 0-${MAX_LEVEL}`);
		}
	}
}

function checkId(
	tag: string,
	section: CatalogSection,
	noun: string,
	width: number,
	id: string,
): void {
	if (!new RegExp(`^[0-9A-Z]{${width}}$`).test(id)) {
		fail(tag, `"${id}" is not ${width} characters of [0-9A-Z]`);
	}
	if (!hasId(section, id)) fail(tag, `no ${noun} has id "${id}"`);
}

function checkTreasures(slots: TreasurePick[][]): void {
	if (slots.length > MAX_TREASURE_SLOTS) {
		fail(
			"T",
			`${slots.length} treasure slots, at most ${MAX_TREASURE_SLOTS} fit`,
		);
	}
	slots.forEach((slot, position) => {
		if (slot.length === 0) fail("T", `slot ${position + 1} is empty`);
		const seen = new Set<string>();
		for (const pick of slot) {
			checkId("T", "treasures", "treasure", TREASURE_WIDTH, pick.id);
			checkLevels(pick);
			if (seen.has(pick.id)) {
				fail("T", `slot ${position + 1} lists "${pick.id}" twice`);
			}
			seen.add(pick.id);
		}
	});
}

export function encodeLoadout(loadout: Loadout): string {
	let out = LOADOUT_VERSION;

	for (const { tag, section, noun, field, width } of SINGLE_GROUPS) {
		const id = loadout[field];
		if (id === null) continue;
		// The Any id names no entry, which is the whole of what it says. The
		// exception lives at the two call sites rather than inside `checkId`, so
		// a treasure slot — which shares that check — cannot inherit it.
		if (!isAnyId(section, id)) checkId(tag, section, noun, width, id);
		out += tag + id;
	}

	checkTreasures(loadout.treasures);
	if (loadout.treasures.length === 0) return out;

	const byId = (a: TreasurePick, b: TreasurePick): number =>
		a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
	const slots = loadout.treasures.map((slot) => [...slot].sort(byId));
	const ordered = slots.length > 1 && loadout.ordered;
	// Fixed-width uppercase base-36 sorts lexicographically in numeric order, so
	// comparing slots as strings is comparing their ids. It has to be the whole
	// slot, levels and all: two slots sharing their smallest id — or holding the
	// same ids at different levels — would otherwise tie, and a tie leaves the
	// caller's order in place — one build with two codes. "Levels and all" still
	// holds for a pick split across runs: `writePick` already joins its own
	// copies, so they sit together in the key rather than scattering among the
	// slot's other alternatives.
	const key = (slot: TreasurePick[]): string =>
		slot.map(writePick).join(ALTERNATIVE_SEPARATOR);
	const arranged = ordered
		? slots
		: [...slots].sort((a, b) => {
				if (key(a) === key(b)) return 0;
				return key(a) < key(b) ? -1 : 1;
			});

	return `${out}T${ordered ? "O" : "U"}${arranged.map(key).join(SLOT_SEPARATOR)}`;
}

export function decodeLoadout(section: string): Loadout {
	if (section.length === 0) throw new Error("loadout section is empty");

	const version = section.slice(0, 1);
	if (version !== LOADOUT_VERSION) {
		throw new Error(`unsupported loadout version "${version}"`);
	}

	const loadout = emptyLoadout();
	const seen = new Set<string>();
	let furthest = -1;
	let rest = section.slice(1);

	while (rest.length > 0) {
		const tag = rest.slice(0, 1);
		const position = TAG_ORDER.indexOf(tag);
		if (position === -1) throw new Error(`unknown loadout group "${tag}"`);
		if (seen.has(tag)) throw new Error(`loadout group "${tag}" appears twice`);
		if (position < furthest) {
			throw new Error(
				`loadout group "${tag}" is out of order, expected C R P T`,
			);
		}
		seen.add(tag);
		furthest = position;
		rest = rest.slice(1);

		const single = SINGLE_GROUPS.find((group) => group.tag === tag);
		if (single !== undefined) {
			const id = rest.slice(0, single.width);
			if (!isAnyId(single.section, id)) {
				checkId(single.tag, single.section, single.noun, single.width, id);
			}
			loadout[single.field] = id;
			rest = rest.slice(single.width);
			continue;
		}

		// T is last in the order, so the whole remainder belongs to it.
		const flag = rest.slice(0, 1);
		if (flag.length === 0) fail("T", "missing the order flag");
		if (flag !== "U" && flag !== "O") {
			fail("T", `order flag "${flag}" is neither "U" nor "O"`);
		}
		loadout.ordered = flag === "O";
		loadout.treasures = rest.slice(1).split(SLOT_SEPARATOR).map(readSlot);
		checkTreasures(loadout.treasures);
		rest = "";
	}

	return loadout;
}
