import { expect, test } from "bun:test";

import fingerprint from "#assets/fingerprint.json";

import {
	type Entry,
	type Fingerprints,
	fingerprintProblems,
	fingerprintsFor,
	fromId,
	migrate,
	ordered,
	reconcile,
	type TreasureEntry,
	toId,
	verifyCovered,
	verifyIndex,
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
const COMMITTED = fingerprint as unknown as Fingerprints;

/**
 * `bun run verify:assets` runs the same check, but a contributor runs the suite
 * far more often than a script they have to remember. This is what makes a hand
 * edit or a bad merge fail before it reaches anybody else.
 */
test("the committed index is intact and no covered id has changed meaning", async () => {
	const text = await Bun.file(INDEX).text();

	expect(verifyIndex(text, COMMITTED)).toEqual([]);
});

test("the committed fingerprint covers every entry, so nothing sits outside it", async () => {
	const index = migrate(JSON.parse(await Bun.file(INDEX).text()));

	expect(fingerprintsFor(index)).toEqual(COMMITTED);
});

type LooseIndex = Record<string, Record<string, Record<string, unknown>>>;

async function tampered(
	change: (index: LooseIndex) => void,
	verify: (text: string, expected: Fingerprints) => string[] = verifyIndex,
): Promise<string[]> {
	const index = JSON.parse(await Bun.file(INDEX).text());
	change(index);
	return verify(`${JSON.stringify(index, null, 2)}\n`, COMMITTED);
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

// Each of these is a way the file could actually break: a merge that took both
// sides, a hand edit, a rebase that dropped a hunk.
test("an id that comes to name a different entry is caught", async () => {
	const problems = await tampered((index) => {
		const first = entryIn(index, "cookies", "00");
		const second = entryIn(index, "cookies", "01");
		[first["url"], second["url"]] = [second["url"], first["url"]];
	});

	expect(problems).toHaveLength(1);
	expect(problems[0]).toContain("names a different entry");
});

// The shape a line-oriented merge conflict inside a JSON object produces. The
// urls stay put, so only the display hash can see it.
test("display fields swapped between two entries are caught separately", async () => {
	const problems = await tampered((index) => {
		const first = entryIn(index, "cookies", "00");
		const second = entryIn(index, "cookies", "01");
		[first["name"], second["name"]] = [second["name"], first["name"]];
		[first["image"], second["image"]] = [second["image"], first["image"]];
		[first["key"], second["key"]] = [second["key"], first["key"]];
	});

	expect(problems).toHaveLength(1);
	expect(problems[0]).toContain("a name, icon or key");
	expect(problems[0]).not.toContain("names a different entry");
});

test("an entry removed from the end is caught by the covered count", async () => {
	const highest = (index: LooseIndex): string => {
		const ids = Object.keys(index["treasures"] ?? {}).sort();
		const last = ids.at(-1);
		if (last === undefined) throw new Error("no treasures");
		return last;
	};

	// Picked programmatically: the highest id must be one nothing points at, or
	// the chain check fires first and this test passes for the wrong reason.
	const problems = await tampered((index) => {
		delete index["treasures"]?.[highest(index)];
	});

	expect(
		problems.some((problem) => problem.includes("fewer than the 1144")),
	).toBe(true);
});

test("an entry removed from the middle is caught as a gap", async () => {
	const problems = await tampered((index) => {
		delete index["pets"]?.["05"];
	});

	expect(problems[0]).toBe(
		"pets: id 06 sits where 05 should be — an id was deleted or inserted",
	);
});

// An id the fingerprint does not cover is an id no guard protects: a later
// scrape would hand it to a different entry and nothing would notice.
test("an id appended past the fingerprint's coverage fails the suite", async () => {
	const append = (index: LooseIndex) => {
		const cookies = index["cookies"];
		if (cookies === undefined) throw new Error("no cookies");
		cookies["2M"] = {
			name: "Newcomer",
			url: "https://cookierundb.com/cookies/newcomer",
			image: null,
			key: "Newcomer",
		};
	};

	expect((await tampered(append))[0]).toBe(
		"cookies: 95 entries but the fingerprint covers 94 — run `bun run verify:assets --update` so every id is covered",
	);
	// But the scraper's own gate allows it, or a scrape could never append.
	expect(await tampered(append, verifyCovered)).toEqual([]);
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

test("a malformed fingerprint reports itself rather than throwing", () => {
	expect(fingerprintProblems({ cookies: COMMITTED.cookies })).toEqual([
		"fingerprint.json has no pets",
		"fingerprint.json has no treasures",
	]);
	expect(
		fingerprintProblems({
			...COMMITTED,
			pets: { through: -1, identity: "nope", display: COMMITTED.pets.display },
		}),
	).toEqual([
		"fingerprint.json: pets.through is not a count",
		"fingerprint.json: pets.identity is not 16 hex characters",
	]);
	expect(fingerprintProblems(null)).toEqual([
		"fingerprint.json is not an object",
	]);
});
