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

import { BOOST_LABELS, CODE_LENGTH, type Combi } from "./codec";
import { describeLoadout } from "./describe";
import { combiSectionOf, decodeFull, SECTION_SEPARATOR } from "./full-code";
import {
	ACTION_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	RANDOM_BOOST_LABELS,
	TYPE_LABELS,
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

function spansOfCombi(combi: Combi): Span[] {
	const boosts = combi.boosts.map((boost) => BOOST_LABELS[boost]);
	const powers = combi.cookiePowers.map((power) => COOKIE_POWER_LABELS[power]);

	return [
		{ length: 1, group: "version", hint: "Slot 1 · Format version" },
		{
			length: 1,
			group: "type",
			hint: `Slot 2 · Type${SEPARATOR}${TYPE_LABELS[combi.type]}`,
		},
		{
			length: 1,
			group: "episode",
			hint: `Slot 3 · Episode${SEPARATOR}${EPISODE_LABELS[combi.episode]}`,
		},
		{
			length: 1,
			group: "boosts",
			hint: `Slot 4 · Boosts${SEPARATOR}${
				boosts.length === 0 ? NONE : boosts.join(", ")
			}`,
		},
		// Reserved characters own a group of their own so the code bar draws them
		// as one run, and no control claims them: `index.ts`'s OWNER map has no
		// entry for this group, which is what keeps a click on them from jumping.
		{ length: 2, group: "reserved", hint: "Slots 5-6 · Reserved" },
		{
			length: 1,
			group: "randomBoost",
			hint: `Slot 7 · Random boost${SEPARATOR}${
				combi.randomBoost === null
					? NONE
					: RANDOM_BOOST_LABELS[combi.randomBoost]
			}`,
		},
		{
			length: 2,
			group: "cookiePowers",
			hint: `Slots 8-9 · Cookie power+${SEPARATOR}${
				powers.length === 0 ? NONE : powers.join(", ")
			}`,
		},
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
