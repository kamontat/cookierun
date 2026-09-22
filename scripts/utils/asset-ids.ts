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

/**
 * Sections the scraper does not own. Boosts have no page on cookierundb.com at
 * all, and episodes have one this project deliberately does not scrape: both
 * describe a fixed part of the game rather than a catalog that grows, so they
 * are written by hand and left alone by `fetch:assets` and `verify:assets`.
 *
 * Their keys are authored too — `ep1`, `hp-extension` — not assigned. Nothing
 * here is reachable from a loadout code: the combi codec carries its own
 * character for an episode or a boost, so these keys are a way to find an icon
 * and a name, never a wire value. That is why none of the id machinery above
 * applies to them, and why an entry may be renamed or removed without breaking
 * a published code.
 */
export type StaticSection = "boosts" | "episodes";

export const STATIC_SECTIONS: StaticSection[] = ["boosts", "episodes"];

export type StaticEntry = {
	name: string;
	/** The entry's own page, or `null` where the site has none — every boost. */
	url: string | null;
	/** Path under `assets/`, or `null` where no icon has been collected yet. */
	image: string | null;
};

/**
 * What an authored key may look like. It has to start with a letter: a key that
 * is a canonical integer string enumerates ahead of every other key whatever
 * order it was inserted in, which would put the written file out of step with
 * the sorted order `serializeIndex` produces.
 */
const STATIC_KEY = /^[a-z][a-z0-9-]*$/;

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

/**
 * How the site sorts its treasures, read from the listing card's `data-fam`.
 * The combi page offers only the families a run can equip, so this is a closed
 * set the index is checked against rather than whatever the site happens to
 * say — a family nobody has decided about should stop a scrape, not slip into
 * the picker or out of it.
 */
export const TREASURE_FAMILIES = [
	"cookie",
	"consumable",
	"draw",
	"pet",
	"special",
] as const;

export type TreasureFamily = (typeof TREASURE_FAMILIES)[number];

/**
 * `family` is optional in the type and required by `verifyStructure`, the same
 * split `fetchedAt` has: `migrate` has to accept a file written before the
 * field existed, and it cannot invent one — only a scrape can. So the type
 * describes what may arrive, and the check describes what may be committed.
 */
export type TreasureEntry = Entry & { family?: TreasureFamily } & (
		| { type: "N"; targets: [string | null, string | null] }
		| { type: "E" | "B"; source: string }
	);

export type AssetIndex = {
	/**
	 * When the last fully successful scrape finished, or `null` if none has.
	 * A run that failed to download an icon leaves the previous value standing.
	 */
	fetchedAt: string | null;
	cookies: Record<string, Entry>;
	pets: Record<string, Entry>;
	treasures: Record<string, TreasureEntry>;
	boosts: Record<string, StaticEntry>;
	episodes: Record<string, StaticEntry>;
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

/** Exactly the shape `new Date().toISOString()` produces. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * The timestamp, or `null` for anything that is not one — a missing field, a
 * hand-written date, a number. Normalising here rather than throwing is what
 * lets `migrate` accept an index written before the field existed.
 */
export function readFetchedAt(value: unknown): string | null {
	if (typeof value !== "string" || !ISO.test(value)) return null;
	return Number.isNaN(Date.parse(value)) ? null : value;
}

const FIELD_ORDER = [
	"name",
	"url",
	"image",
	"family",
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

/**
 * The static counterpart of `ordered`, and the only place a static entry's
 * shape is fixed. It keeps the three fields and drops anything else, so a hand
 * edit that invents a field is not silently carried — `verifyStructure` sees
 * the file differ from what the writer would produce and says so.
 */
export function orderedStatic(entry: StaticEntry): StaticEntry {
	return { name: entry.name, url: entry.url, image: entry.image };
}

type OldEntry = Record<string, unknown>;

function sectionOf(
	old: unknown,
	section: Section | StaticSection,
): Record<string, OldEntry> {
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
	const out: AssetIndex = {
		fetchedAt: readFetchedAt(
			typeof old === "object" && old !== null
				? (old as { fetchedAt?: unknown }).fetchedAt
				: undefined,
		),
		cookies: {},
		pets: {},
		treasures: {},
		boosts: {},
		episodes: {},
	};
	const treasureIds = new Map<string, string>();

	// Carried through, not derived: a static section has no ids to assign and no
	// old key shape to move away from. A file written before these sections
	// existed simply has none, which is what keeps `migrate` able to read it.
	for (const section of STATIC_SECTIONS) {
		for (const [key, entry] of Object.entries(sectionOf(old, section))) {
			out[section][key] = orderedStatic(entry as unknown as StaticEntry);
		}
	}

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
			// Destructured rather than read through `entry.key`: the entry comes
			// from a loose index signature, so a property access is a typecheck
			// error and a subscript is a lint one.
			const { key: scraped } = entry;
			const key = typeof scraped === "string" ? scraped : oldKey;
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

/** `byId` for a static section, whose keys are authored rather than assigned. */
function byKey(
	entries: Record<string, StaticEntry>,
): Record<string, StaticEntry> {
	const sorted: Record<string, StaticEntry> = {};
	for (const key of Object.keys(entries).sort()) {
		const entry = entries[key];
		if (entry !== undefined) sorted[key] = orderedStatic(entry);
	}
	return sorted;
}

/**
 * The one way `assets/index.json` is written, so the scraper and the verifier
 * cannot disagree about what the file should look like.
 *
 * The static sections come last so that adding them left the 1,341 scraped
 * entries above them untouched, and so a hand edit to one shows up as a diff at
 * the end of the file rather than in the middle of the treasures.
 */
export function serializeIndex(index: AssetIndex): string {
	return `${JSON.stringify(
		{
			fetchedAt: index.fetchedAt,
			cookies: byId(index.cookies),
			pets: byId(index.pets),
			treasures: byId(index.treasures),
			boosts: byKey(index.boosts),
			episodes: byKey(index.episodes),
		},
		null,
		2,
	)}\n`;
}

/**
 * Everything about the index that can be checked without knowing what it looked
 * like before: that it parses, that `migrate` accepts it and leaves it alone,
 * that `fetchedAt` is `null` or an ISO 8601 instant, that it is written the way
 * the scraper writes it, that every id is the right shape and sits where its
 * position says it should, that no two entries claim one slug, that every
 * treasure chain reference resolves, and that each authored entry in a static
 * section is shaped the way `staticProblems` describes.
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

	// Read off the parsed input, not off `migrate`'s output: migrate has already
	// normalised a malformed value to null, so a check downstream of it could
	// never fire. Without this the fault is still caught — the writer would
	// produce `null` where the file says otherwise — but only as generic drift.
	const raw =
		typeof parsed === "object" && parsed !== null
			? (parsed as { fetchedAt?: unknown }).fetchedAt
			: undefined;
	if (raw === undefined) {
		problems.push("index.json: fetchedAt is missing");
	} else if (raw !== null && readFetchedAt(raw) === null) {
		problems.push(
			`index.json: fetchedAt ${JSON.stringify(raw)} is neither null nor an ISO 8601 instant`,
		);
	}

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

	for (const section of STATIC_SECTIONS) {
		problems.push(...staticProblems(section, index[section]));
	}

	problems.push(...chainProblems(index.treasures));

	return problems;
}

/**
 * What can be checked about an authored section without a listing page to
 * compare it against: that each key is shaped the way the writer's sort
 * assumes, that the three fields are present and of the right type, that an
 * image sits under the section's own directory, and that no two entries claim
 * one page or one picture — a copied-and-edited entry whose url or image was
 * not changed is the mistake hand-writing invites.
 *
 * It cannot check that the image is on disk, since it is given the text and not
 * the directory; `asset-ids.test.ts` does that against the committed file.
 */
function staticProblems(
	section: StaticSection,
	entries: Record<string, StaticEntry>,
): string[] {
	const problems: string[] = [];
	const urls = new Map<string, string>();
	const images = new Map<string, string>();

	for (const [key, entry] of Object.entries(entries)) {
		if (!STATIC_KEY.test(key)) {
			problems.push(
				`${section}/${key} is not a key of ${String(STATIC_KEY)} — lowercase, starting with a letter`,
			);
		}

		const { name, url, image } = entry as Record<string, unknown>;

		if (typeof name !== "string" || name === "") {
			problems.push(`${section}/${key}: name ${JSON.stringify(name)} is empty`);
		}

		if (url !== null && (typeof url !== "string" || url === "")) {
			problems.push(
				`${section}/${key}: url ${JSON.stringify(url)} is neither null nor a URL`,
			);
		} else if (typeof url === "string") {
			const first = urls.get(url);
			if (first !== undefined) {
				problems.push(
					`${section}: ${url} is claimed by both ${first} and ${key}`,
				);
			}
			urls.set(url, key);
		}

		if (image === null) continue;
		if (typeof image !== "string" || !image.startsWith(`${section}/`)) {
			problems.push(
				`${section}/${key}: image ${JSON.stringify(image)} is neither null nor a path under ${section}/`,
			);
			continue;
		}
		const first = images.get(image);
		if (first !== undefined) {
			problems.push(
				`${section}: ${image} is claimed by both ${first} and ${key}`,
			);
		}
		images.set(image, key);
	}

	return problems;
}

/**
 * A base treasure lists `targets` as `[evolved, blessed]`; an evolved or
 * blessed one names its base as `source`. The two directions are inverses, so
 * each has to agree with the other — a reference that merely resolves is not
 * enough, since a merge can leave one side pointing somewhere the other does
 * not point back from.
 */
function chainProblems(treasures: Record<string, TreasureEntry>): string[] {
	const problems: string[] = [];
	const resolves = (reference: string): boolean =>
		Object.hasOwn(treasures, reference);

	for (const [id, entry] of Object.entries(treasures)) {
		const { family } = entry as { family?: unknown };
		if (
			typeof family !== "string" ||
			!(TREASURE_FAMILIES as readonly string[]).includes(family)
		) {
			problems.push(
				`treasures/${id}: family ${JSON.stringify(family)} is not one of ${TREASURE_FAMILIES.join(", ")}`,
			);
		}

		const type = (entry as { type?: unknown }).type;
		if (type !== "N" && type !== "E" && type !== "B") {
			problems.push(
				`treasures/${id}: type ${JSON.stringify(type)} is not N, E or B`,
			);
			continue;
		}

		if (type !== "N") {
			const { source } = entry as { source?: unknown };
			if (typeof source !== "string" || !resolves(source)) {
				problems.push(
					`treasures/${id} names ${JSON.stringify(source)} as its base, which is not a treasure`,
				);
				continue;
			}
			// The base must point back, in the half matching this form.
			const base = treasures[source];
			const back =
				base?.type === "N" ? base.targets[type === "E" ? 0 : 1] : null;
			if (back !== id) {
				problems.push(
					`treasures/${id} names ${source} as its base, but ${source} points at ${JSON.stringify(back)} instead`,
				);
			}
			continue;
		}

		const { targets } = entry as { targets?: unknown };
		if (!Array.isArray(targets) || targets.length !== 2) {
			problems.push(
				`treasures/${id} is a base without a [evolved, blessed] pair`,
			);
			continue;
		}

		targets.forEach((target, half) => {
			if (target === null) return;
			if (typeof target !== "string" || !resolves(target)) {
				problems.push(
					`treasures/${id} points at ${JSON.stringify(target)}, which is not a treasure`,
				);
				return;
			}
			const wanted = half === 0 ? "E" : "B";
			const form = treasures[target];
			if (form?.type !== wanted) {
				problems.push(
					`treasures/${id} lists ${target} as its ${wanted} form, but ${target} is type ${JSON.stringify(form?.type)}`,
				);
				return;
			}
			if (form.source !== id) {
				problems.push(
					`treasures/${id} lists ${target} as its ${wanted} form, but ${target} names ${form.source} as its base`,
				);
			}
		});
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
