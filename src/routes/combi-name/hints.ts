/**
 * What each character of a code means, one entry per character, so the page can
 * hang a tooltip on every one of them. It is the legend table applied to the
 * code you are actually looking at — the answer to "which of these is the
 * episode?" without scrolling to the table.
 *
 * Hints are derived, never authored: the slot layout comes from the codec's own
 * tables and the values from `describe.ts`, so a table that grows cannot leave a
 * stale hint behind.
 */

import { BOOST_LABELS, CODE_LENGTH, type Combi, limitsOf } from "./codec";
import { describeLoadout, floorText, NOT_USED } from "./describe";
import { combiSectionOf, decodeFull, SECTION_SEPARATOR } from "./full-code";
import {
	ACTION_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	GOAL_LABELS,
	MODE_LABELS,
	RANDOM_BOOST_LABELS,
} from "./labels";
import type { Loadout } from "./loadout";

export type CharHint = {
	char: string;
	/** Tooltip text for this character. */
	hint: string;
	/** Field id, so the characters of one field can be drawn as one group. */
	group: string;
};

const SEPARATOR = " · ";
const NONE = "None";

/** A run of characters that all describe the same field. */
type Span = { length: number; group: string; hint: string };

function listed(values: string[]): string {
	return values.length === 0 ? NONE : values.join(", ");
}

/**
 * Slots 5-9, which say different things on different episodes: the tower
 * floor where there is one, what the run carries where there is room for it,
 * and nothing at all on an episode that takes neither.
 */
function carriedSpans(combi: Combi): Span[] {
	const limits = limitsOf(combi.episode);

	if (limits.floor) {
		return [
			{
				length: 3,
				group: "floor",
				hint: `Slots 5-7 · Floor${SEPARATOR}${floorText(combi.floor)}`,
			},
			// Reserved characters own a group of their own so the code bar draws
			// them as one run, and no control claims them: `index.ts`'s OWNER map
			// has no entry for this group, which is what keeps a click on them
			// from jumping.
			{ length: 2, group: "reserved", hint: "Slots 8-9 · Reserved" },
		];
	}

	if (!limits.boosts) {
		return [
			{
				length: 5,
				group: "reserved",
				hint: `Slots 5-9 · Boosts${SEPARATOR}${NOT_USED}`,
			},
		];
	}

	return [
		{
			length: 1,
			group: "boosts",
			hint: `Slot 5 · Boosts${SEPARATOR}${listed(
				combi.boosts.map((boost) => BOOST_LABELS[boost]),
			)}`,
		},
		{
			length: 1,
			group: "randomBoost",
			hint: `Slot 6 · Random boost${SEPARATOR}${
				combi.randomBoost === null
					? NONE
					: RANDOM_BOOST_LABELS[combi.randomBoost]
			}`,
		},
		{
			length: 3,
			group: "cookiePowers",
			hint: `Slots 7-9 · Cookie power+${SEPARATOR}${listed(
				combi.cookiePowers.map((power) => COOKIE_POWER_LABELS[power]),
			)}`,
		},
	];
}

function spansOfCombi(combi: Combi): Span[] {
	return [
		{ length: 1, group: "version", hint: "Slot 1 · Format version" },
		{
			length: 1,
			group: "mode",
			hint: `Slot 2 · Mode${SEPARATOR}${MODE_LABELS[combi.mode]}`,
		},
		{
			length: 1,
			group: "goal",
			hint: `Slot 3 · Goal${SEPARATOR}${GOAL_LABELS[combi.goal]}`,
		},
		{
			length: 1,
			group: "episode",
			hint: `Slot 4 · Episode${SEPARATOR}${EPISODE_LABELS[combi.episode]}`,
		},
		...carriedSpans(combi),
		{
			length: 1,
			group: "action",
			hint: `Slot 10 · Action${SEPARATOR}${ACTION_LABELS[combi.action]}`,
		},
	];
}

/** The group letters, in the order `loadout.ts` writes them. */
const LOADOUT_GROUPS: Record<string, { group: string; row: number }> = {
	C: { group: "cookie", row: 0 },
	R: { group: "relay", row: 1 },
	P: { group: "pet", row: 2 },
	T: { group: "treasures", row: 3 },
};

/**
 * Walks the loadout grammar rather than re-decoding it: a `C`, `R` or `P` group
 * is its letter plus two id characters, and `T` runs to the end of the section.
 */
function spansOfLoadout(section: string, loadout: Loadout): Span[] {
	const rows = describeLoadout(loadout);
	const spans: Span[] = [
		{ length: 1, group: "loadoutVersion", hint: "Loadout version" },
	];

	let at = 1;
	while (at < section.length) {
		const letter = section[at] as string;
		const found = LOADOUT_GROUPS[letter];
		if (found === undefined) break;

		const row = rows[found.row];
		const length = letter === "T" ? section.length - at : 3;
		spans.push({
			length,
			group: found.group,
			hint: row === undefined ? letter : `${row.field}${SEPARATOR}${row.value}`,
		});
		at += length;
	}

	return spans;
}

function expand(text: string, spans: Span[]): CharHint[] {
	const hints: CharHint[] = [];
	let at = 0;

	for (const span of spans) {
		for (let n = 0; n < span.length; n += 1) {
			const char = text[at + n];
			if (char === undefined) return hints;
			hints.push({ char, hint: span.hint, group: span.group });
		}
		at += span.length;
	}

	return hints;
}

/**
 * One hint per character, or nothing at all: a code the page cannot read is a
 * code it has nothing true to say about, and a half-labelled code would point
 * at the wrong characters.
 */
export function hintsFor(code: string): CharHint[] {
	const combiSection = combiSectionOf(code);
	if (combiSection.length !== CODE_LENGTH) return [];

	let full: ReturnType<typeof decodeFull>["full"];
	try {
		({ full } = decodeFull(code));
	} catch {
		return [];
	}

	const combi = expand(combiSection, spansOfCombi(full.combi));
	if (combiSection.length === code.length) return combi;

	const loadoutSection = code.slice(0, code.length - combiSection.length - 1);
	return [
		...expand(loadoutSection, spansOfLoadout(loadoutSection, full.loadout)),
		{
			char: SECTION_SEPARATOR,
			hint: "Separates the loadout from the combi name",
			group: "separator",
		},
		...combi,
	];
}
