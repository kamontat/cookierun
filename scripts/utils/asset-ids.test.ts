import { expect, test } from "bun:test";

import {
	BLESSED_OFFSET,
	type Entry,
	fromId,
	hubIdOf,
	ordered,
	orderedStatic,
	parseIndex,
	STATIC_SECTIONS,
	type StaticEntry,
	serializeIndex,
	type TreasureEntry,
	toId,
	verifyStructure,
	wireId,
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

test("a wire id is the site's number, and a blessed form sits half the id space up", () => {
	expect(wireId("cookies", 81)).toBe("29");
	expect(wireId("treasures", 50)).toBe("01E");
	expect(BLESSED_OFFSET).toBe(23328);
	expect(wireId("treasures", 50, true)).toBe("I1E");
});

test("hubIdOf reads a wire id back to the site's number and form", () => {
	expect(hubIdOf("treasures", "01E")).toEqual({ hubId: 50, blessed: false });
	expect(hubIdOf("treasures", "I1E")).toEqual({ hubId: 50, blessed: true });
	// Only treasures are blessed: a cookie id this high is still just a number.
	expect(hubIdOf("cookies", "ZZ")).toEqual({ hubId: 1295, blessed: false });
});

test("parseIndex reads a missing section as empty and keeps the static ones", () => {
	const index = parseIndex({
		fetchedAt: null,
		episodes: { ep1: { name: "Escape from the Oven", url: null, image: null } },
	});

	expect(index.cookies).toEqual({});
	expect(index.treasures).toEqual({});
	expect(index.episodes).toEqual({
		ep1: { name: "Escape from the Oven", url: null, image: null },
	});
});

test("ordered gives one field order whatever built the entry", () => {
	const scraped = ordered({
		key: "Acorn",
		name: "Acorn",
		url: "https://www.cookierunhub.com/en/encyclopedia/treasures/1",
		image: null,
		family: "gacha",
		type: "N",
		targets: [null, null],
	} as TreasureEntry);

	expect(Object.keys(scraped)).toEqual([
		"name",
		"url",
		"image",
		"family",
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
		url: "https://www.cookierunhub.com/en/encyclopedia/pets/1",
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
 * `bun run verify:assets` asks a different question — is the index complete
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

// An id is the site's number for the page its url names, so an id that no
// longer agrees with its url is one that moved to a different entry.
test("an id whose url names a different page is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "pets", "05")["url"] =
			"https://www.cookierunhub.com/en/encyclopedia/pets/6";
	});

	expect(problems).toContain(
		'pets/05 names "https://www.cookierunhub.com/en/encyclopedia/pets/6", but its id says https://www.cookierunhub.com/en/encyclopedia/pets/5',
	);
});

test("a chain that resolves but does not point back is caught", async () => {
	const problems = await tampered((index) => {
		const evolved = Object.entries(index["treasures"] ?? {}).find(
			([, entry]) => entry["type"] === "E",
		);
		if (evolved === undefined) throw new Error("no evolved treasure");
		evolved[1]["source"] = "01D";
	});

	expect(
		problems.some((problem) =>
			problem.includes("as its base, but 01D points at"),
		),
	).toBe(true);
});

test("a treasure whose type is not N, E or B is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "treasures", "001")["type"] = "X";
	});

	expect(problems[0]).toBe('treasures/001: type "X" is not N, E or B');
});

test("a blessed treasure filed in the unblessed half is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "treasures", "001")["type"] = "B";
	});

	expect(problems).toContain(
		"treasures/001 is type B, but its id is in the unblessed half",
	);
});

test("a treasure whose family is not one the site uses is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "treasures", "001")["family"] = "snack";
	});

	expect(problems[0]).toBe(
		'treasures/001: family "snack" is not one of cookie, gacha, limited, pet, squirrel',
	);
});

test("a treasure with no family at all is caught", async () => {
	const problems = await tampered((index) => {
		delete entryIn(index, "treasures", "001")["family"];
	});

	expect(problems.some((problem) => problem.includes("family"))).toBe(true);
});

test("fetchedAt round-trips through parseIndex and serializeIndex, written first", () => {
	const index = parseIndex({
		fetchedAt: "2026-09-21T08:11:04.000Z",
		cookies: {},
		pets: {},
		treasures: {},
	});

	expect(index.fetchedAt).toBe("2026-09-21T08:11:04.000Z");
	expect(serializeIndex(index)).toBe(
		'{\n  "fetchedAt": "2026-09-21T08:11:04.000Z",\n' +
			'  "cookies": {},\n  "pets": {},\n  "treasures": {},\n' +
			'  "boosts": {},\n  "episodes": {}\n}\n',
	);
});

// `parseIndex` normalises a malformed timestamp to null, so the check has to
// read the parsed input rather than its output, or it could never fire.
test("a fetchedAt that is not an ISO instant parses to null and is reported", () => {
	const text =
		'{\n  "fetchedAt": "last tuesday",\n' +
		'  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n';

	expect(parseIndex(JSON.parse(text)).fetchedAt).toBe(null);
	expect(verifyStructure(text)).toContain(
		'index.json: fetchedAt "last tuesday" is neither null nor an ISO 8601 instant',
	);
});

test("an index with no fetchedAt at all is reported as missing", () => {
	const text = '{\n  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n';

	expect(verifyStructure(text)).toContain("index.json: fetchedAt is missing");
});

// The static sections: boosts and episodes, authored rather than scraped. None
// of the id machinery above applies to them, so what is checked instead is that
// they survive a scrape unchanged and that a hand edit cannot go unnoticed.

test("a static entry keeps its three fields, in order, and loses the rest", () => {
	expect(
		orderedStatic({
			image: "boosts/fast-start.png",
			name: "Fast Start",
			url: null,
			note: "hand-added",
		} as unknown as StaticEntry),
	).toEqual({ name: "Fast Start", url: null, image: "boosts/fast-start.png" });

	expect(
		Object.keys(orderedStatic({ image: null, url: null, name: "Fast Start" })),
	).toEqual(["name", "url", "image"]);
});

test("the writer sorts a static section by its authored key", () => {
	const written = serializeIndex(
		parseIndex({
			fetchedAt: null,
			episodes: {
				sep1: { name: "Island of Coins", url: null, image: null },
				ep1: { name: "Escape from the Oven", url: null, image: null },
			},
		}),
	);

	expect(written.indexOf('"ep1"')).toBeLessThan(written.indexOf('"sep1"'));
});

test("parseIndex leaves an already-written static section exactly as it is", async () => {
	const index = parseIndex(await Bun.file(INDEX).json());

	expect(parseIndex(JSON.parse(serializeIndex(index)))).toEqual(index);
	expect(Object.keys(index.boosts).length).toBeGreaterThan(0);
	expect(Object.keys(index.episodes).length).toBeGreaterThan(0);
});

test("a static key that is not lowercase and letter-first is caught", async () => {
	const problems = await tampered((index) => {
		const episodes = index["episodes"];
		const entry = entryIn(index, "episodes", "ep1");
		if (episodes === undefined) throw new Error("no episodes section");
		episodes["EP1"] = entry;
		delete episodes["ep1"];
	});

	expect(problems.some((problem) => problem.includes("episodes/EP1"))).toBe(
		true,
	);
});

test("a static entry with an empty name is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "boosts", "fast-start")["name"] = "";
	});

	expect(problems).toContain('boosts/fast-start: name "" is empty');
});

test("a static image outside the section's own directory is caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "boosts", "fast-start")["image"] = "cookies/ch01.png";
	});

	expect(problems).toContain(
		'boosts/fast-start: image "cookies/ch01.png" is neither null nor a path under boosts/',
	);
});

// Copying an entry and changing only one of its two pointers is the mistake
// hand-writing invites, so both are checked for collisions.
test("two static entries claiming one image are caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "boosts", "double-xp")["image"] = "boosts/fast-start.png";
	});

	expect(problems).toContain(
		"boosts: boosts/fast-start.png is claimed by both double-xp and fast-start",
	);
});

test("two static entries claiming one url are caught", async () => {
	const problems = await tampered((index) => {
		entryIn(index, "episodes", "ep2")["url"] = entryIn(
			index,
			"episodes",
			"ep1",
		)["url"];
	});

	expect(
		problems.some((problem) => problem.includes("is claimed by both")),
	).toBe(true);
});

// `verifyStructure` is handed the text and not the directory, so this is the
// only thing between a path in the index and a broken image on the page.
test("every image the committed index names is on disk", async () => {
	const raw = await Bun.file(INDEX).json();
	const index = parseIndex(raw);
	const missing: string[] = [];
	const sections = [
		...STATIC_SECTIONS,
		"cookies",
		"pets",
		"treasures",
	] as const;

	for (const section of sections) {
		for (const [key, entry] of Object.entries(
			index[section] as Record<string, { image: string | null }>,
		)) {
			if (entry.image === null) continue;
			const file = new URL(`../../assets/${entry.image}`, import.meta.url);
			if (!(await Bun.file(file).exists())) {
				missing.push(`${section}/${key} -> ${entry.image}`);
			}
		}
	}

	expect(missing).toEqual([]);
});
