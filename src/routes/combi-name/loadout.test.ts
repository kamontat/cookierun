import { expect, test } from "bun:test";

import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
	levelRange,
	levelRuns,
	type TreasurePick,
	treasurePick,
} from "./loadout";

const t = (id: string, min = 0, max = min): TreasurePick =>
	treasurePick(id, levelRange(min, max));

function loadout(over: Partial<Loadout> = {}): Loadout {
	return { ...emptyLoadout(), ...over };
}

test("an empty loadout is recognised as empty", () => {
	expect(isEmptyLoadout(emptyLoadout())).toBe(true);
	expect(isEmptyLoadout(loadout({ cookie: "01" }))).toBe(false);
	expect(isEmptyLoadout(loadout({ treasures: [[t("001")]] }))).toBe(false);
});

test("each group carries its tag, and an unset field is left out", () => {
	expect(encodeLoadout(loadout({ cookie: "2L" }))).toBe("1C2L");
	expect(encodeLoadout(loadout({ pet: "1Y" }))).toBe("1P1Y");
	expect(encodeLoadout(loadout({ cookie: "01", relay: "02", pet: "06" }))).toBe(
		"1C01R02P06",
	);
});

// "Any cookie" is a thing a build says, and the only way to say it is to carry
// it: a slot left unset means the build did not mention it at all.
test("a cookie, relay or pet slot carries the Any id like any other", () => {
	const code = encodeLoadout(loadout({ cookie: "__", relay: "__", pet: "__" }));

	expect(code).toBe("1C__R__P__");
	expect(decodeLoadout(code)).toEqual(
		loadout({ cookie: "__", relay: "__", pet: "__" }),
	);
	expect(isEmptyLoadout(loadout({ cookie: "__" }))).toBe(false);
});

// The sentinel belongs to the three single slots. A treasure slot already
// holds a list of alternatives, which is a different idea and a different
// design; nothing should be able to smuggle one in through T.
test("a treasure slot refuses the Any id", () => {
	expect(() => encodeLoadout(loadout({ treasures: [[t("___")]] }))).toThrow(
		'"___" is not 3 characters of [0-9A-Z]',
	);
	// On the wire `_` is also the alternative separator, so the would-be
	// sentinel falls apart into empty ids before it could be read as one.
	expect(() => decodeLoadout("1TU___")).toThrow(
		'"" is not 3 characters of [0-9A-Z]',
	);
});

test("groups are written in C R P T order", () => {
	const code = encodeLoadout(
		loadout({ cookie: "01", relay: "02", pet: "06", treasures: [[t("001")]] }),
	);
	expect(code).toBe("1C01R02P06TU001");
});

test("alternatives within a slot are joined by _ and sorted", () => {
	expect(encodeLoadout(loadout({ treasures: [[t("0G2"), t("098")]] }))).toBe(
		"1TU098_0G2",
	);
});

test("slots are joined by - and sorted when order does not matter", () => {
	expect(
		encodeLoadout(
			loadout({ treasures: [[t("0G1")], [t("001")]], ordered: false }),
		),
	).toBe("1TU001.0G1");
});

test("slots sharing their smallest id sort the same way whichever order they arrive in", () => {
	const one = encodeLoadout(
		loadout({
			treasures: [
				[t("002"), t("001")],
				[t("001"), t("003")],
			],
		}),
	);
	const other = encodeLoadout(
		loadout({
			treasures: [
				[t("001"), t("003")],
				[t("002"), t("001")],
			],
		}),
	);

	expect(one).toBe(other);
	expect(one).toBe("1TU001_002.001_003");
});

test("slot order is preserved when order matters", () => {
	expect(
		encodeLoadout(
			loadout({ treasures: [[t("0G1")], [t("001")]], ordered: true }),
		),
	).toBe("1TO0G1.001");
});

// With one slot there is nothing to order, so O would be a second code for the
// same build.
test("a single slot is always written U", () => {
	expect(
		encodeLoadout(loadout({ treasures: [[t("001")]], ordered: true })),
	).toBe("1TU001");
});

test("decoding reads every group back", () => {
	expect(decodeLoadout("1C01R02P06TO0G1.001_0G2")).toEqual({
		cookie: "01",
		relay: "02",
		pet: "06",
		treasures: [[t("0G1")], [t("001"), t("0G2")]],
		ordered: true,
	});
});

test("a non-canonical code decodes as written and re-encodes canonically", () => {
	const decoded = decodeLoadout("1TU0G1.001");
	expect(decoded.treasures).toEqual([[t("0G1")], [t("001")]]);
	expect(encodeLoadout(decoded)).toBe("1TU001.0G1");
});

test("the version character is checked", () => {
	expect(() => decodeLoadout("2C00")).toThrow(
		'unsupported loadout version "2"',
	);
	expect(() => decodeLoadout("")).toThrow("loadout section is empty");
});

test("an unknown group tag is rejected", () => {
	expect(() => decodeLoadout("1X00")).toThrow('unknown loadout group "X"');
});

test("a repeated group is rejected", () => {
	expect(() => decodeLoadout("1C01C02")).toThrow(
		'loadout group "C" appears twice',
	);
});

test("groups out of C R P T order are rejected", () => {
	expect(() => decodeLoadout("1P06C01")).toThrow(
		'loadout group "C" is out of order, expected C R P T',
	);
});

test("an id of the wrong width or shape is rejected", () => {
	expect(() => decodeLoadout("1C0")).toThrow(
		'loadout group "C": "0" is not 2 characters of [0-9A-Z]',
	);
	expect(() => decodeLoadout("1TU00")).toThrow(
		'loadout group "T": "00" is not 3 characters of [0-9A-Z]',
	);
});

test("an id absent from the catalog is rejected", () => {
	expect(() => decodeLoadout("1CZZ")).toThrow(
		'loadout group "C": no cookie has id "ZZ"',
	);
	expect(() => decodeLoadout("1TUZZZ")).toThrow(
		'loadout group "T": no treasure has id "ZZZ"',
	);
});

test("the order flag has to be U or O", () => {
	expect(() => decodeLoadout("1TX000")).toThrow(
		'loadout group "T": order flag "X" is neither "U" nor "O"',
	);
	expect(() => decodeLoadout("1T")).toThrow(
		'loadout group "T": missing the order flag',
	);
});

test("more than three slots is rejected", () => {
	expect(() => decodeLoadout("1TU001.002.003.004")).toThrow(
		'loadout group "T": 4 treasure slots, at most 3 fit',
	);
});

test("an empty slot is rejected", () => {
	expect(() => decodeLoadout("1TU001..002")).toThrow(
		'loadout group "T": slot 2 is empty',
	);
});

// On the wire an id repeats within a slot to list another run of its levels,
// so decoding merges the copies. A Loadout holds each treasure once per slot,
// so encoding one that lists an id twice is still an error.
test("a repeated id within one slot merges on decode, is rejected on encode, and may repeat across slots", () => {
	expect(decodeLoadout("1TU001_001").treasures).toEqual([[t("001")]]);
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("001"), t("001", 3)]] })),
	).toThrow('loadout group "T": slot 1 lists "001" twice');
	expect(decodeLoadout("1TU001.001").treasures).toEqual([
		[t("001")],
		[t("001")],
	]);
});

test("encoding validates the same rules as decoding", () => {
	expect(() => encodeLoadout(loadout({ cookie: "ZZ" }))).toThrow(
		'loadout group "C": no cookie has id "ZZ"',
	);
	expect(() =>
		encodeLoadout(
			loadout({
				treasures: [[t("001")], [t("002")], [t("003")], [t("004")]],
			}),
		),
	).toThrow('loadout group "T": 4 treasure slots, at most 3 fit');
	expect(() => encodeLoadout(loadout({ treasures: [[]] }))).toThrow(
		'loadout group "T": slot 1 is empty',
	);
});

test("a level is written after its id: none for +0, one digit, or a range", () => {
	expect(encodeLoadout(loadout({ treasures: [[t("098")]] }))).toBe("1TU098");
	expect(encodeLoadout(loadout({ treasures: [[t("098", 5)]] }))).toBe(
		"1TU0985",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("098", 5, 8)]] }))).toBe(
		"1TU09858",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("098", 0, 9)]] }))).toBe(
		"1TU09809",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("098", 9)]] }))).toBe(
		"1TU0989",
	);
});

test("each alternative carries its own level", () => {
	const code = encodeLoadout(
		loadout({ treasures: [[t("0G2", 5, 9), t("098")], [t("0G1", 9)]] }),
	);

	expect(code).toBe("1TU098_0G259.0G19");
	expect(decodeLoadout(code).treasures).toEqual([
		[t("098"), t("0G2", 5, 9)],
		[t("0G1", 9)],
	]);
});

// Every code written before levels existed must keep its meaning and its code.
test("codes without levels read as +0 and keep their code", () => {
	const decoded = decodeLoadout("1TU098_0G2.0G1");

	expect(decoded.treasures).toEqual([[t("098"), t("0G2")], [t("0G1")]]);
	expect(encodeLoadout(decoded)).toBe("1TU098_0G2.0G1");
});

test("a non-canonical level decodes and re-encodes short", () => {
	expect(encodeLoadout(decodeLoadout("1TU09800"))).toBe("1TU098");
	expect(encodeLoadout(decodeLoadout("1TU0980"))).toBe("1TU098");
	expect(encodeLoadout(decodeLoadout("1TU09855"))).toBe("1TU0985");
});

// Same ids, different levels: two different slots, which must not tie in the
// sort or one build would have two codes.
test("slots differing only in level still sort to one code", () => {
	const one = encodeLoadout(
		loadout({ treasures: [[t("098", 3)], [t("098", 1)]] }),
	);
	const other = encodeLoadout(
		loadout({ treasures: [[t("098", 1)], [t("098", 3)]] }),
	);

	expect(one).toBe(other);
	expect(one).toBe("1TU0981.0983");
});

test("a malformed level is rejected", () => {
	expect(() => decodeLoadout("1TU098123")).toThrow(
		'loadout group "T": "098123" has level "123", expected at most two digits',
	);
	expect(() => decodeLoadout("1TU098X")).toThrow(
		'loadout group "T": "098X" has level "X", expected at most two digits',
	);
	expect(() => decodeLoadout("1TU09895")).toThrow(
		'loadout group "T": "098" level runs backwards, 9-5',
	);
});

test("encoding validates levels the same way", () => {
	expect(() =>
		encodeLoadout(loadout({ treasures: [[treasurePick("098", [])]] })),
	).toThrow('loadout group "T": "098" accepts no level');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("098", 0, 10)]] })),
	).toThrow('loadout group "T": "098" level 10 is outside 0-9');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("098", 1.5)]] })),
	).toThrow('loadout group "T": "098" level 1.5 is outside 0-9');
});

test("copies of one id in a slot merge on decode", () => {
	expect(decodeLoadout("1TU0981_0982").treasures).toEqual([[t("098", 1, 2)]]);
	expect(encodeLoadout(decodeLoadout("1TU0981_0982"))).toBe("1TU09812");
});

const SPLIT = [0, 1, 2, 5, 6, 7, 8, 9];

test("a treasure whose levels are not one run is written as one copy per run", () => {
	expect(
		encodeLoadout(loadout({ treasures: [[treasurePick("098", SPLIT)]] })),
	).toBe("1TU09802_09859");
	expect(
		encodeLoadout(loadout({ treasures: [[treasurePick("098", [9, 0])]] })),
	).toBe("1TU098_0989");
	expect(decodeLoadout("1TU09802_09859").treasures).toEqual([
		[treasurePick("098", SPLIT)],
	]);
});

test("a pick's copies sit together among the other alternatives", () => {
	const code = encodeLoadout(
		loadout({
			treasures: [[t("0G2", 3), treasurePick("098", SPLIT)], [t("0G1", 9)]],
		}),
	);

	expect(code).toBe("1TU09802_09859_0G23.0G19");
	expect(decodeLoadout(code).treasures).toEqual([
		[treasurePick("098", SPLIT), t("0G2", 3)],
		[t("0G1", 9)],
	]);
});

test("unsorted or repeated levels encode canonically", () => {
	expect(
		encodeLoadout(
			loadout({ treasures: [[treasurePick("098", [7, 5, 6, 5])]] }),
		),
	).toBe("1TU09857");
});

test("copies merge whether they overlap, touch or arrive out of order", () => {
	expect(encodeLoadout(decodeLoadout("1TU09803_09825"))).toBe("1TU09805");
	expect(encodeLoadout(decodeLoadout("1TU09802_09835"))).toBe("1TU09805");
	expect(encodeLoadout(decodeLoadout("1TU09859_09802"))).toBe("1TU09802_09859");
	expect(decodeLoadout("1TU098_098").treasures).toEqual([[t("098")]]);
});

// "09818" sorts before "098_0989" because "1" (0x31) is below "_" (0x5F).
test("a slot with split runs still sorts to one code among unordered slots", () => {
	const split = treasurePick("098", [0, 9]);
	const run = t("098", 1, 8);
	const one = encodeLoadout(loadout({ treasures: [[split], [run]] }));
	const other = encodeLoadout(loadout({ treasures: [[run], [split]] }));

	expect(one).toBe(other);
	expect(one).toBe("1TU09818.098_0989");
});

test("levelRuns reads a level set as its runs", () => {
	expect(levelRuns([0, 1, 2, 5, 6, 7, 8, 9])).toEqual([
		[0, 2],
		[5, 9],
	]);
	expect(levelRuns([9, 0, 0])).toEqual([
		[0, 0],
		[9, 9],
	]);
	expect(levelRuns([])).toEqual([]);
});
