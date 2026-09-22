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

/**
 * Where an entry sits in its evolution chain, named rather than lettered: the
 * index writes `N`, `E` and `B`, and a control drawing a badge should not have
 * to know that alphabet. Treasures only — nothing else in the catalog evolves.
 */
export type EntryKind = "base" | "evolved" | "blessed";

const KIND_OF: Record<string, EntryKind> = {
	N: "base",
	E: "evolved",
	B: "blessed",
};

export type PickerOption = readonly [
	id: string,
	label: string,
	image: string | null,
	kind: EntryKind | null,
];

export type CatalogEntry = {
	key: string;
	name: string;
	image: string | null;
	/** Which family the site sorts this entry into; treasures only. */
	family?: string;
	/** Where in its evolution chain the site files this entry; treasures only. */
	type?: string;
	retired?: true;
};

/**
 * The treasure families the picker does not offer. A run equips treasures from
 * the draw, pet and cookie families; `consumable` is the XP-Elixirs and their
 * like, and `special` is trophies, certificates and commemorative frames —
 * between them 208 of the 1,144 entries, none of which can go in a slot.
 *
 * This hides them from the picker and from nowhere else. A code that already
 * carries one still decodes and still names it, the same promise a retired
 * entry gets: what can be chosen is a question about the page, what can be
 * named is a question about the wire format.
 */
export const HIDDEN_TREASURE_FAMILIES = ["consumable", "special"] as const;

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

/**
 * The two sections of `assets/index.json` nobody scrapes. Their keys are
 * authored rather than assigned, and a code never carries one — the codec has
 * its own character for an episode and its own slot for a boost — so nothing
 * here is a wire id and none of the promises above apply to it.
 */
export type StaticSection = "boosts" | "episodes";

const STATIC = index as unknown as Record<
	StaticSection,
	Record<string, { name: string; image: string | null }>
>;

/**
 * A boost's or an episode's picture, found by the key the index files it
 * under. `null` covers both an unknown key and an entry with no icon, since
 * the caller does the same thing with either — a chip or a card without art
 * falls back to its own lettered tile.
 *
 * Display names are not read from here: `labels.ts` owns those, and `decode`
 * quotes the boost ones in its error messages.
 */
export function staticImage(
	section: StaticSection,
	key: string,
): string | null {
	const entries = STATIC[section];
	if (!Object.hasOwn(entries, key)) return null;
	return entries[key]?.image ?? null;
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

/**
 * Which of base, evolved and blessed an id is, or `null` where the question
 * does not apply — a cookie, a pet, or an id the catalog does not carry.
 *
 * An evolved treasure and the blessed form beside it share one picture and a
 * name that differs only by its prefix, so this is the only thing telling the
 * picker's two cells apart.
 */
export function kindFor(section: CatalogSection, id: string): EntryKind | null {
	const type = entryFor(section, id)?.type;
	return type === undefined ? null : (KIND_OF[type] ?? null);
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
			return [
				id,
				shared ? `${entry.name} [${id}]` : entry.name,
				entry.image,
				entry.type === undefined ? null : (KIND_OF[entry.type] ?? null),
			];
		})
		.sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1));
}

// Built once at module load: three sections, 1,341 entries, and the page asks
// for them six times over.
const LISTED: Record<CatalogSection, readonly PickerOption[]> = {
	cookies: optionsFrom(DATA.cookies),
	pets: optionsFrom(DATA.pets),
	treasures: optionsFrom(DATA.treasures),
};

function isOffered(section: CatalogSection, id: string): boolean {
	if (section !== "treasures") return true;
	const family = entryFor(section, id)?.family;
	return (
		family === undefined ||
		!(HIDDEN_TREASURE_FAMILIES as readonly string[]).includes(family)
	);
}

const OPTIONS: Record<CatalogSection, readonly PickerOption[]> = {
	cookies: LISTED.cookies,
	pets: LISTED.pets,
	treasures: LISTED.treasures.filter(([id]) => isOffered("treasures", id)),
};

/** What a picker offers: live entries of an offered family, in id order. */
export function optionsFor(section: CatalogSection): readonly PickerOption[] {
	return OPTIONS[section];
}

/**
 * Built from the full listing rather than from what the picker offers, so a
 * code carrying a hidden treasure still reads with its disambiguated name.
 */
const LABELS: Record<CatalogSection, ReadonlyMap<string, string>> = {
	cookies: new Map(LISTED.cookies.map(([id, label]) => [id, label])),
	pets: new Map(LISTED.pets.map(([id, label]) => [id, label])),
	treasures: new Map(LISTED.treasures.map(([id, label]) => [id, label])),
};

/**
 * The disambiguated display name — what the picker shows. A name shared by two
 * live entries carries its id, since that is what tells them apart. Falls back
 * to the bare name for a retired entry, which no picker offers.
 */
export function labelFor(section: CatalogSection, id: string): string {
	return LABELS[section].get(id) ?? nameFor(section, id);
}
