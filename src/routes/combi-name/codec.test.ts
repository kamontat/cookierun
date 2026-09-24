import { expect, test } from "bun:test";

import { type Combi, decode, encode, isSemiAuto } from "./codec";

const fullAuto: Combi = {
	type: "auto",
	episode: "any",
	boosts: ["hpExtension"],
	randomBoost: null,
	cookiePowers: [],
	action: "none",
};

test("encodes a score combi with all boosts and two cookie powers", () => {
	const code = encode({
		type: "score",
		episode: "any",
		boosts: ["hpExtension", "powerJellyBoost", "fastStart"],
		randomBoost: null,
		cookiePowers: ["fairy", "seaFairy"],
		action: "none",
	});

	expect(code).toBe("1S07000140");
});

test("decodes every slot back into a combi", () => {
	const { combi } = decode("1E3600400J");

	expect(combi).toEqual({
		type: "exp",
		episode: "episode3",
		boosts: ["powerJellyBoost", "fastStart"],
		randomBoost: "revive",
		cookiePowers: [],
		action: "jumpAtStart",
	});
});

test("every boost at once fills the mask", () => {
	const code = encode({
		...fullAuto,
		boosts: ["hpExtension", "powerJellyBoost", "fastStart", "doubleXp"],
	});

	expect(code).toBe("1H0F000000");
});

test("Double XP rides in the mask beside the others", () => {
	const code = encode({ ...fullAuto, boosts: ["hpExtension", "doubleXp"] });

	expect(code).toBe("1A09000000");
	expect(decode(code).combi.boosts).toEqual(["hpExtension", "doubleXp"]);
});

test("Double XP alone leaves a run on full auto", () => {
	expect(isSemiAuto({ ...fullAuto, boosts: ["doubleXp"] })).toBe(false);
});

test("rejects a boost mask that is not an uppercase hex digit", () => {
	expect(() => decode("1S0G000140")).toThrow(
		'slot 4 (boosts): "G" is not an uppercase hex digit',
	);
});

test("rejects anything written into the reserved slots", () => {
	expect(() => decode("1S07X00140")).toThrow(
		'slot 5 (reserved): unknown char "X", expected "0"',
	);
	expect(() => decode("1S070X0140")).toThrow(
		'slot 6 (reserved): unknown char "X", expected "0"',
	);
});

test("rejects a code that is not exactly 10 characters", () => {
	expect(() => decode("1S0700014")).toThrow(
		'code must be exactly 10 characters, got 9: "1S0700014"',
	);
});

test("rejects an unsupported version", () => {
	expect(() => decode("2S0HPF0140")).toThrow('unsupported version "2"');
});

test("rejects an unknown char in a slot", () => {
	expect(() => decode("1Z07000140")).toThrow('slot 2 (type): unknown char "Z"');
});

test("rejects a cookie power mask above 7F", () => {
	expect(() => decode("1S07000FF0")).toThrow(
		"slots 8-9 (cookie power+): mask FF exceeds 7F",
	);
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
		type: "auto",
		episode: "episode3",
		boosts: ["hpExtension", "fastStart"],
	});

	expect(code).toBe("1H35000000");
});

test("encode writes A when a semiauto combi needs no manual work", () => {
	const code = encode({ ...fullAuto, type: "semiauto", episode: "episode3" });

	expect(code).toBe("1A31000000");
});

test("encode leaves non-auto types alone", () => {
	const code = encode({
		...fullAuto,
		type: "score",
		episode: "episode3",
		boosts: ["fastStart"],
	});

	expect(code).toBe("1S34000000");
});

test("decode warns when the type slot says Auto but manual work is present", () => {
	const { combi, warnings } = decode("1A35004000");

	expect(combi.type).toBe("auto");
	expect(warnings).toEqual([
		"slot 2 says Auto but Fast Start, a random boost, or an action is present — treating as Semi-auto",
	]);
});

test("decode warns when the type slot says Semi-auto but nothing is manual", () => {
	const { combi, warnings } = decode("1H31000000");

	expect(combi.type).toBe("semiauto");
	expect(warnings).toEqual([
		"slot 2 says Semi-auto but there is no Fast Start, random boost, or action",
	]);
});

test("decode stays quiet when the type slot agrees with the flag slots", () => {
	expect(decode("1H35004000").warnings).toEqual([]);
});

test("decode stays quiet for non-auto types regardless of the flag slots", () => {
	expect(decode("1S34000000").warnings).toEqual([]);
});
