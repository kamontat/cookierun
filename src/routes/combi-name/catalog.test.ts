import { expect, test } from "bun:test";

import index from "#assets/index.json";

import {
	CAPACITY,
	type CatalogSection,
	HIDDEN_TREASURE_FAMILIES,
	hasId,
	ID_WIDTH,
	imageFor,
	imageForKey,
	isRetired,
	kindFor,
	labelFor,
	nameFor,
	optionsFor,
	optionsFrom,
	staticImage,
} from "./catalog";

const SECTIONS: CatalogSection[] = ["cookies", "pets", "treasures"];

test("every id is the right width for its section and within capacity", () => {
	for (const section of SECTIONS) {
		const width = ID_WIDTH[section];
		const ids = optionsFor(section).map(([id]) => id);

		expect(ids.length).toBeGreaterThan(0);
		expect(ids.length).toBeLessThanOrEqual(CAPACITY[section]);
		for (const id of ids) {
			expect(id).toMatch(new RegExp(`^[0-9A-Z]{${width}}$`));
		}
	}
});

test("options come back in id order, which is what the wire format sorts by", () => {
	for (const section of SECTIONS) {
		const ids = optionsFor(section).map(([id]) => id);
		expect([...ids].sort()).toEqual(ids);
	}
});

test("known ids resolve and unknown ones do not", () => {
	expect(hasId("cookies", "00")).toBe(true);
	expect(hasId("treasures", "000")).toBe(true);
	expect(hasId("cookies", "ZZ")).toBe(false);
	expect(hasId("treasures", "00")).toBe(false);
});

// A plain object literal's prototype chain has a `constructor`. Looking it up
// with bracket access resolves it, so the id lookup must not.
test("a prototype key is not an id, even though property access would resolve it", () => {
	expect(hasId("cookies", "constructor")).toBe(false);
});

test("the first cookie reads as its display name", () => {
	expect(nameFor("cookies", "00")).toBe("GingerBrave");
	expect(imageFor("cookies", "00")).toBe("cookies/ch01.png");
});

test("an unknown id names itself rather than throwing", () => {
	expect(nameFor("cookies", "ZZ")).toBe("ZZ");
	expect(imageFor("cookies", "ZZ")).toBe(null);
});

// Two live entries can share a display name — 5 treasure names and 1 pet name
// do today. The id disambiguates the code; the label has to disambiguate the
// picker, and it disambiguates with the id, since a shared name yields a shared
// key and so the key would add nothing.
test("a display name shared by two entries is labelled with its id", () => {
	const labels = optionsFor("treasures").map(([, label]) => label);
	expect(new Set(labels).size).toBe(labels.length);

	const sotdae = optionsFor("pets").filter(([, label]) =>
		label.startsWith("Sotdae Flock"),
	);
	expect(sotdae).toHaveLength(3);
	for (const [id, label] of sotdae) {
		expect(label).toBe(`Sotdae Flock [${id}]`);
	}
});

test("nothing in the catalog is retired yet, and retired entries stay out of the options", () => {
	for (const section of SECTIONS) {
		const ids = optionsFor(section).map(([id]) => id);
		expect(ids.filter((id) => isRetired(section, id))).toEqual([]);
	}
});

test("a retired entry stays out of the options, and out of the name count", () => {
	const options = optionsFrom({
		"00": { key: "Live", name: "Sotdae Flock", image: null },
		"01": { key: "Gone", name: "Sotdae Flock", image: null, retired: true },
		"02": { key: "Other", name: "Other", image: "pets/pet02.png" },
	});

	// The live "Sotdae Flock" is alone once the retired one is out, so it keeps
	// its plain name rather than being disambiguated against a dead entry.
	expect(options).toEqual([
		["00", "Sotdae Flock", null, null],
		["02", "Other", "pets/pet02.png", null],
	]);
});

test("an id absent from the catalog is not retired", () => {
	expect(isRetired("cookies", "ZZ")).toBe(false);
});

// labelFor is what describe.ts calls; a retired entry's id is not in the
// picker's precomputed label map at all, since the picker never offers it, so
// this exercises the plain nameFor fallback rather than the disambiguation
// path optionsFrom above already covers.
test("labelFor falls back to the bare name for an id no picker offers", () => {
	expect(labelFor("cookies", "ZZ")).toBe("ZZ");
});

// The catalog declares these itself so a route never imports from scripts/.
// This is the guard against the two copies drifting apart.
test("the widths match the ones the scraper assigns ids with", async () => {
	const scraper = await import("../../../scripts/utils/asset-ids");

	expect(ID_WIDTH).toEqual(scraper.ID_WIDTH);
	expect(CAPACITY).toEqual(scraper.CAPACITY);
});

// The committed guard against a hand edit: a `targets` or `source` chain
// reference is another treasure's id, and this is what would catch one
// pointing at an id nothing in the catalog defines.
test("every targets/source reference resolves to a treasure id", () => {
	const treasures = index.treasures as Record<
		string,
		{ type: string; targets?: (string | null)[]; source?: string }
	>;

	let checked = 0;
	for (const entry of Object.values(treasures)) {
		if (entry.type === "N") {
			for (const target of entry.targets ?? []) {
				if (target === null) continue;
				expect(hasId("treasures", target)).toBe(true);
				checked++;
			}
			continue;
		}
		expect(entry.source).toBeDefined();
		if (entry.source !== undefined) {
			expect(hasId("treasures", entry.source)).toBe(true);
			checked++;
		}
	}
	// Guards against the loop above silently checking nothing.
	expect(checked).toBeGreaterThan(0);
});

// Cookie power+ is a list of cookies, so the page wants their portraits. It
// looks them up by key rather than by id: an id is the wire format's business,
// while a key names the entry the way the scraper found it.
test("an entry's art is reachable by its key", () => {
	expect(imageForKey("cookies", "FairyCookie")).toBe("cookies/ch26.png");
});

test("a key no section carries has no art rather than a broken link", () => {
	expect(imageForKey("cookies", "NotACookie")).toBe(null);
});

test("every cookie key resolves to the same entry its id does", () => {
	for (const [id, entry] of Object.entries(index.cookies)) {
		expect(imageForKey("cookies", entry.key)).toBe(imageFor("cookies", id));
	}
});

// The picker offers what a run can equip. Consumables and the commemorative
// "special" family are neither, and between them they are 208 of the 1,144
// entries someone would otherwise scroll past.
test("the treasure picker leaves out the families a run cannot equip", () => {
	const offered = new Set(optionsFor("treasures").map(([id]) => id));

	for (const [id, entry] of Object.entries(index.treasures)) {
		expect(offered.has(id)).toBe(
			!(HIDDEN_TREASURE_FAMILIES as readonly string[]).includes(entry.family),
		);
	}
});

// A code that already carries a hidden treasure has to keep reading. The
// picker decides what can be chosen, never what can be named.
test("a treasure the picker hides is still named", () => {
	const hidden = Object.entries(index.treasures).find(([, entry]) =>
		(HIDDEN_TREASURE_FAMILIES as readonly string[]).includes(entry.family),
	);
	if (hidden === undefined) throw new Error("no hidden treasure in the index");
	const [id, entry] = hidden;

	expect(hasId("treasures", id)).toBe(true);
	expect(labelFor("treasures", id)).toContain(entry.name);
});

test("every hidden family is one the index actually uses", () => {
	const used = new Set(
		Object.values(index.treasures).map((entry) => entry.family),
	);

	for (const family of HIDDEN_TREASURE_FAMILIES) {
		expect([...used]).toContain(family);
	}
});

// An evolved treasure and the blessed form beside it share one picture — 267
// of the 1,144 entries are half of such a pair — and their names differ only
// by a prefix. The picker cannot tell them apart on art alone, so the option
// carries which of the three it is and the control draws it.
test("a treasure option carries its kind", () => {
	const options = optionsFrom({
		"000": { key: "Base", name: "Base", image: null, type: "N" },
		"001": { key: "Evo", name: "Evo", image: null, type: "E" },
		"002": { key: "Bless", name: "Bless", image: null, type: "B" },
	});

	expect(options.map(([, , , kind]) => kind)).toEqual([
		"base",
		"evolved",
		"blessed",
	]);
});

// Cookies and pets have no evolution chain, so their options say nothing about
// one rather than claiming every entry is a base form.
test("an entry with no type carries no kind", () => {
	expect(optionsFor("cookies").every(([, , , kind]) => kind === null)).toBe(
		true,
	);
	expect(optionsFor("pets").every(([, , , kind]) => kind === null)).toBe(true);
});

test("every offered treasure knows which of the three it is", () => {
	for (const [id, , , kind] of optionsFor("treasures")) {
		expect([kind, id]).toEqual([kindFor("treasures", id), id]);
		expect(["base", "evolved", "blessed"]).toContain(kind ?? "none");
	}
});

test("the blessed forms in the catalog read as blessed", () => {
	expect(kindFor("treasures", "002")).toBe("blessed");
	expect(kindFor("treasures", "009")).toBe("evolved");
	expect(kindFor("treasures", "000")).toBe("base");
});

// The same promise `nameFor` makes: an id the catalog does not carry is
// answered, not thrown at.
test("an id outside the catalog has no kind", () => {
	expect(kindFor("treasures", "ZZZ")).toBe(null);
	expect(kindFor("cookies", "00")).toBe(null);
});

test("a static entry's picture is found by its authored key", () => {
	expect(staticImage("boosts", "fast-start")).toBe("boosts/fast-start.png");
	expect(staticImage("episodes", "ep1")).toBe("episodes/ep1.png");
});

// An unknown key and an entry with no icon come back the same, because the
// caller does the same thing with either: draw the chip or card without art.
test("an unknown static key is null rather than an error", () => {
	expect(staticImage("boosts", "no-such-boost")).toBe(null);
	expect(staticImage("episodes", "constructor")).toBe(null);
});
