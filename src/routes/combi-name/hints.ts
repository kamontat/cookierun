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

import { CODE_LENGTH, type Combi, limitsOf } from "./codec";
import { describeLoadout, floorText, goalsText, NOT_USED } from "./describe";
import { combiSectionOf, decodeFull, SECTION_SEPARATOR } from "./full-code";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	MODE_LABELS,
	RANDOM_BOOST_LABELS,
} from "./labels";
import { type Loadout, SLOT_SEPARATOR } from "./loadout";

export type CharHint = {
	char: string;
	/** Tooltip text for this character. */
	hint: string;
	/** Field id, so the characters of one field can be drawn as one group. */
	group: string;
	/**
	 * The slot and field alone, without the value — what a tap says under the
	 * code. The tap also jumps to the control, which shows the value itself.
	 */
	name: string;
};

const SEPARATOR = " · ";
const NONE = "None";

/** A run of characters that all describe the same field. */
type Span = { length: number; group: string; name: string; hint: string };

/** A span whose hint is its name, then what the field holds when it says. */
function span(
	length: number,
	group: string,
	name: string,
	value?: string,
): Span {
	return {
		length,
		group,
		name,
		hint: value === undefined ? name : `${name}${SEPARATOR}${value}`,
	};
}

function listed(values: string[]): string {
	return values.length === 0 ? NONE : values.join(", ");
}

/**
 * Slots 4-8, which say different things on different episodes: the tower
 * floor where there is one, what the run carries where there is room for it,
 * and nothing at all on an episode that takes neither.
 */
function carriedSpans(combi: Combi): Span[] {
	const limits = limitsOf(combi.episode);

	if (limits.floor) {
		return [
			span(3, "floor", "Slots 4-6 · Floor", floorText(combi.floor)),
			// Reserved characters own a group of their own so the code bar draws
			// them as one run, and no control claims them: `index.ts`'s OWNER map
			// has no entry for this group, which is what keeps a click on them
			// from jumping.
			span(2, "reserved", "Slots 7-8 · Reserved"),
		];
	}

	if (!limits.boosts) {
		return [span(5, "reserved", "Slots 4-8 · Boosts", NOT_USED)];
	}

	return [
		span(
			1,
			"boosts",
			"Slot 4 · Boosts",
			listed(combi.boosts.map((boost) => BOOST_LABELS[boost])),
		),
		span(
			1,
			"randomBoost",
			"Slot 5 · Random boost",
			combi.randomBoost === null
				? NONE
				: RANDOM_BOOST_LABELS[combi.randomBoost],
		),
		span(
			3,
			"cookiePowers",
			"Slots 6-8 · Cookie power+",
			listed(combi.cookiePowers.map((power) => COOKIE_POWER_LABELS[power])),
		),
	];
}

function spansOfCombi(combi: Combi): Span[] {
	return [
		span(1, "mode", "Slot 1 · Mode", MODE_LABELS[combi.mode]),
		span(1, "goal", "Slot 2 · Goal", goalsText(combi.goals)),
		span(1, "episode", "Slot 3 · Episode", EPISODE_LABELS[combi.episode]),
		...carriedSpans(combi),
		span(1, "action", "Slot 9 · Action", ACTION_LABELS[combi.action]),
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
 * The treasure group as runs: its letter and order flag, then one run per
 * slot, each with the `.` that closes it, so each slot is drawn — and jumps —
 * on its own. Every run shares the group's whole description as its hint.
 */
function treasureSpans(text: string, hint: string): Span[] {
	const spans: Span[] = [
		{ length: 2, group: "treasureOrder", name: "Treasure order", hint },
	];
	const slots = text.slice(2).split(SLOT_SEPARATOR);
	slots.forEach((slot, index) => {
		const last = index === slots.length - 1;
		spans.push({
			length: slot.length + (last ? 0 : SLOT_SEPARATOR.length),
			group: `treasure${index + 1}`,
			name: `Treasure slot ${index + 1}`,
			hint,
		});
	});
	return spans;
}

/**
 * Walks the loadout grammar rather than re-decoding it: a `C`, `R` or `P` group
 * is its letter plus two id characters, and `T` runs to the end of the section.
 */
function spansOfLoadout(section: string, loadout: Loadout): Span[] {
	const rows = describeLoadout(loadout);
	const spans: Span[] = [span(1, "version", "Format version")];

	let at = 1;
	while (at < section.length) {
		const letter = section[at] as string;
		const found = LOADOUT_GROUPS[letter];
		if (found === undefined) break;

		const row = rows[found.row];
		const length = letter === "T" ? section.length - at : 3;
		const hint =
			row === undefined ? letter : `${row.field}${SEPARATOR}${row.value}`;
		if (letter === "T") {
			spans.push(...treasureSpans(section.slice(at), hint));
		} else {
			spans.push({
				length,
				group: found.group,
				name: row?.field ?? letter,
				hint,
			});
		}
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
			hints.push({
				char,
				hint: span.hint,
				group: span.group,
				name: span.name,
			});
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
	const separator = "Separates the loadout from the combi name";
	return [
		...expand(loadoutSection, spansOfLoadout(loadoutSection, full.loadout)),
		{
			char: SECTION_SEPARATOR,
			hint: separator,
			group: "separator",
			name: separator,
		},
		...combi,
	];
}
