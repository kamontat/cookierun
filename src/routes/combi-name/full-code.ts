/**
 * A full code is `loadout.combi`, or just `combi` when there is no loadout.
 *
 * The right half is the ten characters the game's combi name field holds,
 * unchanged; the left half is everything the game already stores in the combi
 * itself. Splitting them is what keeps the right half copy-pasteable into the
 * game, and what keeps every code written before the loadout existed valid.
 */

import { type Combi, decode, encode, isSemiAuto } from "./codec";
import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
} from "./loadout";

export type FullCode = {
	loadout: Loadout;
	combi: Combi;
};

export const SECTION_SEPARATOR = ".";

/**
 * Whether the whole build plays itself. The combi half answers for its own
 * flags; the loadout adds one reason of its own — a relay cookie has to be
 * swapped in by hand, so a run carrying one is never full auto no matter what
 * the ten characters say.
 *
 * This lives here rather than in `codec.ts` because it is the one question
 * whose answer needs both halves, and the codec does not model a loadout.
 */
export function isSemiAutoBuild(full: FullCode): boolean {
	return isSemiAuto(full.combi) || full.loadout.relay !== null;
}

export function encodeFull(full: FullCode): string {
	// Slot 2 is written from the whole build, so a code carrying a relay says
	// Semi-auto in the ten characters someone pastes into the game.
	const combi = encode(full.combi, full.loadout.relay !== null);
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
	const relayed = loadout.relay !== null;
	const { combi, warnings } = decode(second, relayed);
	return {
		full: { loadout, combi },
		warnings: relayed ? [...warnings, ...relayWarnings(combi)] : warnings,
	};
}

/**
 * What the codec cannot say, because it does not know the word: a code whose
 * type slot reads Auto while the loadout carries a relay contradicts itself,
 * and the relay wins. Hand-typed codes are allowed to say it — decoding keeps
 * what the code says, and re-encoding is what snaps the slot back.
 */
function relayWarnings(combi: Combi): string[] {
	if (combi.type !== "auto") return [];
	return [
		"slot 2 says Auto but the loadout carries a relay cookie — treating as Semi-auto",
	];
}
