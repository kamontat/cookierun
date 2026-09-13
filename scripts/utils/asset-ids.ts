/**
 * Wire ids for `assets/index.json`, and the one-way migration that turns the
 * old name-derived keys into them.
 *
 * The old keys were PascalCase display names numbered on collision, so
 * inserting an entry upstream renumbered the ones after it. An id that moves is
 * a code that changes meaning, which a wire format cannot tolerate. Ids are
 * therefore assigned once, in file order, and never reassigned — see
 * `reconcile` for how a rescrape keeps that promise.
 */

export type Section = "cookies" | "pets" | "treasures";

export const SECTIONS: Section[] = ["cookies", "pets", "treasures"];

export const ID_WIDTH: Record<Section, number> = {
	cookies: 2,
	pets: 2,
	treasures: 3,
};

export const CAPACITY: Record<Section, number> = {
	cookies: 36 ** ID_WIDTH.cookies,
	pets: 36 ** ID_WIDTH.pets,
	treasures: 36 ** ID_WIDTH.treasures,
};

export type Entry = {
	/** The old PascalCase key. Kept because a rescrape diff is unreadable without it. */
	key: string;
	name: string;
	url: string;
	image: string | null;
	retired?: true;
};

export type TreasureEntry = Entry &
	(
		| { type: "N"; targets: [string | null, string | null] }
		| { type: "E" | "B"; source: string }
	);

export type AssetIndex = {
	cookies: Record<string, Entry>;
	pets: Record<string, Entry>;
	treasures: Record<string, TreasureEntry>;
};

export function toId(n: number, width: number): string {
	return n.toString(36).toUpperCase().padStart(width, "0");
}

export function fromId(id: string): number {
	return Number.parseInt(id, 36);
}

/** The slug is the last path segment of the entry's own page URL. */
export function slugOf(url: string): string {
	return url.split("/").pop() ?? "";
}

type OldEntry = Record<string, unknown>;

function sectionOf(old: unknown, section: Section): Record<string, OldEntry> {
	const holder = old as Record<string, unknown>;
	const found = holder[section];
	if (found === undefined || found === null) return {};
	return found as Record<string, OldEntry>;
}

/**
 * An already-migrated section keys every entry by an id of the section's width
 * and carries a `key` field on each. It matters because ids are not re-derived
 * for such a section — see `migrate`.
 */
function isMigrated(entries: [string, OldEntry][], width: number): boolean {
	const id = new RegExp(`^[0-9A-Z]{${width}}$`);
	return entries.every(
		([key, entry]) => typeof entry.key === "string" && id.test(key),
	);
}

/**
 * Keys each section by id in file order, moving the old key into `key`.
 *
 * Ids are only derived from position for a section that has not been migrated
 * yet, whose keys are PascalCase names — there, `Object.entries` order is
 * insertion order. A migrated section keeps the ids it has, because JavaScript
 * enumerates canonical integer-string keys ("10", "11") ahead of every other
 * key regardless of insertion order, so re-deriving would hand those ids to
 * different entries. That is what lets `fetch-assets` call this unconditionally.
 */
export function migrate(old: unknown): AssetIndex {
	const out: AssetIndex = { cookies: {}, pets: {}, treasures: {} };
	const treasureIds = new Map<string, string>();

	for (const section of SECTIONS) {
		const entries = Object.entries(sectionOf(old, section));
		const width = ID_WIDTH[section];
		const capacity = CAPACITY[section];

		if (entries.length > capacity) {
			throw new Error(
				`${section}: ${entries.length} entries exceeds the ${capacity} an id of width ${width} can hold`,
			);
		}

		const migrated = isMigrated(entries, width);

		entries.forEach(([oldKey, entry], position) => {
			const id = migrated ? oldKey : toId(position, width);
			const key = typeof entry.key === "string" ? entry.key : oldKey;
			// One cast at the migration boundary: the input is whatever was on
			// disk, and only the shape written below is guaranteed after this.
			if (section === "treasures") {
				treasureIds.set(oldKey, id);
				out.treasures[id] = { ...entry, key } as unknown as TreasureEntry;
				return;
			}
			out[section][id] = { ...entry, key } as unknown as Entry;
		});
	}

	// Chain references hold old keys, and are only resolvable once every
	// treasure has an id.
	const remap = (reference: string): string =>
		treasureIds.get(reference) ?? reference;

	for (const entry of Object.values(out.treasures)) {
		if (entry.type === "N") {
			const [evolved = null, blessed = null] = entry.targets;
			entry.targets = [
				evolved === null ? null : remap(evolved),
				blessed === null ? null : remap(blessed),
			];
			continue;
		}
		entry.source = remap(entry.source);
	}

	return out;
}
