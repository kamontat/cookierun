import { expect, test } from "bun:test";

import {
	ALL_BOOSTS,
	ALL_COOKIE_POWERS,
	ALL_GOAL_SETS,
	ALL_RANDOM_BOOSTS,
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

	expect(code).toBe("MS0A800FW0");
});

test("decodes every slot back into a combi", () => {
	const { combi } = decode("JX035RVC0E");

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
		codes.add(code[4] as string);
		expect(decode(code).combi.boosts).toEqual(boosts);
	}

	expect(codes.size).toBe(16);
});

test("a single boost is its own letter, and all four is A", () => {
	const letter = (boosts: Boost[]) => encode({ ...manual, boosts })[4];

	expect(letter([])).toBe("0");
	expect(letter(["hpExtension"])).toBe("H");
	expect(letter(["powerJellyBoost"])).toBe("P");
	expect(letter(["fastStart"])).toBe("F");
	expect(letter(["doubleXp"])).toBe("X");
	expect(
		letter(["hpExtension", "powerJellyBoost", "fastStart", "doubleXp"]),
	).toBe("A");
});

// The pair most runs take, and that pair with Double XP, read as how many
// boosts they hold; the other combinations take the characters left over.
test("HP Extension and Power Jelly is 2, and with Double XP 3", () => {
	const letter = (boosts: Boost[]) => encode({ ...manual, boosts })[4];

	expect(letter(["hpExtension", "powerJellyBoost"])).toBe("2");
	expect(letter(["hpExtension", "powerJellyBoost", "doubleXp"])).toBe("3");
	expect(letter(["hpExtension", "fastStart"])).toBe("1");
	expect(letter(["hpExtension", "doubleXp"])).toBe("4");
	expect(letter(["powerJellyBoost", "fastStart", "doubleXp"])).toBe("B");
});

test("each group of cookie powers has a slot of its own", () => {
	expect(
		encode({
			...manual,
			boosts: [],
			cookiePowers: ["expParty", "cheerleader"],
		}),
	).toBe("MS0A000C0E");
});

// A whole group on is A, as all four boosts are.
test("every cookie power at once is AAA", () => {
	const code = encode({
		...manual,
		boosts: [],
		cookiePowers: ALL_COOKIE_POWERS,
	});

	expect(code).toBe("MS0A000AAA");
	expect(decode(code).combi.cookiePowers).toEqual(ALL_COOKIE_POWERS);
});

test("a group's old all-on characters no longer read", () => {
	expect(() => decode("MS0A000400")).toThrow(
		'slot 8 (cookie power+): unknown char "4"',
	);
	expect(() => decode("MS0A000010")).toThrow(
		'slot 9 (cookie power+): unknown char "1"',
	);
	expect(() => decode("MS0A000001")).toThrow(
		'slot 10 (cookie power+): unknown char "1"',
	);
});

test("every set of cookie powers has its own code and reads back as itself", () => {
	const codes = new Set<string>();

	for (let mask = 0; mask < 1 << ALL_COOKIE_POWERS.length; mask++) {
		const cookiePowers = ALL_COOKIE_POWERS.filter(
			(_, index) => (mask & (1 << index)) !== 0,
		);
		const code = encode({ ...manual, boosts: [], cookiePowers });
		codes.add(code.slice(7, 10));
		expect(decode(code).combi.cookiePowers).toEqual(cookiePowers);
	}

	expect(codes.size).toBe(128);
});

test("rejects a power letter in another group's slot", () => {
	expect(() => decode("MS0A000K00")).toThrow(
		'slot 8 (cookie power+): unknown char "K"',
	);
});

test("Double XP alone leaves a run on full auto", () => {
	expect(isSemiAuto({ ...fullAuto, boosts: ["doubleXp"] })).toBe(false);
});

test("rejects an unknown boost set character", () => {
	expect(() => decode("MS0AZ00000")).toThrow(
		'slot 5 (boosts): unknown char "Z"',
	);
});

test("rejects a code that is not exactly 10 characters", () => {
	expect(() => decode("MS0A00000")).toThrow(
		'code must be exactly 10 characters, got 9: "MS0A00000"',
	);
});

// The layout before this one is ten characters too, but none of its codes
// read: its mode slot was 0, A or H, and 0 is no mode now.
test("rejects a code in the previous layout", () => {
	expect(() => decode("10S0000000")).toThrow('slot 1 (mode): unknown char "1"');
	expect(() => decode("0S00000000")).toThrow('slot 1 (mode): unknown char "0"');
});

test("rejects unknown characters in a slot", () => {
	expect(() => decode("MZ0A000000")).toThrow(
		'slots 2-3 (goal): unknown chars "Z0"',
	);
	expect(() => decode("ZS0A000000")).toThrow('slot 1 (mode): unknown char "Z"');
	expect(() => decode("MS0Z000000")).toThrow(
		'slot 4 (episode): unknown char "Z"',
	);
	expect(() => decode("MS0A0ZZ000")).toThrow(
		'slots 6-7 (random boost): unknown chars "ZZ"',
	);
});

test("Any episode is A", () => {
	expect(encode(manual)[3]).toBe("A");
	expect(decode("MS0A000000").combi.episode).toBe("any");
});

// Two characters from each boost's name, or its number where it has one.
test("each random boost is its own two characters, and none is 00", () => {
	const chars = (randomBoost: Combi["randomBoost"]) =>
		encode({ ...manual, randomBoost }).slice(5, 7);

	expect(chars(null)).toBe("00");
	expect(ALL_RANDOM_BOOSTS.map(chars)).toEqual([
		"2C",
		"BS",
		"HD",
		"RV",
		"CC",
		"17",
		"GC",
		"CO",
		"PO",
		"MA",
		"PL",
	]);
	for (const randomBoost of ALL_RANDOM_BOOSTS) {
		expect(decode(encode({ ...manual, randomBoost })).combi.randomBoost).toBe(
			randomBoost,
		);
	}
});

test("the special episodes read as letters from their names", () => {
	expect(encode({ ...manual, boosts: [], episode: "special1" })[3]).toBe("C");
	expect(encode({ ...manual, boosts: [], episode: "special2" })[3]).toBe("T");
	expect(encode({ ...manual, boosts: [], episode: "special3" })[3]).toBe("R");
	expect(encode({ ...manual, boosts: [], episode: "specialExp" })[3]).toBe("X");
});

test("the tower writes its floor in slots 5-7", () => {
	const tower: Combi = {
		...fullAuto,
		boosts: [],
		episode: "special2",
		floor: 42,
	};

	expect(encode(tower)).toBe("AM0T042000");
	expect(decode("AM0T042000").combi).toEqual(tower);
	expect(encode({ ...tower, floor: 100 })).toBe("AM0T100000");
});

test("a tower with no floor picked is any floor, 000", () => {
	const { combi } = decode("AM0T000000");

	expect(combi.floor).toBeNull();
	expect(encode(combi)).toBe("AM0T000000");
});

test("rejects a tower floor that is not one", () => {
	expect(() => decode("AM0T101000")).toThrow(
		"slots 5-7 (floor): 101 is above 100",
	);
	expect(() => decode("AM0TH00000")).toThrow(
		'slots 5-7 (floor): "H00" is not 3 digits',
	);
	expect(() => decode("AM0T001X00")).toThrow("slots 8-10");
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

	expect(encode(loaded)).toBe("AM0C000000");
	expect(encode({ ...loaded, episode: "specialExp" })).toBe("AM0X000000");
	expect(encode({ ...loaded, episode: "special2" })).toBe("AM0T000000");
	// Special Episode 3 is an ordinary run.
	expect(encode({ ...loaded, episode: "special3" })).toBe("SM0R1RVF00");
});

test("decode drops what a special episode has no room for, with a warning", () => {
	const { combi, warnings } = decode("AM0XHRV000");

	expect(combi.boosts).toEqual([]);
	expect(combi.randomBoost).toBeNull();
	expect(warnings).toEqual([
		"this episode takes no boosts, random boost, or cookie power+ — ignoring them",
	]);
});

// A run played by hand has no starting action: M never jumps, and encoding a
// manual run drops one.
test("a manual run carries no action", () => {
	expect(encode({ ...manual, action: "jumpAtStart" })).toBe("MS0AH00000");
	expect(decode("MS0AH00000").combi.action).toBe("none");
});

// The jump has no slot of its own: J is a semi-auto run that jumps.
test("a jump at the start is J in the mode slot", () => {
	const code = encode({ ...fullAuto, action: "jumpAtStart" });

	expect(code).toBe("JM0AH00000");
	expect(decode(code)).toEqual({
		combi: { ...fullAuto, mode: "semiauto", action: "jumpAtStart" },
		warnings: [],
	});
	expect(
		encode({ ...fullAuto, randomBoost: "revive", action: "jumpAtStart" }),
	).toBe("JM0AHRV000");
});

test("each mode is a letter from its name", () => {
	expect(decode("MS0A000000").combi.mode).toBe("manual");
	expect(decode("AM0A000000").combi.mode).toBe("auto");
	expect(decode("SM0AF00000").combi.mode).toBe("semiauto");
	expect(decode("JM0A000000").combi).toMatchObject({
		mode: "semiauto",
		action: "jumpAtStart",
	});
});

test("an auto run aiming for Score decodes, with a warning", () => {
	const { combi, warnings } = decode("AS0AH00000");

	expect(combi.goals).toEqual(["score"]);
	expect(warnings).toEqual([
		"slots 2-3 say Score but an auto run aims for Money, Exp, or Box — Score is played by hand",
	]);
});

test("a single goal is a letter from its name, padded with 0", () => {
	expect(
		(["score", "money", "exp", "box"] as const).map((goal) =>
			encode({ ...manual, goals: [goal] }).slice(1, 3),
		),
	).toEqual(["S0", "M0", "X0", "B0"]);
});

test("a pair is its two letters and all three of Money, Exp and Box is AA", () => {
	const chars = (goals: Combi["goals"]) =>
		encode({ ...manual, goals }).slice(1, 3);

	expect(chars(["exp", "money"])).toBe("MX");
	expect(chars(["box", "money"])).toBe("MB");
	expect(chars(["box", "exp"])).toBe("XB");
	expect(chars(["box", "exp", "money"])).toBe("AA");
});

// Score is played for on its own, and a run always aims for something.
test("a set of goals no code can say is refused", () => {
	expect(() => encode({ ...manual, goals: ["score", "money"] })).toThrow(
		"goals must be Score alone or 1-3 of Money, Exp and Box",
	);
	expect(() => encode({ ...manual, goals: [] })).toThrow(
		"goals must be Score alone or 1-3 of Money, Exp and Box",
	);
});

test("every goal set has its own characters and reads back as itself", () => {
	const chars = new Set<string>();

	for (const goals of ALL_GOAL_SETS) {
		const code = encode({ ...manual, goals });
		chars.add(code.slice(1, 3));
		expect(decode(code).combi.goals).toEqual(goals);
	}

	expect(chars.size).toBe(8);
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

test("encode writes S when an auto combi needs manual work", () => {
	const code = encode({
		...fullAuto,
		episode: "episode3",
		boosts: ["hpExtension", "fastStart"],
	});

	expect(code).toBe("SM03100000");
});

test("encode writes A when a semiauto combi needs no manual work", () => {
	const code = encode({ ...fullAuto, mode: "semiauto", episode: "episode3" });

	expect(code).toBe("AM03H00000");
});

test("encode leaves a manual run alone", () => {
	const code = encode({
		...manual,
		episode: "episode3",
		boosts: ["fastStart"],
	});

	expect(code).toBe("MS03F00000");
});

test("decode warns when the mode slot says Auto but manual work is present", () => {
	const { combi, warnings } = decode("AM031RV000");

	expect(combi.mode).toBe("auto");
	expect(warnings).toEqual([
		"slot 1 says Auto but Fast Start or a random boost is present — treating as Semi-auto",
	]);
});

test("decode warns when the mode slot says Semi-auto but nothing is manual", () => {
	const { combi, warnings } = decode("SM03H00000");

	expect(combi.mode).toBe("semiauto");
	expect(warnings).toEqual([
		"slot 1 says Semi-auto but there is no Fast Start or random boost",
	]);
});

test("decode stays quiet when the mode slot agrees with the flag slots", () => {
	expect(decode("SM031RV000").warnings).toEqual([]);
});

test("decode stays quiet for a manual run regardless of the flag slots", () => {
	expect(decode("MS03F00000").warnings).toEqual([]);
});
