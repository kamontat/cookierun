/**
 * A full code is `loadout-combi`, always: the loadout half opens with the
 * format version, so with no loadout it is the version alone, `1-…`. The `-`
 * is the one character a word-wise selection stops at, so the combi half —
 * the part the game takes — selects on its own.
 *
 * The right half is the ten characters the game's combi name field holds,
 * with no version of their own; the left half is the version and everything
 * the game already stores in the combi itself. Splitting them is what keeps
 * the right half copy-pasteable into the game. A bare combi, copied back out
 * of the game, still decodes: it is read as the version this page writes.
 */

import { type Combi, decode, encode, isSemiAuto, limitsOf } from "./codec";
import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	type Loadout,
} from "./loadout";

export type FullCode = {
	loadout: Loadout;
	combi: Combi;
};

export const SECTION_SEPARATOR = "-";

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
	return isSemiAuto(full.combi) || carriesRelay(full);
}

/**
 * Whether the build has a relay cookie that counts. An episode with no relay
 * slot — the special episodes that take a cookie and a pet alone — ignores
 * one, so it forces nothing there.
 */
export function carriesRelay(full: FullCode): boolean {
	return full.loadout.relay !== null && limitsOf(full.combi.episode).relay;
}

/**
 * The loadout as the build's episode lets it be written: a relay or treasures
 * the episode has no room for are dropped, the way `normalize` in the codec
 * drops the combi's own.
 */
export function fitLoadout(loadout: Loadout, combi: Combi): Loadout {
	const limits = limitsOf(combi.episode);
	return {
		...loadout,
		relay: limits.relay ? loadout.relay : null,
		treasures: limits.treasures ? loadout.treasures : [],
	};
}

export function encodeFull(full: FullCode): string {
	const loadout = fitLoadout(full.loadout, full.combi);
	// Slot 1 is written from the whole build, so a code carrying a relay says
	// Semi-auto in the ten characters someone pastes into the game.
	const combi = encode(full.combi, loadout.relay !== null);
	return `${encodeLoadout(loadout)}${SECTION_SEPARATOR}${combi}`;
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

	const written = decodeLoadout(first);
	// The episode lives in the combi half, so it is read before the relay is
	// allowed to say anything about slot 1.
	const episode = decode(second).combi.episode;
	const limits = limitsOf(episode);
	const relayed = written.relay !== null && limits.relay;
	const { combi, warnings } = decode(second, relayed);
	const loadout = fitLoadout(written, combi);
	return {
		full: { loadout, combi },
		warnings: [
			...warnings,
			...loadoutWarnings(written, loadout),
			...(relayed ? relayWarnings(combi) : []),
		],
	};
}

/** What `fitLoadout` dropped from a loadout as written. */
function loadoutWarnings(written: Loadout, kept: Loadout): string[] {
	const warnings: string[] = [];
	if (written.relay !== null && kept.relay === null) {
		warnings.push("this episode takes no relay cookie — ignoring it");
	}
	if (written.treasures.length > 0 && kept.treasures.length === 0) {
		warnings.push("this episode takes no treasures — ignoring them");
	}
	return warnings;
}

/**
 * What the codec cannot say, because it does not know the word: a code whose
 * type slot reads Auto while the loadout carries a relay contradicts itself,
 * and the relay wins. Hand-typed codes are allowed to say it — decoding keeps
 * what the code says, and re-encoding is what snaps the slot back.
 */
function relayWarnings(combi: Combi): string[] {
	if (combi.mode !== "auto") return [];
	return [
		"slot 1 says Auto but the loadout carries a relay cookie — treating as Semi-auto",
	];
}
