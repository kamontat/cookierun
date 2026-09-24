/**
 * The loadout section: the cookie, relay, pet and treasure slots the game
 * already stores in a combi, carried so a whole build fits in one code.
 *
 * It is the left half of `loadout.combi`, variable length, and lives outside
 * the game's ten-character combi name — which is why it can afford tags and
 * separators the combi section cannot.
 *
 *     1C2LR0BP1ZTU0FZ_0RB-0QQ
 *     │└cookie      │ └ treasures: slot 1 accepts 0FZ or 0RB, slot 2 wants 0QQ
 *     │  └relay     └pet
 *     └ this section's own version, independent of the combi section's
 *
 * Encoding canonicalizes — ids sorted within a slot, slots sorted when order
 * does not matter — so one build has exactly one code. Decoding accepts a
 * non-canonical code as written.
 */

import { type CatalogSection, hasId, ID_WIDTH, isAnyId } from "./catalog";

export type Loadout = {
	/** Catalog id, or null when unset. */
	cookie: string | null;
	relay: string | null;
	pet: string | null;
	/** 0-3 slots, each holding one or more acceptable treasure ids. */
	treasures: string[][];
	/** Whether slot position matters. Meaningless with fewer than two slots. */
	ordered: boolean;
};

export const LOADOUT_VERSION = "1";
export const MAX_TREASURE_SLOTS = 3;

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

function fail(tag: string, detail: string): never {
	throw new Error(`loadout group "${tag}": ${detail}`);
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

function checkTreasures(slots: string[][]): void {
	if (slots.length > MAX_TREASURE_SLOTS) {
		fail(
			"T",
			`${slots.length} treasure slots, at most ${MAX_TREASURE_SLOTS} fit`,
		);
	}
	slots.forEach((slot, position) => {
		if (slot.length === 0) fail("T", `slot ${position + 1} is empty`);
		const seen = new Set<string>();
		for (const id of slot) {
			checkId("T", "treasures", "treasure", TREASURE_WIDTH, id);
			if (seen.has(id)) fail("T", `slot ${position + 1} lists "${id}" twice`);
			seen.add(id);
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

	const slots = loadout.treasures.map((slot) => [...slot].sort());
	const ordered = slots.length > 1 && loadout.ordered;
	// Fixed-width uppercase base-36 sorts lexicographically in numeric order, so
	// comparing slots as strings is comparing their ids. It has to be the whole
	// slot: two slots sharing their smallest id would otherwise tie, and a tie
	// leaves the caller's order in place — one build with two codes.
	const key = (slot: string[]): string => slot.join("_");
	const arranged = ordered
		? slots
		: [...slots].sort((a, b) => {
				if (key(a) === key(b)) return 0;
				return key(a) < key(b) ? -1 : 1;
			});

	return `${out}T${ordered ? "O" : "U"}${arranged.map((slot) => slot.join("_")).join("-")}`;
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
		loadout.treasures = rest
			.slice(1)
			.split("-")
			.map((slot) => (slot === "" ? [] : slot.split("_")));
		checkTreasures(loadout.treasures);
		rest = "";
	}

	return loadout;
}
