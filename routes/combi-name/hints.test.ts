import { expect, test } from "bun:test";

import { hintsFor } from "./hints.ts";

function hints(code: string): string[] {
	return hintsFor(code).map(({ hint }) => hint);
}

function groups(code: string): string[] {
	return hintsFor(code).map(({ group }) => group);
}

test("one hint per character of the code", () => {
	const code = "1S0---000-";
	const described = hintsFor(code);

	expect(described).toHaveLength(code.length);
	expect(described.map(({ char }) => char).join("")).toBe(code);
});

test("each slot names its number, its field and what it currently says", () => {
	const [version, type, episode] = hints("1E3-PF400J");

	expect(version).toBe("Slot 1 · Format version");
	expect(type).toBe("Slot 2 · Type · Exp");
	expect(episode).toBe("Slot 3 · Episode · Episode 3");
});

test("a boost slot names its own boost and whether it is on", () => {
	const [, , , hp, jelly, fast] = hints("1E3-PF400J");

	expect(hp).toBe("Slot 4 · Boost · HP Extension: off");
	expect(jelly).toBe("Slot 5 · Boost · Power Jelly Boost: on");
	expect(fast).toBe("Slot 6 · Boost · Fast Start: on");
});

test("the two cookie power+ characters share one hint over the whole mask", () => {
	const described = hints("1S0---014-");

	expect(described[7]).toBe(
		"Slots 8-9 · Cookie power+ · Fairy Cookie, Sea Fairy Cookie",
	);
	expect(described[8]).toBe(described[7]);
});

test("an empty field reads as None rather than as a blank", () => {
	const described = hints("1S0---000-");

	expect(described[6]).toBe("Slot 7 · Random boost · None");
	expect(described[9]).toBe("Slot 10 · Action · No action");
});

// Each boost slot is its own group: three characters that say three different
// things cannot share one label.
test("characters of one field share a group, and neighbouring fields do not", () => {
	expect(groups("1S0---000-")).toEqual([
		"version",
		"type",
		"episode",
		"boost1",
		"boost2",
		"boost3",
		"randomBoost",
		"cookiePowers",
		"cookiePowers",
		"action",
	]);
});

test("a loadout section is hinted group by group, separator included", () => {
	const code = "1C00P02.1S0---000-";
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
	const described = hintsFor("1TU000-001.1S0---000-");
	const treasure = described.slice(1, 10);

	expect(new Set(treasure.map(({ group }) => group))).toEqual(
		new Set(["treasures"]),
	);
	expect(treasure[0]?.hint).toContain("Treasures · ");
});

test("a code that cannot be decoded gets no hints at all", () => {
	expect(hintsFor("1Z0---000-")).toEqual([]);
	expect(hintsFor("1S0")).toEqual([]);
});
