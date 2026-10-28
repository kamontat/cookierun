import { expect, test } from "bun:test";

import { hintsFor } from "./hints";

function hints(code: string): string[] {
	return hintsFor(code).map(({ hint }) => hint);
}

function groups(code: string): string[] {
	return hintsFor(code).map(({ group }) => group);
}

test("one hint per character of the code", () => {
	const code = "0S0000000";
	const described = hintsFor(code);

	expect(described).toHaveLength(code.length);
	expect(described.map(({ char }) => char).join("")).toBe(code);
});

test("each slot names its number, its field and what it currently says", () => {
	const [mode, goal, episode] = hints("HE34R000J");

	expect(mode).toBe("Slot 1 · Mode · Semi-auto");
	expect(goal).toBe("Slot 2 · Goal · Exp");
	expect(episode).toBe("Slot 3 · Episode · Episode 3");
});

test("the goal slot names every goal the run aims for", () => {
	expect(hints("A40000000")[1]).toBe("Slot 2 · Goal · Money + Exp");
	expect(hints("A00000000")[1]).toBe("Slot 2 · Goal · Any goal");
});

test("the boost slot names every boost that is on", () => {
	expect(hints("HE34R000J")[3]).toBe(
		"Slot 4 · Boosts · Power Jelly Boost, Fast Start",
	);
	expect(hints("AE3A0000J")[3]).toBe(
		"Slot 4 · Boosts · HP Extension, Power Jelly Boost, Fast Start, Double XP",
	);
});

test("a boost slot with nothing on reads as None", () => {
	expect(hints("AE30R000J")[3]).toBe("Slot 4 · Boosts · None");
});

test("the three cookie power+ characters share one hint over the whole list", () => {
	const described = hints("0S000FW00");

	expect(described[5]).toBe(
		"Slots 6-8 · Cookie power+ · Fairy Cookie, Sea Fairy Cookie",
	);
	expect(described[7]).toBe(described[5]);
});

test("an empty field reads as None rather than as a blank", () => {
	const described = hints("0S0000000");

	expect(described[4]).toBe("Slot 5 · Random boost · None");
	expect(described[8]).toBe("Slot 9 · Action · No action");
});

test("characters of one field share a group, and neighbouring fields do not", () => {
	expect(groups("0S0000000")).toEqual([
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
	const described = hintsFor("AMT042000");

	expect(described.slice(3, 6).map(({ hint }) => hint)).toEqual(
		Array(3).fill("Slots 4-6 · Floor · Floor 42"),
	);
	expect(described[3]?.group).toBe("floor");
	expect(described[6]?.hint).toBe("Slots 7-8 · Reserved");
	expect(hints("AMT000000")[3]).toBe("Slots 4-6 · Floor · Any floor");
});

test("a special episode with no boosts says so over slots 4-8", () => {
	const described = hintsFor("AMC000000");

	expect(described[3]?.hint).toBe(
		"Slots 4-8 · Boosts · Not used in this episode",
	);
	expect(described[7]?.hint).toBe(described[3]?.hint);
	expect(described[8]?.group).toBe("action");
});

// The version lives in the full code alone, as the first character before the
// loadout, so a bare combi has none to hint.
test("the full code's first character is the format version", () => {
	const described = hintsFor("1-0S0000000");

	expect(described[0]).toMatchObject({
		char: "1",
		hint: "Format version",
		group: "version",
	});
	expect(described[1]?.hint).toBe("Separates the loadout from the combi name");
	expect(described[2]?.hint).toBe("Slot 1 · Mode · Manual");
});

test("a loadout section is hinted group by group, separator included", () => {
	const code = "1C01P06-0S0000000";
	const described = hintsFor(code);

	expect(described).toHaveLength(code.length);
	expect(described[0]?.hint).toBe("Format version");
	expect(described[1]?.hint).toBe("Cookie · GingerBrave");
	expect(described[3]?.hint).toBe(described[1]?.hint);
	expect(described[4]?.hint).toContain("Pet · ");
	expect(described[7]?.hint).toBe("Separates the loadout from the combi name");
	expect(described[8]?.hint).toBe("Slot 1 · Mode · Manual");
});

test("a treasure group is one run for the order and one per slot", () => {
	const described = hintsFor("1TU001.002-0S0000000");
	const groups = described.slice(1, 10).map(({ group }) => group);

	// The . closing a slot belongs to the slot before it.
	expect(groups).toEqual([
		"treasureOrder",
		"treasureOrder",
		"treasure1",
		"treasure1",
		"treasure1",
		"treasure1",
		"treasure2",
		"treasure2",
		"treasure2",
	]);
	expect(described[1]?.hint).toContain("Treasures · ");
	expect(described[3]?.hint).toContain("Treasures · ");
});

test("every run carries a short name: its slot and field, no value", () => {
	const combi = hintsFor("AMT000000");
	expect(combi[0]?.name).toBe("Slot 1 · Mode");
	expect(combi[3]?.name).toBe("Slots 4-6 · Floor");

	const full = hintsFor("1C01TU001.002-0S0000000");
	expect(full[1]?.name).toBe("Cookie");
	expect(full[4]?.name).toBe("Treasure order");
	expect(full[6]?.name).toBe("Treasure slot 1");
	expect(full[10]?.name).toBe("Treasure slot 2");
});

test("a code that cannot be decoded gets no hints at all", () => {
	expect(hintsFor("0Z0000000")).toEqual([]);
	expect(hintsFor("1S0")).toEqual([]);
});
