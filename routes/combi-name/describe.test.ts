import { expect, test } from "bun:test";

import type { Combi } from "./codec.ts";
import { describeCombi } from "./describe.ts";

const base: Combi = {
	type: "score",
	episode: "episode3",
	boosts: [],
	randomBoost: null,
	cookiePowers: [],
	action: "none",
};

test("describes all six fields, using None for empty selections", () => {
	expect(describeCombi(base).rows).toEqual([
		{ field: "Type", value: "Score" },
		{ field: "Episode", value: "Episode 3" },
		{ field: "Boosts", value: "None" },
		{ field: "Random boost", value: "None" },
		{ field: "Cookie power+", value: "None" },
		{ field: "Action", value: "No action" },
	]);
});

test("joins multiple boosts and cookie powers in slot order", () => {
	const { rows } = describeCombi({
		...base,
		boosts: ["hpExtension", "fastStart"],
		cookiePowers: ["fairy", "expParty"],
	});

	expect(rows[2]).toEqual({
		field: "Boosts",
		value: "HP Extension, Fast Start",
	});
	expect(rows[4]).toEqual({
		field: "Cookie power+",
		value: "Fairy Cookie, EXP Party",
	});
});

test("no auto verdict for a type that is played by hand", () => {
	expect(describeCombi(base).auto).toBeNull();
});

test("a full auto combi gets a verdict with no reasons", () => {
	expect(describeCombi({ ...base, type: "auto" }).auto).toEqual({
		semi: false,
		reasons: [],
	});
});

test("a semi-auto verdict names every reason it needs manual work", () => {
	const { auto } = describeCombi({
		...base,
		type: "auto",
		boosts: ["hpExtension", "fastStart"],
		randomBoost: "revive",
		action: "jumpAtStart",
	});

	expect(auto).toEqual({
		semi: true,
		reasons: ["Fast Start", "Revive once with 80 HP", "Jump at start"],
	});
});
