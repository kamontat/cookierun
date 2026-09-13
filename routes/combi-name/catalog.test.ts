import { expect, test } from "bun:test";

import {
	CAPACITY,
	type CatalogSection,
	hasId,
	ID_WIDTH,
	imageFor,
	isRetired,
	nameFor,
	optionsFor,
} from "./catalog.ts";

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

// The catalog declares these itself so a route never imports from scripts/.
// This is the guard against the two copies drifting apart.
test("the widths match the ones the scraper assigns ids with", async () => {
	const scraper = await import("../../scripts/utils/asset-ids.ts");

	expect(ID_WIDTH).toEqual(scraper.ID_WIDTH);
	expect(CAPACITY).toEqual(scraper.CAPACITY);
});
