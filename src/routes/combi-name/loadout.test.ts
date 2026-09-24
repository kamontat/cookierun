import { expect, test } from "bun:test";

import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
	treasurePick,
} from "./loadout";

const t = treasurePick;

function loadout(over: Partial<Loadout> = {}): Loadout {
	return { ...emptyLoadout(), ...over };
}

test("an empty loadout is recognised as empty", () => {
	expect(isEmptyLoadout(emptyLoadout())).toBe(true);
	expect(isEmptyLoadout(loadout({ cookie: "00" }))).toBe(false);
	expect(isEmptyLoadout(loadout({ treasures: [[t("000")]] }))).toBe(false);
});

test("each group carries its tag, and an unset field is left out", () => {
	expect(encodeLoadout(loadout({ cookie: "2L" }))).toBe("1C2L");
	expect(encodeLoadout(loadout({ pet: "1Z" }))).toBe("1P1Z");
	expect(encodeLoadout(loadout({ cookie: "00", relay: "01", pet: "02" }))).toBe(
		"1C00R01P02",
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
		loadout({ cookie: "00", relay: "01", pet: "02", treasures: [[t("000")]] }),
	);
	expect(code).toBe("1C00R01P02TU000");
});

test("alternatives within a slot are joined by _ and sorted", () => {
	expect(encodeLoadout(loadout({ treasures: [[t("0RB"), t("0FZ")]] }))).toBe(
		"1TU0FZ_0RB",
	);
});

test("slots are joined by - and sorted when order does not matter", () => {
	expect(
		encodeLoadout(
			loadout({ treasures: [[t("0QQ")], [t("000")]], ordered: false }),
		),
	).toBe("1TU000.0QQ");
});

test("slots sharing their smallest id sort the same way whichever order they arrive in", () => {
	const one = encodeLoadout(
		loadout({
			treasures: [
				[t("001"), t("000")],
				[t("000"), t("002")],
			],
		}),
	);
	const other = encodeLoadout(
		loadout({
			treasures: [
				[t("000"), t("002")],
				[t("001"), t("000")],
			],
		}),
	);

	expect(one).toBe(other);
	expect(one).toBe("1TU000_001.000_002");
});

test("slot order is preserved when order matters", () => {
	expect(
		encodeLoadout(
			loadout({ treasures: [[t("0QQ")], [t("000")]], ordered: true }),
		),
	).toBe("1TO0QQ.000");
});

// With one slot there is nothing to order, so O would be a second code for the
// same build.
test("a single slot is always written U", () => {
	expect(
		encodeLoadout(loadout({ treasures: [[t("000")]], ordered: true })),
	).toBe("1TU000");
});

test("decoding reads every group back", () => {
	expect(decodeLoadout("1C00R01P02TO0QQ.000_0RB")).toEqual({
		cookie: "00",
		relay: "01",
		pet: "02",
		treasures: [[t("0QQ")], [t("000"), t("0RB")]],
		ordered: true,
	});
});

test("a non-canonical code decodes as written and re-encodes canonically", () => {
	const decoded = decodeLoadout("1TU0QQ.000");
	expect(decoded.treasures).toEqual([[t("0QQ")], [t("000")]]);
	expect(encodeLoadout(decoded)).toBe("1TU000.0QQ");
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
	expect(() => decodeLoadout("1C00C01")).toThrow(
		'loadout group "C" appears twice',
	);
});

test("groups out of C R P T order are rejected", () => {
	expect(() => decodeLoadout("1P02C00")).toThrow(
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
	expect(() => decodeLoadout("1TU000.001.002.003")).toThrow(
		'loadout group "T": 4 treasure slots, at most 3 fit',
	);
});

test("an empty slot is rejected", () => {
	expect(() => decodeLoadout("1TU000..001")).toThrow(
		'loadout group "T": slot 2 is empty',
	);
});

// The same treasure cannot be equipped twice in one slot, but two slots may
// both accept it — that is how overlapping alternatives are written.
test("a repeated id within one slot is rejected, across slots is allowed", () => {
	expect(() => decodeLoadout("1TU000_000")).toThrow(
		'loadout group "T": slot 1 lists "000" twice',
	);
	expect(decodeLoadout("1TU000.000").treasures).toEqual([
		[t("000")],
		[t("000")],
	]);
});

test("encoding validates the same rules as decoding", () => {
	expect(() => encodeLoadout(loadout({ cookie: "ZZ" }))).toThrow(
		'loadout group "C": no cookie has id "ZZ"',
	);
	expect(() =>
		encodeLoadout(
			loadout({
				treasures: [[t("000")], [t("001")], [t("002")], [t("003")]],
			}),
		),
	).toThrow('loadout group "T": 4 treasure slots, at most 3 fit');
	expect(() => encodeLoadout(loadout({ treasures: [[]] }))).toThrow(
		'loadout group "T": slot 1 is empty',
	);
});

test("a level is written after its id: none for +0, one digit, or a range", () => {
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ")]] }))).toBe("1TU0FZ");
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 5)]] }))).toBe(
		"1TU0FZ5",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 5, 8)]] }))).toBe(
		"1TU0FZ58",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 0, 9)]] }))).toBe(
		"1TU0FZ09",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 9)]] }))).toBe(
		"1TU0FZ9",
	);
});

test("each alternative carries its own level", () => {
	const code = encodeLoadout(
		loadout({ treasures: [[t("0RB", 5, 9), t("0FZ")], [t("0QQ", 9)]] }),
	);

	expect(code).toBe("1TU0FZ_0RB59.0QQ9");
	expect(decodeLoadout(code).treasures).toEqual([
		[t("0FZ"), t("0RB", 5, 9)],
		[t("0QQ", 9)],
	]);
});

// Every code written before levels existed must keep its meaning and its code.
test("codes without levels read as +0 and keep their code", () => {
	const decoded = decodeLoadout("1TU0FZ_0RB.0QQ");

	expect(decoded.treasures).toEqual([[t("0FZ"), t("0RB")], [t("0QQ")]]);
	expect(encodeLoadout(decoded)).toBe("1TU0FZ_0RB.0QQ");
});

test("a non-canonical level decodes and re-encodes short", () => {
	expect(encodeLoadout(decodeLoadout("1TU0FZ00"))).toBe("1TU0FZ");
	expect(encodeLoadout(decodeLoadout("1TU0FZ0"))).toBe("1TU0FZ");
	expect(encodeLoadout(decodeLoadout("1TU0FZ55"))).toBe("1TU0FZ5");
});

// Same ids, different levels: two different slots, which must not tie in the
// sort or one build would have two codes.
test("slots differing only in level still sort to one code", () => {
	const one = encodeLoadout(
		loadout({ treasures: [[t("0FZ", 3)], [t("0FZ", 1)]] }),
	);
	const other = encodeLoadout(
		loadout({ treasures: [[t("0FZ", 1)], [t("0FZ", 3)]] }),
	);

	expect(one).toBe(other);
	expect(one).toBe("1TU0FZ1.0FZ3");
});

test("a malformed level is rejected", () => {
	expect(() => decodeLoadout("1TU0FZ123")).toThrow(
		'loadout group "T": "0FZ123" has level "123", expected at most two digits',
	);
	expect(() => decodeLoadout("1TU0FZX")).toThrow(
		'loadout group "T": "0FZX" has level "X", expected at most two digits',
	);
	expect(() => decodeLoadout("1TU0FZ95")).toThrow(
		'loadout group "T": "0FZ" level runs backwards, 9-5',
	);
});

test("encoding validates levels the same way", () => {
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 9, 5)]] })),
	).toThrow('loadout group "T": "0FZ" level runs backwards, 9-5');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 0, 10)]] })),
	).toThrow('loadout group "T": "0FZ" level 0-10 is outside 0-9');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 1.5)]] })),
	).toThrow('loadout group "T": "0FZ" level 1.5-1.5 is outside 0-9');
});

test("a repeated id is rejected whatever levels the two copies carry", () => {
	expect(() => decodeLoadout("1TU0FZ1_0FZ2")).toThrow(
		'loadout group "T": slot 1 lists "0FZ" twice',
	);
});
