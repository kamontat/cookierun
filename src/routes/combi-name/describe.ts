import { type CatalogSection, isRetired, labelFor } from "./catalog";
import { type Combi, isSemiAuto } from "./codec";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	RANDOM_BOOST_LABELS,
	TYPE_LABELS,
} from "./labels";
import type { Loadout } from "./loadout";

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
	/** Null for the hand-played types, where auto vs semi-auto means nothing. */
	auto: AutoVerdict | null;
};

const NONE = "None";

function list(values: string[]): string {
	return values.length === 0 ? NONE : values.join(", ");
}

function verdict(combi: Combi): AutoVerdict | null {
	if (combi.type !== "auto" && combi.type !== "semiauto") return null;

	const reasons: string[] = [];
	if (combi.boosts.includes("fastStart")) reasons.push(BOOST_LABELS.fastStart);
	if (combi.randomBoost !== null) {
		reasons.push(RANDOM_BOOST_LABELS[combi.randomBoost]);
	}
	if (combi.action !== "none") reasons.push(ACTION_LABELS[combi.action]);

	return { semi: isSemiAuto(combi), reasons };
}

export function describeCombi(combi: Combi): DescribedCombi {
	return {
		rows: [
			{ field: "Type", value: TYPE_LABELS[combi.type] },
			{ field: "Episode", value: EPISODE_LABELS[combi.episode] },
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

function slotName(slot: string[]): string {
	return slot.map((id) => entryName("treasures", id)).join(" or ");
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
