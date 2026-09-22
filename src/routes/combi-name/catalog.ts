/**
 * The cookie, pet and treasure catalog, read from `assets/index.json`, whose
 * keys are the wire ids a loadout section carries. Ids are assigned append-only
 * by the scraper, so an id here means the same entry for the life of the
 * project — see `scripts/utils/asset-ids.ts`.
 *
 * It lives in the route rather than `lib/` for the same reason the codec does:
 * exactly one page imports it.
 */

import index from "#assets/index.json";

export type CatalogSection = "cookies" | "pets" | "treasures";

/**
 * Declared here rather than imported from `scripts/utils/asset-ids.ts`: a route
 * does not import from `scripts/`. `catalog.test.ts` asserts the two agree, so
 * they cannot drift.
 */
export const ID_WIDTH: Record<CatalogSection, number> = {
	cookies: 2,
	pets: 2,
	treasures: 3,
};

export const CAPACITY: Record<CatalogSection, number> = {
	cookies: 36 ** ID_WIDTH.cookies,
	pets: 36 ** ID_WIDTH.pets,
	treasures: 36 ** ID_WIDTH.treasures,
};

export type PickerOption = readonly [
	id: string,
	label: string,
	image: string | null,
];

export type CatalogEntry = {
	key: string;
	name: string;
	image: string | null;
	retired?: true;
};

// One cast at the boundary. A JSON import's inferred type has no index
// signature, and propagating 1,300 literal property types through every lookup
// slows the typechecker for nothing.
const DATA = index as unknown as Record<
	CatalogSection,
	Record<string, CatalogEntry>
>;

function entryFor(
	section: CatalogSection,
	id: string,
): CatalogEntry | undefined {
	return Object.hasOwn(DATA[section], id) ? DATA[section][id] : undefined;
}

export function hasId(section: CatalogSection, id: string): boolean {
	return entryFor(section, id) !== undefined;
}

export function isRetired(section: CatalogSection, id: string): boolean {
	return entryFor(section, id)?.retired === true;
}

export function nameFor(section: CatalogSection, id: string): string {
	return entryFor(section, id)?.name ?? id;
}

export function imageFor(section: CatalogSection, id: string): string | null {
	return entryFor(section, id)?.image ?? null;
}

const BY_KEY: Record<CatalogSection, ReadonlyMap<string, CatalogEntry>> = {
	cookies: new Map(Object.values(DATA.cookies).map((e) => [e.key, e])),
	pets: new Map(Object.values(DATA.pets).map((e) => [e.key, e])),
	treasures: new Map(Object.values(DATA.treasures).map((e) => [e.key, e])),
};

/**
 * An entry's picture, found by the scraper's own key rather than by its wire
 * id. Cookie power+ is a list of cookies the codec models as its own values, so
 * the page needs their portraits without the codec ever learning a cookie id;
 * naming the key keeps that lookup readable, and keeps a renumbering — which
 * `scripts/utils/asset-ids.ts` forbids anyway — from silently repointing it.
 */
export function imageForKey(
	section: CatalogSection,
	key: string,
): string | null {
	return BY_KEY[section].get(key)?.image ?? null;
}

/**
 * Live entries only, in id order — the order every wire-format sort uses. A
 * name shared by two live entries carries its id, since the id is what tells
 * them apart and what the code will carry; not the key, which is derived from
 * the name and so collides whenever the name does.
 *
 * Takes its entries rather than reading the catalog directly so the retired
 * branch can be tested: the real catalog has none yet, and a filter nothing
 * exercises is a filter nobody notices breaking.
 */
export function optionsFrom(
	entries: Record<string, CatalogEntry>,
): readonly PickerOption[] {
	const live = Object.entries(entries).filter(
		([, entry]) => entry.retired !== true,
	);

	const counts = new Map<string, number>();
	for (const [, entry] of live) {
		counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
	}

	return live
		.map(([id, entry]): PickerOption => {
			const shared = (counts.get(entry.name) ?? 0) > 1;
			return [id, shared ? `${entry.name} [${id}]` : entry.name, entry.image];
		})
		.sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1));
}

// Built once at module load: three sections, 1,341 entries, and the page asks
// for them six times over.
const OPTIONS: Record<CatalogSection, readonly PickerOption[]> = {
	cookies: optionsFrom(DATA.cookies),
	pets: optionsFrom(DATA.pets),
	treasures: optionsFrom(DATA.treasures),
};

/** Live entries only, in id order. See optionsFrom for the logic. */
export function optionsFor(section: CatalogSection): readonly PickerOption[] {
	return OPTIONS[section];
}

const LABELS: Record<CatalogSection, ReadonlyMap<string, string>> = {
	cookies: new Map(OPTIONS.cookies.map(([id, label]) => [id, label])),
	pets: new Map(OPTIONS.pets.map(([id, label]) => [id, label])),
	treasures: new Map(OPTIONS.treasures.map(([id, label]) => [id, label])),
};

/**
 * The disambiguated display name — what the picker shows. A name shared by two
 * live entries carries its id, since that is what tells them apart. Falls back
 * to the bare name for a retired entry, which no picker offers.
 */
export function labelFor(section: CatalogSection, id: string): string {
	return LABELS[section].get(id) ?? nameFor(section, id);
}
