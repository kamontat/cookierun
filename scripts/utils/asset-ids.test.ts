import { expect, test } from "bun:test";

import { fromId, migrate, toId } from "./asset-ids.ts";

test("an id is fixed-width uppercase base-36", () => {
	expect(toId(0, 2)).toBe("00");
	expect(toId(35, 2)).toBe("0Z");
	expect(toId(36, 2)).toBe("10");
	expect(toId(1143, 3)).toBe("0VR");
});

test("ids read back as the number they encode", () => {
	expect(fromId("00")).toBe(0);
	expect(fromId("0Z")).toBe(35);
	expect(fromId("0VR")).toBe(1143);
});

// Lexicographic order has to equal numeric order, because every sort in the
// codec and the catalog sorts the strings rather than the numbers.
test("lexicographic order on ids equals numeric order", () => {
	const ids = Array.from({ length: 300 }, (_, n) => toId(n, 3));
	expect([...ids].sort()).toEqual(ids);
});

test("migrate keys each section by id in file order and moves the old key", () => {
	const migrated = migrate({
		cookies: {
			GingerBrave: {
				name: "GingerBrave",
				url: "https://cookierundb.com/cookies/ch01",
				image: "cookies/ch01.png",
			},
		},
		pets: {},
		treasures: {},
	});

	expect(migrated.cookies).toEqual({
		"00": {
			key: "GingerBrave",
			name: "GingerBrave",
			url: "https://cookierundb.com/cookies/ch01",
			image: "cookies/ch01.png",
		},
	});
});

test("migrate rewrites treasure chain references to the new ids", () => {
	const migrated = migrate({
		cookies: {},
		pets: {},
		treasures: {
			Acorn: {
				name: "Acorn",
				url: "https://cookierundb.com/treasures/acorn",
				image: null,
				type: "N",
				targets: ["StretchedAcorn", null],
			},
			StretchedAcorn: {
				name: "Stretched Acorn",
				url: "https://cookierundb.com/treasures/stretched-acorn",
				image: "treasures/tr_ga034.png",
				type: "E",
				source: "Acorn",
			},
		},
	});

	expect(migrated.treasures["000"]).toEqual({
		key: "Acorn",
		name: "Acorn",
		url: "https://cookierundb.com/treasures/acorn",
		image: null,
		type: "N",
		targets: ["001", null],
	});
	expect(migrated.treasures["001"]).toEqual({
		key: "StretchedAcorn",
		name: "Stretched Acorn",
		url: "https://cookierundb.com/treasures/stretched-acorn",
		image: "treasures/tr_ga034.png",
		type: "E",
		source: "000",
	});
});

test("migrate leaves an already-migrated index alone", () => {
	const once = migrate({
		cookies: {
			GingerBrave: {
				name: "GingerBrave",
				url: "https://cookierundb.com/cookies/ch01",
				image: "cookies/ch01.png",
			},
		},
		pets: {},
		treasures: {},
	});

	expect(migrate(once)).toEqual(once);
});

test("migrate leaves an already-migrated index alone, even where ids look numeric", () => {
	const cookies: Record<string, unknown> = {};
	for (let n = 0; n < 45; n++) {
		cookies[`Cookie${n}`] = {
			name: `Cookie ${n}`,
			url: `https://cookierundb.com/cookies/cookie-${n}`,
			image: null,
		};
	}

	const once = migrate({ cookies, pets: {}, treasures: {} });
	// "10" is a canonical integer string, which JavaScript enumerates ahead of
	// every other key. Deriving ids from key order would hand it to a different
	// entry on the second pass.
	expect(once.cookies["10"]?.key).toBe("Cookie36");

	const roundTripped = JSON.parse(JSON.stringify(once));
	expect(migrate(roundTripped)).toEqual(once);
});

test("migrate refuses a section that would overflow its id width", () => {
	const cookies: Record<string, unknown> = {};
	for (let n = 0; n < 1297; n++) {
		cookies[`C${n}`] = {
			name: `C${n}`,
			url: `https://cookierundb.com/cookies/c${n}`,
			image: null,
		};
	}

	expect(() => migrate({ cookies, pets: {}, treasures: {} })).toThrow(
		"cookies: 1297 entries exceeds the 1296 an id of width 2 can hold",
	);
});
