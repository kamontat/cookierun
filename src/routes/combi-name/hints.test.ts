import { expect, test } from "bun:test";

import { hintsFor } from "./hints";

function hints(code: string): string[] {
	return hintsFor(code).map(({ hint }) => hint);
}

function groups(code: string): string[] {
	return hintsFor(code).map(({ group }) => group);
}

test("one hint per character of the code", () => {
	const code = "1S00000000";
	const described = hintsFor(code);

	expect(described).toHaveLength(code.length);
	expect(described.map(({ char }) => char).join("")).toBe(code);
});

test("each slot names its number, its field and what it currently says", () => {
	const [version, type, episode] = hints("1E3600400J");

	expect(version).toBe("Slot 1 · Format version");
	expect(type).toBe("Slot 2 · Type · Exp");
	expect(episode).toBe("Slot 3 · Episode · Episode 3");
});

test("the boost slot names every boost that is on", () => {
	const [, , , boosts] = hints("1E3600400J");

	expect(boosts).toBe("Slot 4 · Boosts · Power Jelly Boost, Fast Start");
});

test("a boost slot with nothing on reads as None", () => {
	const [, , , boosts] = hints("1E3000400J");

	expect(boosts).toBe("Slot 4 · Boosts · None");
});

test("the reserved slots say so, and say it together", () => {
	const described = hintsFor("1E3F00400J");

	expect(described[4]?.hint).toBe("Slots 5-6 · Reserved");
	expect(described[5]?.hint).toBe(described[4]?.hint);
	expect(described[3]?.hint).toBe(
		"Slot 4 · Boosts · HP Extension, Power Jelly Boost, Fast Start, Double XP",
	);
});

test("the two cookie power+ characters share one hint over the whole mask", () => {
	const described = hints("1S00000140");

	expect(described[7]).toBe(
		"Slots 8-9 · Cookie power+ · Fairy Cookie, Sea Fairy Cookie",
	);
	expect(described[8]).toBe(described[7]);
});

test("an empty field reads as None rather than as a blank", () => {
	const described = hints("1S00000000");

	expect(described[6]).toBe("Slot 7 · Random boost · None");
	expect(described[9]).toBe("Slot 10 · Action · No action");
});

// The two reserved characters share a group of their own: they say the same
// nothing, and no control owns them.
test("characters of one field share a group, and neighbouring fields do not", () => {
	expect(groups("1S00000000")).toEqual([
		"version",
		"type",
		"episode",
		"boosts",
		"reserved",
		"reserved",
		"randomBoost",
		"cookiePowers",
		"cookiePowers",
		"action",
	]);
});

test("a loadout section is hinted group by group, separator included", () => {
	const code = "1C00P02-1S00000000";
	const described = hintsFor(code);

	expect(described).toHaveLength(code.length);
	expect(described[0]?.hint).toBe("Loadout version");
	expect(described[1]?.hint).toBe("Cookie · GingerBrave");
	expect(described[3]?.hint).toBe(described[1]?.hint);
	expect(described[4]?.hint).toContain("Pet · ");
	expect(described[7]?.hint).toBe("Separates the loadout from the combi name");
	expect(described[8]?.hint).toBe("Slot 1 · Format version");
});

test("every character of a treasure group shares the treasure hint", () => {
	const described = hintsFor("1TU000.001-1S00000000");
	const treasure = described.slice(1, 10);

	expect(new Set(treasure.map(({ group }) => group))).toEqual(
		new Set(["treasures"]),
	);
	expect(treasure[0]?.hint).toContain("Treasures · ");
});

test("a code that cannot be decoded gets no hints at all", () => {
	expect(hintsFor("1Z00000000")).toEqual([]);
	expect(hintsFor("1S0")).toEqual([]);
});
