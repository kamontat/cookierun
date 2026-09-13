import { expect, test } from "bun:test";

import { fromId, migrate, reconcile, toId } from "./asset-ids.ts";

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

const existing = {
	"00": {
		key: "First",
		name: "First",
		url: "https://cookierundb.com/cookies/first",
		image: null,
	},
	"01": {
		key: "Second",
		name: "Second",
		url: "https://cookierundb.com/cookies/second",
		image: null,
	},
};

test("a slug already in the index keeps its id, wherever it now sorts", () => {
	const { ids } = reconcile("cookies", existing, ["second", "first"]);

	expect(ids.get("first")).toBe("00");
	expect(ids.get("second")).toBe("01");
});

test("a new slug takes the next free id", () => {
	const { ids } = reconcile("cookies", existing, ["first", "second", "third"]);

	expect(ids.get("third")).toBe("02");
});

test("a vanished slug is reported as retired rather than dropped", () => {
	const { ids, retired } = reconcile("cookies", existing, ["first"]);

	expect(retired).toEqual(["01"]);
	expect(ids.has("second")).toBe(false);
});

// The next free id is one past the highest in use, never the entry count, or a
// retired id would be handed to a different entry.
test("a retired id is never reused", () => {
	const { ids } = reconcile("cookies", existing, ["first", "third"]);

	expect(ids.get("third")).toBe("02");
});

test("reconcile refuses to exceed the section capacity", () => {
	const full: Record<string, (typeof existing)["00"]> = {};
	for (let n = 0; n < 1296; n++) {
		full[`X${n}`] = {
			key: `X${n}`,
			name: `X${n}`,
			url: `https://cookierundb.com/cookies/x${n}`,
			image: null,
		};
	}
	// Keys above are placeholders for shape only; ids come from the map below.
	const byId = Object.fromEntries(
		Object.values(full).map((entry, n) => [toId(n, 2), entry]),
	);

	expect(() => reconcile("cookies", byId, ["brand-new"])).toThrow(
		"cookies: no id left, 1296 already in use",
	);
});
