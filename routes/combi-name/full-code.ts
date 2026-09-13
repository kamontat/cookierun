/**
 * A full code is `loadout.combi`, or just `combi` when there is no loadout.
 *
 * The right half is the ten characters the game's combi name field holds,
 * unchanged; the left half is everything the game already stores in the combi
 * itself. Splitting them is what keeps the right half copy-pasteable into the
 * game, and what keeps every code written before the loadout existed valid.
 */

import { type Combi, decode, encode } from "./codec.ts";
import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
} from "./loadout.ts";

export type FullCode = {
	loadout: Loadout;
	combi: Combi;
};

export const SECTION_SEPARATOR = ".";

export function encodeFull(full: FullCode): string {
	const combi = encode(full.combi);
	if (isEmptyLoadout(full.loadout)) return combi;
	return `${encodeLoadout(full.loadout)}${SECTION_SEPARATOR}${combi}`;
}

/**
 * The combi half of whatever has been typed so far, so the page can count
 * characters against it while the code is still incomplete.
 */
export function combiSectionOf(code: string): string {
	const at = code.lastIndexOf(SECTION_SEPARATOR);
	return at === -1 ? code : code.slice(at + 1);
}

export function decodeFull(code: string): {
	full: FullCode;
	warnings: string[];
} {
	const parts = code.split(SECTION_SEPARATOR);
	if (parts.length > 2) {
		throw new Error(
			`a code holds at most one "${SECTION_SEPARATOR}", got ${parts.length - 1}`,
		);
	}

	const [first = "", second] = parts;
	if (second === undefined) {
		const { combi, warnings } = decode(first);
		return { full: { loadout: emptyLoadout(), combi }, warnings };
	}

	const loadout = decodeLoadout(first);
	const { combi, warnings } = decode(second);
	return { full: { loadout, combi }, warnings };
}
