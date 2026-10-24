/**
 * The build as `<build-summary>` draws it: one row per tab, in the tabs' order,
 * each pointing at the control behind it by its `hints.ts` group name.
 *
 * Nothing here decides how a build reads. The words come from `labels.ts` and
 * `describe.ts`, the pictures from `art.ts` and `catalog.ts`; this only lays
 * them out in the element's own item vocabulary.
 */

import type { SummaryItem, SummaryRow } from "#components/build-summary";

import { boostArt, cookiePowerArt, episodeArt } from "./art";
import { type CatalogSection, imageFor, kindFor, labelFor } from "./catalog";
import { limitsOf } from "./codec";
import { describeBuild, floorText } from "./describe";
import type { FullCode } from "./full-code";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	GOAL_LABELS,
	MODE_LABELS,
	RANDOM_BOOST_LABELS,
} from "./labels";
import { levelRuns, type TreasurePick } from "./loadout";

export const HINT =
	"Nothing else picked yet. Choose a cookie, boosts or treasures in the tabs below.";

const DOT: SummaryItem = { kind: "sep", text: "·" };
const ARROW: SummaryItem = { kind: "sep", text: "→" };

function picture(section: CatalogSection, id: string, base: string) {
	const image = imageFor(section, id);
	return image === null ? null : base + image;
}

/**
 * A face with its name as a small caption under it, as for boosts, power+ and
 * treasures — the owner's call: the picture leads, and the name is there on a
 * phone too, which has no hover. One with no face (Any, or an entry the
 * catalog has no picture for) says its name in line instead.
 */
function entry(section: CatalogSection, id: string, base: string): SummaryItem {
	const title = labelFor(section, id);
	const src = picture(section, id, base);
	return src === null
		? { kind: "image", src, text: title, title }
		: { kind: "image", src, title, caption: title };
}

/** `+3–9`, or `+0, +2–4` for a level set with gaps. */
function levelText({ levels }: TreasurePick): string {
	return levelRuns(levels)
		.map(([min, max]) => (min === max ? `+${min}` : `+${min}–${max}`))
		.join(", ");
}

function isPlainZero({ levels }: TreasurePick): boolean {
	return levels.length === 1 && levels[0] === 0;
}

/**
 * A treasure's form, for the picture: an evolved one and the blessed one beside
 * it share a picture, so the kind is what tells them apart. A base form, the
 * common case, carries nothing.
 */
function markOf(id: string): { mark?: "evolved" | "blessed" } {
	const kind = kindFor("treasures", id);
	return kind === "evolved" || kind === "blessed" ? { mark: kind } : {};
}

/** One picture for a slot: its first pick, with the rest in the title. */
function slotItem(slot: readonly TreasurePick[], base: string): SummaryItem {
	const [first] = slot;
	if (first === undefined) return { kind: "image", src: null };
	const src = picture("treasures", first.id, base);
	return {
		kind: "image",
		src,
		// With no picture, the name stands in for it, or the slot vanishes.
		...(src === null
			? { text: labelFor("treasures", first.id) }
			: { caption: labelFor("treasures", first.id) }),
		title: slot
			.map((pick) => `${labelFor("treasures", pick.id)} ${levelText(pick)}`)
			.join(" or "),
		...(slot.length > 1 ? { badge: `+${slot.length - 1}` } : {}),
		...(isPlainZero(first) ? {} : { note: levelText(first) }),
		...markOf(first.id),
	};
}

function modePill(full: FullCode): SummaryItem {
	if (full.combi.mode === "manual") {
		return { kind: "pill", text: MODE_LABELS.manual };
	}
	return describeBuild(full)?.semi
		? { kind: "pill", text: MODE_LABELS.semiauto, tone: "semi" }
		: { kind: "pill", text: MODE_LABELS.auto };
}

/**
 * The goal's word, with "Any" saying what it is any of: a control sits under a
 * heading that names it, but a summary line puts a goal and an episode side by
 * side, and two bare "Any"s there read as nothing.
 */
function goalText({ combi }: FullCode): string {
	return combi.goal === "any" ? "Any goal" : GOAL_LABELS[combi.goal];
}

function episodeText({ combi }: FullCode): string {
	const name =
		combi.episode === "any" ? "Any episode" : EPISODE_LABELS[combi.episode];
	if (!limitsOf(combi.episode).floor) return name;
	return `${name}, ${floorText(combi.floor).toLowerCase()}`;
}

function runRow(full: FullCode, base: string): SummaryRow {
	const { combi } = full;
	const verdict = describeBuild(full);
	const action =
		combi.mode !== "manual" && combi.action !== "none"
			? [DOT, { kind: "text", text: ACTION_LABELS[combi.action] } as const]
			: [];

	return {
		label: "Run",
		target: "mode",
		items: [
			modePill(full),
			...(verdict?.semi
				? [
						{
							kind: "text",
							text: verdict.reasons.join(", "),
							muted: true,
							// Behind the row's toggle: the pill says semi-auto,
							// and why is one click away.
							detail: true,
						} as const,
					]
				: []),
			DOT,
			{ kind: "text", text: goalText(full) },
			DOT,
			{
				kind: "image",
				src: episodeArt(combi.episode, base),
				text: episodeText(full),
			},
			...action,
		],
	};
}

/** Cookie, then `→` relay where the episode takes one, then `·` pet. */
function cookieItems(full: FullCode, base: string): SummaryItem[] {
	const { cookie, relay, pet } = full.loadout;
	const items: SummaryItem[] = [];
	if (cookie !== null) items.push(entry("cookies", cookie, base));
	if (relay !== null && limitsOf(full.combi.episode).relay) {
		if (items.length > 0) items.push(ARROW);
		items.push(entry("cookies", relay, base));
	}
	if (pet !== null) {
		if (items.length > 0) items.push(DOT);
		items.push(entry("pets", pet, base));
	}
	return items;
}

function treasureItems(full: FullCode, base: string): SummaryItem[] {
	if (!limitsOf(full.combi.episode).treasures) return [];
	const { treasures, ordered } = full.loadout;
	const exact = ordered && treasures.length > 1;
	const slots = treasures.map((slot) => slotItem(slot, base));
	if (!exact) return slots;
	return [
		...slots.flatMap((slot, at) => (at === 0 ? [slot] : [ARROW, slot])),
		{ kind: "tag", text: "exact order" },
	];
}

/** A power+'s name without the trailing " Cookie" its label carries. */
function powerName(label: string): string {
	return label.replace(/ Cookie$/, "");
}

export function summaryOf(
	full: FullCode,
	base: string,
): { rows: SummaryRow[]; compact: SummaryItem[]; hint: string | null } {
	const { combi } = full;
	const limits = limitsOf(combi.episode);
	const cookies = cookieItems(full, base);
	const treasures = treasureItems(full, base);
	const boosts = limits.boosts ? combi.boosts : [];
	const randomBoost = limits.boosts ? combi.randomBoost : null;
	const powers = limits.boosts ? combi.cookiePowers : [];

	const rows: SummaryRow[] = [runRow(full, base)];
	const add = (label: string, target: string, items: SummaryItem[]) => {
		if (items.length > 0) rows.push({ label, target, items });
	};

	add("Cookies", "cookie", cookies);
	add("Treasures", "treasures", treasures);
	add(
		"Boosts",
		"boosts",
		// The icon, with its name captioned under it. One with no picture falls
		// back to the name in line.
		boosts.map((boost) => ({
			kind: "image",
			src: boostArt(boost, base)[0] ?? null,
			title: BOOST_LABELS[boost],
			caption: BOOST_LABELS[boost],
		})),
	);
	add(
		"Random boost",
		"randomBoost",
		randomBoost === null
			? []
			: [{ kind: "text", text: RANDOM_BOOST_LABELS[randomBoost] }],
	);
	add(
		"Power+",
		"cookiePowers",
		powers.map((power) => ({
			kind: "stack",
			srcs: cookiePowerArt(power, base).slice(0, 2),
			title: powerName(COOKIE_POWER_LABELS[power]),
			caption: powerName(COOKIE_POWER_LABELS[power]),
		})),
	);

	const count = boosts.length + (randomBoost === null ? 0 : 1) + powers.length;
	const episodeIcon = episodeArt(combi.episode, base);
	const compact: SummaryItem[] = [
		modePill(full),
		{ kind: "text", text: goalText(full) },
		episodeIcon === null
			? { kind: "text", text: episodeText(full) }
			: { kind: "image", src: episodeIcon, title: episodeText(full) },
		// Before the pictures: a long build overflows a phone's line, which
		// clips at its end, and a picture is the thing to lose, not the count.
		...(count === 0
			? []
			: [
					{
						kind: "text",
						text: `${count} ${count === 1 ? "boost" : "boosts"}`,
					} as const,
				]),
		// Faces alone: the line is one line, and the names are a tap away.
		...cookies.flatMap((item): SummaryItem[] =>
			item.kind === "image" && item.src !== null
				? [{ kind: "image", src: item.src, title: item.title ?? "" }]
				: item.kind === "image"
					? [item]
					: [],
		),
		...treasures.flatMap((item): SummaryItem[] => {
			if (item.kind !== "image") return [];
			// No caption and no level note: one line has room for the picture.
			const { caption: _caption, note: _note, ...picture } = item;
			return [picture];
		}),
	];

	const hint = rows.length === 1 && full.loadout.cookie === null ? HINT : null;

	return { rows, compact, hint };
}
