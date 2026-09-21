import { expect, test } from "bun:test";

import {
	type Entry,
	fromId,
	migrate,
	ordered,
	reconcile,
	serializeIndex,
	type TreasureEntry,
	toId,
	verifyStructure,
} from "./asset-ids";

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

// The reviewer's original fixture deleted `key` from one already-migrated
// entry, leaving both keys id-shaped ("00", "01") — that reads as fully
// migrated under a shape-only discriminator and does not throw. What actually
// produces a mixed section is one entry keyed back by its old PascalCase name
// alongside entries still keyed by id.
test("a section with both id-shaped and name-shaped keys is refused, not renumbered", () => {
	const migrated = migrate({
		cookies: {
			GingerBrave: {
				name: "GingerBrave",
				url: "https://cookierundb.com/cookies/ch01",
				image: null,
			},
			Strawberry: {
				name: "Strawberry Cookie",
				url: "https://cookierundb.com/cookies/ch02",
				image: null,
			},
		},
		pets: {},
		treasures: {},
	});

	const tampered = JSON.parse(JSON.stringify(migrated));
	tampered.cookies.Strawberry = tampered.cookies["01"];
	delete tampered.cookies["01"];

	expect(() => migrate(tampered)).toThrow("partially migrated");
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

test("ordered gives one field order whatever built the entry", () => {
	const scraped = ordered({
		key: "Acorn",
		name: "Acorn",
		url: "https://cookierundb.com/treasures/acorn",
		image: null,
		type: "N",
		targets: [null, null],
	} as TreasureEntry);

	expect(Object.keys(scraped)).toEqual([
		"name",
		"url",
		"image",
		"type",
		"targets",
		"key",
	]);
});

test("ordered keeps a retired entry's flag last and drops nothing", () => {
	const entry = ordered({
		retired: true,
		key: "Gone",
		name: "Gone",
		url: "https://cookierundb.com/pets/gone",
		image: null,
	} as Entry);

	expect(Object.keys(entry)).toEqual([
		"name",
		"url",
		"image",
		"key",
		"retired",
	]);
	expect(entry.retired).toBe(true);
});

const INDEX = new URL("../../assets/index.json", import.meta.url);

/**
 * `bun run verify:assets` asks a different question now — is the index complete
 * against the site — so this is the only thing that checks the file's own
 * shape, and a contributor runs the suite far more often than a script they
 * have to remember.
 */
test("the committed index is structurally intact", async () => {
	const text = await Bun.file(INDEX).text();

	expect(verifyStructure(text)).toEqual([]);
});

type LooseIndex = Record<string, Record<string, Record<string, unknown>>>;

async function tampered(
	change: (index: LooseIndex) => void,
): Promise<string[]> {
	const index = JSON.parse(await Bun.file(INDEX).text());
	change(index);
	return verifyStructure(`${JSON.stringify(index, null, 2)}\n`);
}

function entryIn(index: LooseIndex, section: string, id: string) {
	const entry = index[section]?.[id];
	if (entry === undefined) {
		throw new Error(
			`this test needs ${section}/${id}, which is not in the index`,
		);
	}
	return entry;
}

test("an entry removed from the middle is caught as a gap", async () => {
	const problems = await tampered((index) => {
		delete index["pets"]?.["05"];
	});

	expect(problems[0]).toBe(
		"pets: id 06 sits where 05 should be — an id was deleted or inserted",
	);
});

test("a chain that resolves but does not point back is caught", async () => {
	const problems = await tampered((index) => {
		const evolved = Object.entries(index["treasures"] ?? {}).find(
			([, entry]) => entry["type"] === "E",
		);
		if (evolved === undefined) throw new Error("no evolved treasure");
		evolved[1]["source"] = "000";
	});

	expect(problems[0]).toContain("as its base, but 000 points at");
});

test("a treasure whose type is not N, E or B is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "treasures", "000")["type"] = "X";
	});

	expect(problems[0]).toBe('treasures/000: type "X" is not N, E or B');
});

test("fetchedAt round-trips through migrate and serializeIndex, written first", () => {
	const index = migrate({
		fetchedAt: "2026-09-21T08:11:04.000Z",
		cookies: {},
		pets: {},
		treasures: {},
	});

	expect(index.fetchedAt).toBe("2026-09-21T08:11:04.000Z");
	expect(serializeIndex(index)).toBe(
		'{\n  "fetchedAt": "2026-09-21T08:11:04.000Z",\n' +
			'  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n',
	);
});

// `migrate` normalises a malformed timestamp to null, so the check has to read
// the parsed input rather than migrate's output, or it could never fire.
test("a fetchedAt that is not an ISO instant migrates to null and is reported", () => {
	const text =
		'{\n  "fetchedAt": "last tuesday",\n' +
		'  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n';

	expect(migrate(JSON.parse(text)).fetchedAt).toBe(null);
	expect(verifyStructure(text)).toContain(
		'index.json: fetchedAt "last tuesday" is neither null nor an ISO 8601 instant',
	);
});

test("an index with no fetchedAt at all is reported as missing", () => {
	const text = '{\n  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n';

	expect(verifyStructure(text)).toContain("index.json: fetchedAt is missing");
});
