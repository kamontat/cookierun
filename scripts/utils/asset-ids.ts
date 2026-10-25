/**
 * Wire ids for `assets/index.json`: what they are, how the file is written,
 * and what makes a written file intact.
 *
 * An id is the entry's own number on cookierunhub.com in fixed-width base 36,
 * so it is never assigned here — the site assigned it, and its page URL carries
 * it. That is what keeps an id from moving: a rescrape cannot hand a published
 * id to a different entry without the site renumbering its own pages, and
 * `verifyStructure` checks every id against the url it sits beside.
 */

import { pageUrl } from "./cookierunhub";

export type Section = "cookies" | "pets" | "treasures";

export const SECTIONS: Section[] = ["cookies", "pets", "treasures"];

/**
 * Sections the scraper does not own. Boosts have no page on cookierunhub.com
 * at all, and episodes describe a fixed part of the game rather than a catalog
 * that grows, so both are written by hand and left alone by `fetch:assets` and
 * `verify:assets`.
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

/**
 * A blessed treasure has no number of its own on the site — it is a flag on
 * its unblessed form — so its id is that form's number moved up by half the
 * treasure id space. `050` and `I1E` are the same treasure's two forms, and
 * each half holds 23,328 numbers.
 */
export const BLESSED_OFFSET = CAPACITY.treasures / 2;

export type Entry = {
	/** A readable handle derived from the name; `art.ts` looks pictures up by it. */
	key: string;
	name: string;
	url: string;
	image: string | null;
	retired?: true;
};

/**
 * The site's own treasure categories. The combi page offers every one of them,
 * but this is still a closed set the index is checked against rather than
 * whatever the site happens to say — a category nobody has decided about
 * should stop a scrape, not slip into the picker unnoticed.
 */
export const TREASURE_FAMILIES = [
	"cookie",
	"gacha",
	"limited",
	"pet",
	"squirrel",
] as const;

export type TreasureFamily = (typeof TREASURE_FAMILIES)[number];

export type TreasureEntry = Entry & { family: TreasureFamily } & (
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

/** The largest site number an unblessed entry of `section` can carry. */
export function maxHubId(section: Section): number {
	return (section === "treasures" ? BLESSED_OFFSET : CAPACITY[section]) - 1;
}

/** The wire id of the site's entry `hubId`, or of its blessed form. */
export function wireId(
	section: Section,
	hubId: number,
	blessed = false,
): string {
	return toId(blessed ? hubId + BLESSED_OFFSET : hubId, ID_WIDTH[section]);
}

/** The inverse of `wireId`: which site entry an id names, and in which form. */
export function hubIdOf(
	section: Section,
	id: string,
): { hubId: number; blessed: boolean } {
	const n = fromId(id);
	const blessed = section === "treasures" && n >= BLESSED_OFFSET;
	return { hubId: blessed ? n - BLESSED_OFFSET : n, blessed };
}

/** Exactly the shape `new Date().toISOString()` produces. */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/;

/**
 * The timestamp, or `null` for anything that is not one — a missing field, a
 * hand-written date, a number. Normalising here rather than throwing is what
 * lets `parseIndex` accept a fresh, empty index.
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
 * One field order for the file, whatever built the entry — the scraper writes
 * each field as it builds, and a retired entry is the previous one with a flag
 * added. Without this, a rescrape that changes nothing could still rewrite
 * every entry with its fields shuffled.
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

function sectionOf(
	raw: unknown,
	section: Section | StaticSection,
): Record<string, Record<string, unknown>> {
	if (typeof raw !== "object" || raw === null) return {};
	const found = (raw as Record<string, unknown>)[section];
	if (typeof found !== "object" || found === null) return {};
	return found as Record<string, Record<string, unknown>>;
}

/**
 * Reads whatever is on disk into the index's shape: a missing section is
 * empty, a malformed `fetchedAt` is `null`, and every entry's fields are put
 * in the writer's order. It checks nothing — `verifyStructure` does — so the
 * scraper can read a broken file and write a whole one over it.
 */
export function parseIndex(raw: unknown): AssetIndex {
	const out: AssetIndex = {
		fetchedAt: readFetchedAt(
			typeof raw === "object" && raw !== null
				? (raw as { fetchedAt?: unknown }).fetchedAt
				: undefined,
		),
		cookies: {},
		pets: {},
		treasures: {},
		boosts: {},
		episodes: {},
	};
	for (const section of STATIC_SECTIONS) {
		for (const [key, entry] of Object.entries(sectionOf(raw, section))) {
			out[section][key] = orderedStatic(entry as unknown as StaticEntry);
		}
	}
	for (const section of SECTIONS) {
		for (const [id, entry] of Object.entries(sectionOf(raw, section))) {
			// One cast at the boundary: only the shape `verifyStructure` checks
			// is guaranteed after this.
			out[section][id] = ordered(entry as unknown as TreasureEntry);
		}
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
 * The static sections come last so a hand edit to one shows up as a diff at
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
 * Everything about the index that can be checked without asking the site: that
 * it parses, that `fetchedAt` is `null` or an ISO 8601 instant, that it is
 * written the way the scraper writes it, that every id is the right shape and
 * names the page its url points at, that every treasure has a known family and
 * a chain that resolves both ways, and that each authored entry in a static
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

	const index = parseIndex(parsed);
	const problems: string[] = [];

	// Read off the parsed input, not off `parseIndex`'s output: that has already
	// normalised a malformed value to null, so a check downstream of it could
	// never fire.
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

		for (const [id, entry] of Object.entries(index[section])) {
			if (!shaped.test(id)) {
				problems.push(
					`${section}/${id} is not ${width} characters of [0-9A-Z]`,
				);
				continue;
			}
			// The id is the site's number for the page the url names. An id
			// that disagrees with its own url is one that moved — a published
			// code that would now mean a different entry.
			const { hubId, blessed } = hubIdOf(section, id);
			const expected = pageUrl(section, hubId, blessed);
			if (entry.url !== expected) {
				problems.push(
					`${section}/${id} names ${JSON.stringify(entry.url)}, but its id says ${expected}`,
				);
			}
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
 * not point back from. A retired form is exempt from the point-back half: its
 * base is still listed and no longer names it, which is what retiring it means.
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

		// Only a blessed form sits in the upper half of the id space.
		if ((type === "B") !== hubIdOf("treasures", id).blessed) {
			problems.push(
				`treasures/${id} is type ${type}, but its id is in the ${type === "B" ? "unblessed" : "blessed"} half`,
			);
		}

		if (type !== "N") {
			const { source } = entry as { source?: unknown };
			if (typeof source !== "string" || !resolves(source)) {
				problems.push(
					`treasures/${id} names ${JSON.stringify(source)} as its base, which is not a treasure`,
				);
				continue;
			}
			if (entry.retired === true) continue;
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
