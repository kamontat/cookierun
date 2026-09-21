import { expect, test } from "bun:test";

import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
} from "./loadout.ts";

function loadout(over: Partial<Loadout> = {}): Loadout {
	return { ...emptyLoadout(), ...over };
}

test("an empty loadout is recognised as empty", () => {
	expect(isEmptyLoadout(emptyLoadout())).toBe(true);
	expect(isEmptyLoadout(loadout({ cookie: "00" }))).toBe(false);
	expect(isEmptyLoadout(loadout({ treasures: [["000"]] }))).toBe(false);
});

test("each group carries its tag, and an unset field is left out", () => {
	expect(encodeLoadout(loadout({ cookie: "2L" }))).toBe("1C2L");
	expect(encodeLoadout(loadout({ pet: "1Z" }))).toBe("1P1Z");
	expect(encodeLoadout(loadout({ cookie: "00", relay: "01", pet: "02" }))).toBe(
		"1C00R01P02",
	);
});

test("groups are written in C R P T order", () => {
	const code = encodeLoadout(
		loadout({ cookie: "00", relay: "01", pet: "02", treasures: [["000"]] }),
	);
	expect(code).toBe("1C00R01P02TU000");
});

test("alternatives within a slot are joined by _ and sorted", () => {
	expect(encodeLoadout(loadout({ treasures: [["0RB", "0FZ"]] }))).toBe(
		"1TU0FZ_0RB",
	);
});

test("slots are joined by - and sorted when order does not matter", () => {
	expect(
		encodeLoadout(loadout({ treasures: [["0QQ"], ["000"]], ordered: false })),
	).toBe("1TU000-0QQ");
});

test("slots sharing their smallest id sort the same way whichever order they arrive in", () => {
	const one = encodeLoadout(
		loadout({
			treasures: [
				["001", "000"],
				["000", "002"],
			],
		}),
	);
	const other = encodeLoadout(
		loadout({
			treasures: [
				["000", "002"],
				["001", "000"],
			],
		}),
	);

	expect(one).toBe(other);
	expect(one).toBe("1TU000_001-000_002");
});

test("slot order is preserved when order matters", () => {
	expect(
		encodeLoadout(loadout({ treasures: [["0QQ"], ["000"]], ordered: true })),
	).toBe("1TO0QQ-000");
});

// With one slot there is nothing to order, so O would be a second code for the
// same build.
test("a single slot is always written U", () => {
	expect(encodeLoadout(loadout({ treasures: [["000"]], ordered: true }))).toBe(
		"1TU000",
	);
});

test("decoding reads every group back", () => {
	expect(decodeLoadout("1C00R01P02TO0QQ-000_0RB")).toEqual({
		cookie: "00",
		relay: "01",
		pet: "02",
		treasures: [["0QQ"], ["000", "0RB"]],
		ordered: true,
	});
});

test("a non-canonical code decodes as written and re-encodes canonically", () => {
	const decoded = decodeLoadout("1TU0QQ-000");
	expect(decoded.treasures).toEqual([["0QQ"], ["000"]]);
	expect(encodeLoadout(decoded)).toBe("1TU000-0QQ");
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
	expect(() => decodeLoadout("1TU000-001-002-003")).toThrow(
		'loadout group "T": 4 treasure slots, at most 3 fit',
	);
});

test("an empty slot is rejected", () => {
	expect(() => decodeLoadout("1TU000--001")).toThrow(
		'loadout group "T": slot 2 is empty',
	);
});

// The same treasure cannot be equipped twice in one slot, but two slots may
// both accept it — that is how overlapping alternatives are written.
test("a repeated id within one slot is rejected, across slots is allowed", () => {
	expect(() => decodeLoadout("1TU000_000")).toThrow(
		'loadout group "T": slot 1 lists "000" twice',
	);
	expect(decodeLoadout("1TU000-000").treasures).toEqual([["000"], ["000"]]);
});

test("encoding validates the same rules as decoding", () => {
	expect(() => encodeLoadout(loadout({ cookie: "ZZ" }))).toThrow(
		'loadout group "C": no cookie has id "ZZ"',
	);
	expect(() =>
		encodeLoadout(loadout({ treasures: [["000"], ["001"], ["002"], ["003"]] })),
	).toThrow('loadout group "T": 4 treasure slots, at most 3 fit');
	expect(() => encodeLoadout(loadout({ treasures: [[]] }))).toThrow(
		'loadout group "T": slot 1 is empty',
	);
});
