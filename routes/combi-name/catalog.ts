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

type CatalogEntry = {
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
	return DATA[section][id];
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
 * Two live entries can share a display name, so a label that appears more than
 * once carries its id — the id is what tells them apart, and it is what the
 * code will carry. Not the key: the key is derived from the name, so entries
 * that collide on one collide on the other. Computed here rather than stored,
 * since the answer depends on the whole section.
 */
function labelsFor(section: CatalogSection): Map<string, string> {
	const counts = new Map<string, number>();
	for (const entry of Object.values(DATA[section])) {
		if (entry.retired === true) continue;
		counts.set(entry.name, (counts.get(entry.name) ?? 0) + 1);
	}

	const labels = new Map<string, string>();
	for (const [id, entry] of Object.entries(DATA[section])) {
		if (entry.retired === true) continue;
		const shared = (counts.get(entry.name) ?? 0) > 1;
		labels.set(id, shared ? `${entry.name} [${id}]` : entry.name);
	}
	return labels;
}

function buildOptions(section: CatalogSection): readonly PickerOption[] {
	const labels = labelsFor(section);
	return [...labels.keys()].sort().map((id): PickerOption => {
		return [id, labels.get(id) ?? id, imageFor(section, id)] as const;
	});
}

// Built once at module load: three sections, 1,341 entries, and the page asks
// for them six times over.
const OPTIONS: Record<CatalogSection, readonly PickerOption[]> = {
	cookies: buildOptions("cookies"),
	pets: buildOptions("pets"),
	treasures: buildOptions("treasures"),
};

/** Live entries only, in id order — the order every wire-format sort uses. */
export function optionsFor(section: CatalogSection): readonly PickerOption[] {
	return OPTIONS[section];
}
