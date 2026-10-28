import { expect, test } from "bun:test";

import {
	ALL_BOOSTS,
	ALL_COOKIE_POWERS,
	ALL_GOALS,
	type Boost,
	type Combi,
	decode,
	encode,
	isSemiAuto,
	normalize,
} from "./codec";

const fullAuto: Combi = {
	goals: ["money"],
	mode: "auto",
	episode: "any",
	floor: null,
	boosts: ["hpExtension"],
	randomBoost: null,
	cookiePowers: [],
	action: "none",
};

const manual: Combi = { ...fullAuto, goals: ["score"], mode: "manual" };

test("encodes a manual score combi with three boosts and two cookie powers", () => {
	const code = encode({
		...manual,
		boosts: ["hpExtension", "powerJellyBoost", "fastStart"],
		cookiePowers: ["fairy", "seaFairy"],
	});

	expect(code).toBe("0S070FW00");
});

test("decodes every slot back into a combi", () => {
	const { combi } = decode("HE34RC0EJ");

	expect(combi).toEqual({
		goals: ["exp"],
		mode: "semiauto",
		episode: "episode3",
		floor: null,
		boosts: ["powerJellyBoost", "fastStart"],
		randomBoost: "revive",
		cookiePowers: ["cheerleader", "expParty"],
		action: "jumpAtStart",
	});
});

// Every one of the sixteen sets has a character of its own, and no two share.
test("every boost set has its own character and reads back as itself", () => {
	const codes = new Set<string>();

	for (let mask = 0; mask < 1 << ALL_BOOSTS.length; mask++) {
		const boosts = ALL_BOOSTS.filter((_, index) => (mask & (1 << index)) !== 0);
		const code = encode({ ...manual, boosts });
		codes.add(code[3] as string);
		expect(decode(code).combi.boosts).toEqual(boosts);
	}

	expect(codes.size).toBe(16);
});

test("a single boost is its own letter, and all four is A", () => {
	const letter = (boosts: Boost[]) => encode({ ...manual, boosts })[3];

	expect(letter([])).toBe("0");
	expect(letter(["hpExtension"])).toBe("H");
	expect(letter(["powerJellyBoost"])).toBe("P");
	expect(letter(["fastStart"])).toBe("F");
	expect(letter(["doubleXp"])).toBe("X");
	expect(
		letter(["hpExtension", "powerJellyBoost", "fastStart", "doubleXp"]),
	).toBe("A");
});

test("each group of cookie powers has a slot of its own", () => {
	expect(
		encode({
			...manual,
			boosts: [],
			cookiePowers: ["expParty", "cheerleader"],
		}),
	).toBe("0S000C0E0");
});

// A whole group on is A, as all four boosts and all four goals are.
test("every cookie power at once is AAA", () => {
	const code = encode({
		...manual,
		boosts: [],
		cookiePowers: ALL_COOKIE_POWERS,
	});

	expect(code).toBe("0S000AAA0");
	expect(decode(code).combi.cookiePowers).toEqual(ALL_COOKIE_POWERS);
});

test("a group's old all-on characters no longer read", () => {
	expect(() => decode("0S0004000")).toThrow(
		'slot 6 (cookie power+): unknown char "4"',
	);
	expect(() => decode("0S0000100")).toThrow(
		'slot 7 (cookie power+): unknown char "1"',
	);
	expect(() => decode("0S0000010")).toThrow(
		'slot 8 (cookie power+): unknown char "1"',
	);
});

test("every set of cookie powers has its own code and reads back as itself", () => {
	const codes = new Set<string>();

	for (let mask = 0; mask < 1 << ALL_COOKIE_POWERS.length; mask++) {
		const cookiePowers = ALL_COOKIE_POWERS.filter(
			(_, index) => (mask & (1 << index)) !== 0,
		);
		const code = encode({ ...manual, boosts: [], cookiePowers });
		codes.add(code.slice(5, 8));
		expect(decode(code).combi.cookiePowers).toEqual(cookiePowers);
	}

	expect(codes.size).toBe(128);
});

test("rejects a power letter in another group's slot", () => {
	expect(() => decode("0S000K000")).toThrow(
		'slot 6 (cookie power+): unknown char "K"',
	);
});

test("Double XP alone leaves a run on full auto", () => {
	expect(isSemiAuto({ ...fullAuto, boosts: ["doubleXp"] })).toBe(false);
});

test("rejects an unknown boost set character", () => {
	expect(() => decode("0S0Z00000")).toThrow(
		'slot 4 (boosts): unknown char "Z"',
	);
});

test("rejects a code that is not exactly 9 characters", () => {
	expect(() => decode("0S000000")).toThrow(
		'code must be exactly 9 characters, got 8: "0S000000"',
	);
});

// The version is the full code's, not the combi's: a ten-character code from
// before it moved there is the wrong length, not a version to read.
test("rejects a code that still carries the old version character", () => {
	expect(() => decode("10S0000000")).toThrow(
		"code must be exactly 9 characters, got 10",
	);
});

test("rejects an unknown char in a slot", () => {
	expect(() => decode("0Z0000000")).toThrow('slot 2 (goal): unknown char "Z"');
	expect(() => decode("ZS0000000")).toThrow('slot 1 (mode): unknown char "Z"');
	expect(() => decode("0SZ000000")).toThrow(
		'slot 3 (episode): unknown char "Z"',
	);
});

test("the special episodes read as letters from their names", () => {
	expect(encode({ ...manual, boosts: [], episode: "special1" })[2]).toBe("C");
	expect(encode({ ...manual, boosts: [], episode: "special2" })[2]).toBe("T");
	expect(encode({ ...manual, boosts: [], episode: "special3" })[2]).toBe("R");
	expect(encode({ ...manual, boosts: [], episode: "specialExp" })[2]).toBe("X");
});

test("the tower writes its floor in slots 4-6", () => {
	const tower: Combi = {
		...fullAuto,
		boosts: [],
		episode: "special2",
		floor: 42,
	};

	expect(encode(tower)).toBe("AMT042000");
	expect(decode("AMT042000").combi).toEqual(tower);
	expect(encode({ ...tower, floor: 100 })).toBe("AMT100000");
});

test("a tower with no floor picked is any floor, 000", () => {
	const { combi } = decode("AMT000000");

	expect(combi.floor).toBeNull();
	expect(encode(combi)).toBe("AMT000000");
});

test("rejects a tower floor that is not one", () => {
	expect(() => decode("AMT101000")).toThrow(
		"slots 4-6 (floor): 101 is above 100",
	);
	expect(() => decode("AMTH00000")).toThrow(
		'slots 4-6 (floor): "H00" is not 3 digits',
	);
	expect(() => decode("AMT001X00")).toThrow("slots 7-8");
});

test("a floor means nothing outside the tower and is dropped", () => {
	expect(normalize({ ...manual, floor: 12 }).floor).toBeNull();
});

test("the special episodes drop boosts, random boost and cookie power+", () => {
	const loaded: Combi = {
		...fullAuto,
		episode: "special1",
		boosts: ["hpExtension", "fastStart"],
		randomBoost: "revive",
		cookiePowers: ["fairy"],
	};

	expect(encode(loaded)).toBe("AMC000000");
	expect(encode({ ...loaded, episode: "specialExp" })).toBe("AMX000000");
	expect(encode({ ...loaded, episode: "special2" })).toBe("AMT000000");
	// Special Episode 3 is an ordinary run.
	expect(encode({ ...loaded, episode: "special3" })).toBe("HMR2RF000");
});

test("decode drops what a special episode has no room for, with a warning", () => {
	const { combi, warnings } = decode("AMXHR0000");

	expect(combi.boosts).toEqual([]);
	expect(combi.randomBoost).toBeNull();
	expect(warnings).toEqual([
		"this episode takes no boosts, random boost, or cookie power+ — ignoring them",
	]);
});

test("a manual run carries no action", () => {
	expect(encode({ ...manual, action: "jumpAtStart" })).toBe("0S0H00000");

	const { combi, warnings } = decode("0S0H0000J");
	expect(combi.action).toBe("none");
	expect(warnings).toEqual([
		"slot 9 sets an action but the run is played by hand — ignoring it",
	]);
});

test("an auto run aiming for Score decodes, with a warning", () => {
	const { combi, warnings } = decode("AS0H00000");

	expect(combi.goals).toEqual(["score"]);
	expect(warnings).toEqual([
		"slot 2 says Score but an auto run aims for Money, Exp, or Box — Score is played by hand",
	]);
});

test("an auto run aiming for Score among others decodes, with a warning", () => {
	const { combi, warnings } = decode("A10H00000");

	expect(combi.goals).toEqual(["score", "money"]);
	expect(warnings).toEqual([
		"slot 2 says Score but an auto run aims for Money, Exp, or Box — Score is played by hand",
	]);
});

// Any is an auto run that specialises in nothing: slot 2 reads 0. The page no
// longer offers it, but a code written before still says it.
test("an auto run aiming for nothing in particular writes 0 into slot 2", () => {
	const code = encode({ ...fullAuto, goals: [] });

	expect(code).toBe("A00H00000");
	expect(decode(code)).toEqual({
		combi: { ...fullAuto, goals: [] },
		warnings: [],
	});
});

test("a manual run aiming for Any decodes, with a warning", () => {
	expect(decode("000000000").warnings).toEqual([
		"slot 2 says Any but a run played by hand aims for Score, Money, Exp, or Box",
	]);
});

// A lone goal keeps the letter it always had, so every code written before
// goals became a set still reads as it did.
test("a single goal is its own letter", () => {
	expect(
		(["score", "money", "exp", "box"] as const).map(
			(goal) => encode({ ...manual, goals: [goal] })[1],
		),
	).toEqual(["S", "M", "E", "B"]);
});

test("encodes a set of goals in one character, whatever order it came in", () => {
	expect(encode({ ...manual, goals: ["exp", "score"] })).toBe("020H00000");
	expect(encode({ ...manual, goals: ["money", "exp", "box"] })).toBe(
		"0C0H00000",
	);
	expect(encode({ ...manual, goals: ["box", "exp", "money", "score"] })).toBe(
		"0A0H00000",
	);
});

test("every goal set has its own character and reads back as itself", () => {
	const chars = new Set<string>();

	for (let mask = 0; mask < 1 << ALL_GOALS.length; mask++) {
		const goals = ALL_GOALS.filter((_, index) => (mask & (1 << index)) !== 0);
		const code = encode({ ...manual, goals });
		chars.add(code[1] as string);
		expect(decode(code).combi.goals).toEqual(goals);
	}

	expect(chars.size).toBe(16);
});

test("no fast start, random boost, or action is full auto", () => {
	expect(isSemiAuto(fullAuto)).toBe(false);
});

test("fast start alone makes it semi-auto", () => {
	expect(
		isSemiAuto({ ...fullAuto, boosts: ["hpExtension", "fastStart"] }),
	).toBe(true);
});

test("a random boost alone makes it semi-auto", () => {
	expect(isSemiAuto({ ...fullAuto, randomBoost: "pitLifts" })).toBe(true);
});

test("a jump action alone makes it semi-auto", () => {
	expect(isSemiAuto({ ...fullAuto, action: "jumpAtStart" })).toBe(true);
});

test("encode writes H when an auto combi needs manual work", () => {
	const code = encode({
		...fullAuto,
		episode: "episode3",
		boosts: ["hpExtension", "fastStart"],
	});

	expect(code).toBe("HM3200000");
});

test("encode writes A when a semiauto combi needs no manual work", () => {
	const code = encode({ ...fullAuto, mode: "semiauto", episode: "episode3" });

	expect(code).toBe("AM3H00000");
});

test("encode leaves a manual run alone", () => {
	const code = encode({
		...manual,
		episode: "episode3",
		boosts: ["fastStart"],
	});

	expect(code).toBe("0S3F00000");
});

test("decode warns when the mode slot says Auto but manual work is present", () => {
	const { combi, warnings } = decode("AM32R0000");

	expect(combi.mode).toBe("auto");
	expect(warnings).toEqual([
		"slot 1 says Auto but Fast Start, a random boost, or an action is present — treating as Semi-auto",
	]);
});

test("decode warns when the mode slot says Semi-auto but nothing is manual", () => {
	const { combi, warnings } = decode("HM3H00000");

	expect(combi.mode).toBe("semiauto");
	expect(warnings).toEqual([
		"slot 1 says Semi-auto but there is no Fast Start, random boost, or action",
	]);
});

test("decode stays quiet when the mode slot agrees with the flag slots", () => {
	expect(decode("HM32R0000").warnings).toEqual([]);
});

test("decode stays quiet for a manual run regardless of the flag slots", () => {
	expect(decode("0S3F00000").warnings).toEqual([]);
});
