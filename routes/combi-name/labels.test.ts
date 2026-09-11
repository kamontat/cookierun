import { expect, test } from "bun:test";

import {
	ALL_ACTIONS,
	ALL_BOOSTS,
	ALL_COOKIE_POWERS,
	ALL_EPISODES,
	ALL_RANDOM_BOOSTS,
	ALL_TYPES,
} from "./codec.ts";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	RANDOM_BOOST_LABELS,
	TYPE_LABELS,
} from "./labels.ts";

type LabelTable = {
	field: string;
	labels: Record<string, string>;
	values: readonly string[];
};

const TABLES: LabelTable[] = [
	{ field: "type", labels: TYPE_LABELS, values: ALL_TYPES },
	{ field: "episode", labels: EPISODE_LABELS, values: ALL_EPISODES },
	{ field: "boost", labels: BOOST_LABELS, values: ALL_BOOSTS },
	{
		field: "random boost",
		labels: RANDOM_BOOST_LABELS,
		values: ALL_RANDOM_BOOSTS,
	},
	{
		field: "cookie power+",
		labels: COOKIE_POWER_LABELS,
		values: ALL_COOKIE_POWERS,
	},
	{ field: "action", labels: ACTION_LABELS, values: ALL_ACTIONS },
];

test("every value of every field has a label, with no leftover keys", () => {
	for (const { field, labels, values } of TABLES) {
		expect(Object.keys(labels).sort(), `${field} keys`).toEqual(
			[...values].sort(),
		);
		for (const value of values) {
			expect(labels[value], `${field} label for ${value}`).toBeTruthy();
		}
	}
});

test("labels read the way the game words them", () => {
	expect(TYPE_LABELS.semiauto).toBe("Semi-auto");
	expect(EPISODE_LABELS.specialExp).toBe("Special Exp Episode");
	expect(RANDOM_BOOST_LABELS.revive).toBe("Revive once with 80 HP");
	expect(COOKIE_POWER_LABELS.seaFairy).toBe("Sea Fairy Cookie");
	expect(ACTION_LABELS.jumpAtStart).toBe("Jump at start");
});

test("boost labels are the same strings decode errors use", () => {
	expect(BOOST_LABELS.powerJellyBoost).toBe("Power Jelly Boost");
});
