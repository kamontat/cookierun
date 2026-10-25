import { type CatalogSection, isRetired, labelFor } from "./catalog";
import { type Combi, type Episode, isSemiAuto, limitsOf } from "./codec";
import { carriesRelay, type FullCode, isSemiAutoBuild } from "./full-code";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	GOAL_LABELS,
	MODE_LABELS,
	RANDOM_BOOST_LABELS,
} from "./labels";
import { type Loadout, levelRuns, type TreasurePick } from "./loadout";

export type DescribedRow = {
	field: string;
	value: string;
};

export type AutoVerdict = {
	semi: boolean;
	/** What forces manual work each run. Empty when the combi is full auto. */
	reasons: string[];
};

export type DescribedCombi = {
	rows: DescribedRow[];
	/** Null for a manual run, where auto vs semi-auto means nothing. */
	auto: AutoVerdict | null;
};

const NONE = "None";

function list(values: string[]): string {
	return values.length === 0 ? NONE : values.join(", ");
}

function verdict(combi: Combi): AutoVerdict | null {
	if (combi.mode === "manual") return null;

	const reasons: string[] = [];
	if (combi.boosts.includes("fastStart")) reasons.push(BOOST_LABELS.fastStart);
	if (combi.randomBoost !== null) {
		reasons.push(RANDOM_BOOST_LABELS[combi.randomBoost]);
	}
	if (combi.action !== "none") reasons.push(ACTION_LABELS[combi.action]);

	return { semi: isSemiAuto(combi), reasons };
}

/** What the relay reads as in the verdict, where it is one reason among four. */
const RELAY_REASON = "Relay cookie";

/**
 * The verdict for a whole build rather than for its ten characters: the combi's
 * own three reasons plus the loadout's one. A relay cookie is swapped in by
 * hand, so a run carrying one never plays itself through.
 */
export function describeBuild(full: FullCode): AutoVerdict | null {
	const own = verdict(full.combi);
	if (own === null) return null;

	return {
		semi: isSemiAutoBuild(full),
		reasons: carriesRelay(full) ? [...own.reasons, RELAY_REASON] : own.reasons,
	};
}

/**
 * An episode as a chip says it: "EP. 3", "S.EP. 2", "S.EP. Exp". Cut from the
 * label rather than kept as a second table, so a new episode needs no entry.
 */
function shortEpisode(episode: Episode): string {
	const label = EPISODE_LABELS[episode];
	if (!label.startsWith("Special ")) return label.replace(/^Episode/, "EP.");
	return `S.EP. ${label.replace(/^Special |Episode/g, "").trim()}`;
}

/**
 * A build in a few words — mode, goal, episode, and the tower's floor — for a
 * saved row, where the note says what it is for and this says what it plays.
 * The mode is the build's, so a relay makes it Semi-auto; Any names its field,
 * since a bare "Any" beside two others reads as nothing.
 */
export function describeRun(full: FullCode): string[] {
	const { combi } = full;
	const mode =
		combi.mode !== "manual" && isSemiAutoBuild(full)
			? MODE_LABELS.semiauto
			: MODE_LABELS[combi.mode === "semiauto" ? "auto" : combi.mode];
	return [
		mode,
		combi.goal === "any" ? "Any goal" : GOAL_LABELS[combi.goal],
		combi.episode === "any" ? "Any episode" : shortEpisode(combi.episode),
		...(limitsOf(combi.episode).floor ? [floorText(combi.floor)] : []),
	];
}

/** What a field the episode has no room for reads as. */
export const NOT_USED = "Not used in this episode";

/** The floor as a reader says it: a number, or any floor at all. */
export function floorText(floor: number | null): string {
	return floor === null ? "Any floor" : `Floor ${floor}`;
}

export function describeCombi(combi: Combi): DescribedCombi {
	const limits = limitsOf(combi.episode);
	const carried: DescribedRow[] = limits.boosts
		? [
				{
					field: "Boosts",
					value: list(combi.boosts.map((boost) => BOOST_LABELS[boost])),
				},
				{
					field: "Random boost",
					value:
						combi.randomBoost === null
							? NONE
							: RANDOM_BOOST_LABELS[combi.randomBoost],
				},
				{
					field: "Cookie power+",
					value: list(
						combi.cookiePowers.map((power) => COOKIE_POWER_LABELS[power]),
					),
				},
			]
		: [{ field: "Boosts", value: NOT_USED }];

	return {
		rows: [
			{ field: "Goal", value: GOAL_LABELS[combi.goal] },
			{ field: "Mode", value: MODE_LABELS[combi.mode] },
			{ field: "Episode", value: EPISODE_LABELS[combi.episode] },
			...(limits.floor
				? [{ field: "Floor", value: floorText(combi.floor) }]
				: []),
			...carried,
			{ field: "Action", value: ACTION_LABELS[combi.action] },
		],
		auto: verdict(combi),
	};
}

const RETIRED_SUFFIX = " (no longer listed)";

/**
 * A code stays readable after the site drops an entry, so the entry is still
 * named — with a note, because the reader will not find it in the game.
 */
function entryName(section: CatalogSection, id: string): string {
	const name = labelFor(section, id);
	return isRetired(section, id) ? name + RETIRED_SUFFIX : name;
}

/** Runs joined by commas: " or " is what separates two treasures. */
function levelText({ levels }: TreasurePick): string {
	return levelRuns(levels)
		.map(([min, max]) => (min === max ? `+${min}` : `+${min}-${max}`))
		.join(", ");
}

function slotName(slot: TreasurePick[]): string {
	return slot
		.map((pick) => `${entryName("treasures", pick.id)} ${levelText(pick)}`)
		.join(" or ");
}

function treasureRow(loadout: Loadout): DescribedRow {
	const { treasures, ordered } = loadout;
	if (treasures.length === 0) return { field: "Treasures", value: NONE };

	if (ordered && treasures.length > 1) {
		return {
			field: "Treasures (exact order)",
			value: treasures
				.map((slot, position) => `${position + 1}. ${slotName(slot)}`)
				.join("; "),
		};
	}

	return {
		field: "Treasures",
		value: treasures.map(slotName).join("; "),
	};
}

export function describeLoadout(loadout: Loadout): DescribedRow[] {
	const single = (
		field: string,
		section: CatalogSection,
		id: string | null,
	): DescribedRow => ({
		field,
		value: id === null ? NONE : entryName(section, id),
	});

	return [
		single("Cookie", "cookies", loadout.cookie),
		single("Relay", "cookies", loadout.relay),
		single("Pet", "pets", loadout.pet),
		treasureRow(loadout),
	];
}
