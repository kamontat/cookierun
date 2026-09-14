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

const FIELD_ORDER = [
	"name",
	"url",
	"image",
	"type",
	"targets",
	"source",
	"key",
	"retired",
] as const;

/**
 * One field order for the file, whatever built the entry. `migrate` appends
 * `key` to whatever it read, while the scraper writes each field as it builds —
 * without this, a rescrape that changes nothing still rewrites all 1,341
 * entries with their fields shuffled.
 */
export function ordered<T extends Entry>(entry: T): T {
	const source = entry as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const field of FIELD_ORDER) {
		if (field in source) out[field] = source[field];
	}
	return out as T;
}

type OldEntry = Record<string, unknown>;

function sectionOf(old: unknown, section: Section): Record<string, OldEntry> {
	const holder = old as Record<string, unknown>;
	const found = holder[section];
	if (found === undefined || found === null) return {};
	return found as Record<string, OldEntry>;
}

/**
 * A section is migrated when its keys are ids. A section with only some id
 * keys is corrupt — a hand edit or a bad merge — and re-deriving ids from
 * enumeration position would move every id in it, which is the one thing this
 * module exists to prevent. So that case stops the run instead.
 */
function isMigrated(keys: string[], width: number): boolean {
	const id = new RegExp(`^[0-9A-Z]{${width}}$`);
	const shaped = keys.filter((key) => id.test(key)).length;
	if (shaped === 0) return false;
	if (shaped === keys.length) return true;
	throw new Error(
		`partially migrated: ${shaped} of ${keys.length} keys are ids — ` +
			`re-deriving would move every id in the section`,
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

		const migrated = isMigrated(
			entries.map(([key]) => key),
			width,
		);

		entries.forEach(([oldKey, entry], position) => {
			const id = migrated ? oldKey : toId(position, width);
			const key = typeof entry.key === "string" ? entry.key : oldKey;
			// One cast at the migration boundary: the input is whatever was on
			// disk, and only the shape written below is guaranteed after this.
			if (section === "treasures") {
				treasureIds.set(oldKey, id);
				out.treasures[id] = ordered({
					...entry,
					key,
				} as unknown as TreasureEntry);
				return;
			}
			out[section][id] = ordered({ ...entry, key } as unknown as Entry);
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

function byId<T extends Entry>(entries: Record<string, T>): Record<string, T> {
	const sorted: Record<string, T> = {};
	for (const id of Object.keys(entries).sort()) {
		const entry = entries[id];
		if (entry !== undefined) sorted[id] = ordered(entry);
	}
	return sorted;
}

/**
 * The one way `assets/index.json` is written, so the scraper and the verifier
 * cannot disagree about what the file should look like.
 */
export function serializeIndex(index: AssetIndex): string {
	return `${JSON.stringify(
		{
			cookies: byId(index.cookies),
			pets: byId(index.pets),
			treasures: byId(index.treasures),
		},
		null,
		2,
	)}\n`;
}

export type Fingerprint = {
	/** How many of the section's ids the hash covers, counting from the lowest. */
	through: number;
	hash: string;
};

export type Fingerprints = Record<Section, Fingerprint>;

/**
 * Hashes what must never change: which entry each id names. Only the first
 * `through` ids of a section go in, which is what makes the fingerprint useful
 * rather than merely noisy — appending an entry leaves it untouched, while
 * renumbering, deleting or re-pointing a covered one breaks it. A renamed
 * display name or a new icon path is free, because neither changes what a
 * published code means.
 */
export function fingerprintsOf(
	index: AssetIndex,
	through: Record<Section, number>,
): Record<Section, string> {
	return {
		cookies: hashPrefix(index.cookies, through.cookies),
		pets: hashPrefix(index.pets, through.pets),
		treasures: hashPrefix(index.treasures, through.treasures),
	};
}

function hashPrefix(entries: Record<string, Entry>, through: number): string {
	const pairs = Object.keys(entries)
		.sort()
		.slice(0, through)
		.map((id) => `${id} ${slugOf(entries[id]?.url ?? "")}`);

	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(pairs.join("\n"));
	// 64 bits is far more than enough to catch an accident, and short enough to
	// read in a diff.
	return hasher.digest("hex").slice(0, 16);
}

/** Fingerprints covering every entry currently in the index. */
export function fingerprintsFor(index: AssetIndex): Fingerprints {
	const through: Record<Section, number> = {
		cookies: Object.keys(index.cookies).length,
		pets: Object.keys(index.pets).length,
		treasures: Object.keys(index.treasures).length,
	};
	const hashes = fingerprintsOf(index, through);

	return {
		cookies: { through: through.cookies, hash: hashes.cookies },
		pets: { through: through.pets, hash: hashes.pets },
		treasures: { through: through.treasures, hash: hashes.treasures },
	};
}

/**
 * Everything about the index that can be checked without knowing what it looked
 * like before: that it parses, that `migrate` accepts it and leaves it alone,
 * that it is written the way the scraper writes it, that every id is the right
 * shape and sits where its position says it should, that no two entries claim
 * one slug, and that every treasure chain reference resolves.
 *
 * Returns one line per problem, so a caller can report them all at once.
 */
export function verifyStructure(text: string): string[] {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch (error) {
		return [`index.json is not valid JSON: ${String(error)}`];
	}

	let index: AssetIndex;
	try {
		index = migrate(parsed);
	} catch (error) {
		return [`migrate refused the index: ${String(error)}`];
	}

	const problems: string[] = [];

	// A file the writer would rewrite means the next scrape produces a diff
	// nobody asked for — field order, key order or indentation has drifted.
	if (serializeIndex(index) !== text) {
		problems.push(
			"index.json is not what the writer would produce — field order, key order or indentation has drifted",
		);
	}

	for (const section of SECTIONS) {
		const width = ID_WIDTH[section];
		const shaped = new RegExp(`^[0-9A-Z]{${width}}$`);
		const ids = Object.keys(index[section]).sort();

		ids.forEach((id, position) => {
			if (!shaped.test(id)) {
				problems.push(
					`${section}/${id} is not ${width} characters of [0-9A-Z]`,
				);
				return;
			}
			// Ids are assigned from zero and never removed, so the nth lowest id
			// is always n. Anything else means one was deleted or inserted, which
			// moves every id after it.
			const belongs = toId(position, width);
			if (id !== belongs) {
				problems.push(
					`${section}: id ${id} sits where ${belongs} should be — an id was deleted or inserted`,
				);
			}
		});

		const seen = new Map<string, string>();
		for (const [id, entry] of Object.entries(index[section])) {
			const slug = slugOf(entry.url);
			const first = seen.get(slug);
			if (first !== undefined) {
				problems.push(
					`${section}: ${slug} is claimed by both ${first} and ${id}`,
				);
				continue;
			}
			seen.set(slug, id);
		}
	}

	for (const [id, entry] of Object.entries(index.treasures)) {
		const references =
			entry.type === "N"
				? entry.targets.filter((target): target is string => target !== null)
				: [entry.source];

		for (const reference of references) {
			if (!Object.hasOwn(index.treasures, reference)) {
				problems.push(
					`treasures/${id} points at ${reference}, which is not a treasure`,
				);
			}
		}
	}

	return problems;
}

/**
 * `verifyStructure` plus the question only the committed fingerprint can
 * answer: does every covered id still name the entry it named when the
 * fingerprint was recorded?
 */
export function verifyIndex(text: string, expected: Fingerprints): string[] {
	const problems = verifyStructure(text);
	if (problems.length > 0) return problems;

	// Structure passed, so this parse and migrate cannot fail.
	const index = migrate(JSON.parse(text));
	const actual = fingerprintsOf(index, {
		cookies: expected.cookies.through,
		pets: expected.pets.through,
		treasures: expected.treasures.through,
	});

	for (const section of SECTIONS) {
		const { through, hash } = expected[section];
		const count = Object.keys(index[section]).length;

		if (count < through) {
			problems.push(
				`${section}: ${count} entries, fewer than the ${through} the fingerprint covers — an entry was removed`,
			);
			continue;
		}
		if (actual[section] !== hash) {
			problems.push(
				`${section}: fingerprint ${actual[section]} does not match the committed ${hash} — an id within the first ${through} changed meaning`,
			);
		}
	}

	return problems;
}

/**
 * Matches a listing against the index already on disk. A slug keeps whatever id
 * it was first given, a new slug takes one past the highest in use, and a slug
 * that no longer appears is reported so the caller can retire its entry instead
 * of deleting it. Ids are never reassigned, so no existing code changes meaning.
 */
export function reconcile(
	section: Section,
	existing: Record<string, Entry>,
	slugs: string[],
): { ids: Map<string, string>; retired: string[] } {
	const bySlug = new Map<string, string>();
	let highest = -1;

	for (const [id, entry] of Object.entries(existing)) {
		bySlug.set(slugOf(entry.url), id);
		highest = Math.max(highest, fromId(id));
	}

	const width = ID_WIDTH[section];
	const capacity = CAPACITY[section];
	const ids = new Map<string, string>();

	for (const slug of slugs) {
		const known = bySlug.get(slug);
		if (known !== undefined) {
			ids.set(slug, known);
			continue;
		}
		highest += 1;
		if (highest >= capacity) {
			throw new Error(`${section}: no id left, ${capacity} already in use`);
		}
		ids.set(slug, toId(highest, width));
	}

	const listed = new Set(slugs);
	const retired = Object.entries(existing)
		.filter(([, entry]) => !listed.has(slugOf(entry.url)))
		.map(([id]) => id);

	return { ids, retired };
}
