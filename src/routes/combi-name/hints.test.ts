import { expect, test } from "bun:test";

import { hintsFor } from "./hints";

function hints(code: string): string[] {
	return hintsFor(code).map(({ hint }) => hint);
}

function groups(code: string): string[] {
	return hintsFor(code).map(({ group }) => group);
}

test("one hint per character of the code", () => {
	const code = "10S0000000";
	const described = hintsFor(code);

	expect(described).toHaveLength(code.length);
	expect(described.map(({ char }) => char).join("")).toBe(code);
});

test("each slot names its number, its field and what it currently says", () => {
	const [version, mode, goal, episode] = hints("1HE34R000J");

	expect(version).toBe("Slot 1 · Format version");
	expect(mode).toBe("Slot 2 · Mode · Semi-auto");
	expect(goal).toBe("Slot 3 · Goal · Exp");
	expect(episode).toBe("Slot 4 · Episode · Episode 3");
});

test("the boost slot names every boost that is on", () => {
	expect(hints("1HE34R000J")[4]).toBe(
		"Slot 5 · Boosts · Power Jelly Boost, Fast Start",
	);
	expect(hints("1AE3A0000J")[4]).toBe(
		"Slot 5 · Boosts · HP Extension, Power Jelly Boost, Fast Start, Double XP",
	);
});

test("a boost slot with nothing on reads as None", () => {
	expect(hints("1AE30R000J")[4]).toBe("Slot 5 · Boosts · None");
});

test("the three cookie power+ characters share one hint over the whole list", () => {
	const described = hints("10S000FW00");

	expect(described[6]).toBe(
		"Slots 7-9 · Cookie power+ · Fairy Cookie, Sea Fairy Cookie",
	);
	expect(described[8]).toBe(described[6]);
});

test("an empty field reads as None rather than as a blank", () => {
	const described = hints("10S0000000");

	expect(described[5]).toBe("Slot 6 · Random boost · None");
	expect(described[9]).toBe("Slot 10 · Action · No action");
});

test("characters of one field share a group, and neighbouring fields do not", () => {
	expect(groups("10S0000000")).toEqual([
		"version",
		"mode",
		"goal",
		"episode",
		"boosts",
		"randomBoost",
		"cookiePowers",
		"cookiePowers",
		"cookiePowers",
		"action",
	]);
});

test("the tower's floor is one run, and what follows it is reserved", () => {
	const described = hintsFor("1AMT042000");

	expect(described.slice(4, 7).map(({ hint }) => hint)).toEqual(
		Array(3).fill("Slots 5-7 · Floor · Floor 42"),
	);
	expect(described[4]?.group).toBe("floor");
	expect(described[7]?.hint).toBe("Slots 8-9 · Reserved");
	expect(hints("1AMT000000")[4]).toBe("Slots 5-7 · Floor · Any floor");
});

test("a special episode with no boosts says so over slots 5-9", () => {
	const described = hintsFor("1AMC000000");

	expect(described[4]?.hint).toBe(
		"Slots 5-9 · Boosts · Not used in this episode",
	);
	expect(described[8]?.hint).toBe(described[4]?.hint);
	expect(described[9]?.group).toBe("action");
});

test("a loadout section is hinted group by group, separator included", () => {
	const code = "1C00P02-10S0000000";
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
	const described = hintsFor("1TU000.001-10S0000000");
	const treasure = described.slice(1, 10);

	expect(new Set(treasure.map(({ group }) => group))).toEqual(
		new Set(["treasures"]),
	);
	expect(treasure[0]?.hint).toContain("Treasures · ");
});

test("a code that cannot be decoded gets no hints at all", () => {
	expect(hintsFor("10Z0000000")).toEqual([]);
	expect(hintsFor("1S0")).toEqual([]);
});
