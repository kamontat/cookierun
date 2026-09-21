/**
 * Scrapes cookie, pet and treasure icons from cookierundb.com into `assets/`
 * and writes `assets/index.json`, keying every entry by the fixed-width id
 * `reconcile` (`utils/asset-ids.ts`) assigns it against what is already on
 * disk, and recording its PascalCase key, name, page on cookierundb.com and
 * icon path (relative to `assets/`, or `null` where the game has no sprite).
 * An entry no longer listed is kept and marked `retired` rather than deleted,
 * since its id may already be part of a published code.
 *
 * Treasures carry their evolution chain as well: `type` is `N` for a base
 * treasure, `E` for an evolved one and `B` for a blessed one. A base lists its
 * `targets` as `[evolved, blessed]` — either half is `null` when that form does
 * not exist — and an evolved or blessed treasure names its base as `source`.
 *
 * Network cost is four page requests (sitemap + one listing page per section),
 * one request per evolved treasure — the listing pages say that a treasure is
 * evolved but not what it evolved from, so only the detail page can link the
 * chain — plus one request per icon that is not already on disk. So a re-run
 * after a complete scrape downloads no icons but still re-reads the chain.
 *
 * The sitemap lists page URLs, not icon URLs, so it cannot drive the download
 * itself. It is used as a completeness check: if a listing page ever stops
 * rendering entries the sitemap declares, the run fails loudly instead of
 * quietly writing a short index.
 */
import { fileURLToPath } from "node:url";

import {
	type AssetIndex,
	type Entry,
	type Fingerprints,
	fingerprintProblems,
	ID_WIDTH,
	migrate,
	reconcile,
	SECTIONS,
	type Section,
	serializeIndex,
	type TreasureEntry,
	verifyCovered,
	verifyStructure,
} from "./utils/asset-ids";
import {
	type Card,
	fetchEvolution,
	fetchListing,
	fetchSitemap,
	get,
	ORIGIN,
} from "./utils/cookierundb";

// `fileURLToPath`, not `.pathname`: the latter percent-encodes, so a checkout
// under a path containing a space would not resolve.
const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));
const CONCURRENCY = 4;
const BAR_WIDTH = 24;

/**
 * A one-line progress bar for the two loops that run long enough to look hung.
 * It redraws in place on a TTY; anywhere else — a pipe, a CI log — it prints one
 * line per tenth instead, so the output stays readable without escape codes.
 */
function progress(label: string, total: number) {
	const tty = process.stdout.isTTY === true;
	let done = 0;
	let printed = 0;
	if (!tty) console.log(`${label}: 0/${total}`);
	const draw = (last: boolean) => {
		const ratio = done / total;
		if (tty) {
			const filled = Math.round(ratio * BAR_WIDTH);
			const bar = "█".repeat(filled) + "░".repeat(BAR_WIDTH - filled);
			const pct = `${Math.floor(ratio * 100)}`.padStart(3);
			process.stdout.write(
				`\r${label}: ${bar} ${pct}% ${done}/${total}${last ? "\n" : ""}`,
			);
			return;
		}
		const tenth = Math.floor(ratio * 10);
		if (tenth > printed || last) {
			printed = tenth;
			console.log(`${label}: ${done}/${total}`);
		}
	};
	draw(false);
	return {
		tick: () => {
			done++;
			draw(done === total);
		},
	};
}

/**
 * Runs `worker` over `items`, at most `CONCURRENCY` of them in flight, drawing
 * a progress bar labelled `label`. An empty list draws nothing.
 */
async function pool<T>(
	label: string,
	items: T[],
	worker: (item: T) => Promise<void>,
) {
	if (items.length === 0) return;
	const bar = progress(label, items.length);
	let cursor = 0;
	await Promise.all(
		Array.from({ length: CONCURRENCY }, async () => {
			while (cursor < items.length) {
				const item = items[cursor++];
				if (item === undefined) break;
				await worker(item);
				bar.tick();
			}
		}),
	);
}

function bail(problems: string[], label: string) {
	if (problems.length === 0) return;
	console.error(`${label} (${problems.length}):`);
	for (const line of problems) console.error(`  ${line}`);
	process.exit(1);
}

const sitemap = await fetchSitemap();
const cards: Record<Section, Card[]> = { cookies: [], pets: [], treasures: [] };
const drift: string[] = [];

for (const section of SECTIONS) {
	const listed = await fetchListing(section);
	cards[section] = listed;

	const declared = sitemap[section];
	const found = new Set(listed.map((c) => c.slug));
	for (const slug of declared) {
		if (!found.has(slug))
			drift.push(`${section}/${slug} in sitemap, not parsed`);
	}
	for (const slug of found) {
		if (!declared.has(slug))
			drift.push(`${section}/${slug} parsed, not in sitemap`);
	}
}
bail(drift, "sitemap mismatch");

const ASSETS_INDEX = `${ASSETS}index.json`;

const onDisk = await Bun.file(ASSETS_INDEX).exists();
const raw: unknown = onDisk ? await Bun.file(ASSETS_INDEX).json() : {};
const previous: AssetIndex = onDisk
	? migrate(raw)
	: { fetchedAt: null, cookies: {}, pets: {}, treasures: {} };

/**
 * The `ids moved` check below compares the new index against `previous`, which
 * is `migrate`'s own output — so it cannot see a migration that renumbered. This
 * compares against what is actually on disk, which can.
 */
const rawSections = raw as Record<string, Record<string, { url?: string }>>;
const renumbered: string[] = [];
for (const section of SECTIONS) {
	const onDiskSection = rawSections[section] ?? {};
	const shaped = new RegExp(`^[0-9A-Z]{${ID_WIDTH[section]}}$`);
	for (const [id, entry] of Object.entries(onDiskSection)) {
		if (!shaped.test(id)) continue;
		const after = previous[section][id];
		if (after === undefined || after.url !== entry.url) {
			renumbered.push(
				`${section}/${id} was ${entry.url}, migrate gave ${after?.url ?? "nothing"}`,
			);
		}
	}
}
bail(renumbered, "migrate moved an id");

const reconciled = {
	cookies: reconcile(
		"cookies",
		previous.cookies,
		cards.cookies.map((c) => c.slug),
	),
	pets: reconcile(
		"pets",
		previous.pets,
		cards.pets.map((c) => c.slug),
	),
	treasures: reconcile(
		"treasures",
		previous.treasures,
		cards.treasures.map((c) => c.slug),
	),
};

const ids: Record<Section, Map<string, string>> = {
	cookies: reconciled.cookies.ids,
	pets: reconciled.pets.ids,
	treasures: reconciled.treasures.ids,
};

function idFor(section: Section, slug: string): string {
	const id = ids[section].get(slug);
	if (id === undefined) throw new Error(`${section}/${slug} has no id`);
	return id;
}

// Only the evolved half of the treasure list needs a detail page: a base learns
// its own targets by inverting what the evolved treasures point back at.
const evolved = cards.treasures.filter((card) => card.evolved);

const chains = new Map<string, { source: string; type: "E" | "B" }>();
const chainProblems: string[] = [];
await pool("chains", evolved, async (card) => {
	const chain = await fetchEvolution(card.slug);
	if (chain === null) {
		chainProblems.push(`treasures/${card.slug} is evolved but names no base`);
		return;
	}
	if (!ids.treasures.has(chain.source)) {
		chainProblems.push(
			`treasures/${card.slug} evolves from unknown ${chain.source}`,
		);
		return;
	}
	chains.set(card.slug, chain);
});

// A base has at most one evolved and one blessed form; two of either means the
// captions no longer mean what this script assumes they do.
const targets = new Map<string, [string | null, string | null]>();
for (const card of cards.treasures) {
	if (!card.evolved) targets.set(card.slug, [null, null]);
}
for (const [slug, chain] of chains) {
	const pair = targets.get(chain.source);
	if (pair === undefined) {
		chainProblems.push(
			`treasures/${slug} evolves from evolved ${chain.source}`,
		);
		continue;
	}
	const index = chain.type === "E" ? 0 : 1;
	const taken = pair[index];
	if (taken !== null) {
		chainProblems.push(
			`treasures/${chain.source} has two ${chain.type} forms: ${taken}, ${slug}`,
		);
		continue;
	}
	pair[index] = slug;
}
bail(chainProblems, "evolution mismatch");

const index: {
	cookies: Record<string, Entry>;
	pets: Record<string, Entry>;
	treasures: Record<string, TreasureEntry>;
} = { cookies: {}, pets: {}, treasures: {} };
const downloads = new Map<string, string>(); // remote icon path -> path under assets/
let spriteless = 0;

/**
 * The readable handle the index used to be keyed by. Nothing resolves it, so a
 * name shared by two entries yielding one key is harmless — but an entry that
 * already has a key keeps it, so a rescrape does not churn the file. The keys
 * on disk carry the old collision numbering (`BabySotdae1`); recomputing them
 * would drop it for no gain.
 */
function keyOf(name: string): string {
	return (name.match(/[A-Za-z0-9]+/g) ?? [])
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

function entryFor(section: Section, card: Card, key: string): Entry {
	if (card.icon === null) {
		spriteless++;
		return {
			key,
			name: card.name,
			url: `${ORIGIN}/${section}/${card.slug}`,
			image: null,
		};
	}
	const local = `${section}/${card.icon.split("/").pop()}`;
	downloads.set(card.icon, local);
	return {
		key,
		name: card.name,
		url: `${ORIGIN}/${section}/${card.slug}`,
		image: local,
	};
}

/** An entry already in the index keeps its key; a new one is given one. */
function keyFor(section: Section, id: string, card: Card): string {
	return previous[section][id]?.key ?? keyOf(card.name);
}

for (const section of ["cookies", "pets"] as const) {
	for (const card of cards[section]) {
		const id = idFor(section, card.slug);
		index[section][id] = entryFor(section, card, keyFor(section, id, card));
	}
}

for (const card of cards.treasures) {
	const id = idFor("treasures", card.slug);
	const entry = entryFor("treasures", card, keyFor("treasures", id, card));
	const chain = chains.get(card.slug);
	if (chain === undefined) {
		const pair = targets.get(card.slug) ?? [null, null];
		index.treasures[id] = {
			...entry,
			type: "N",
			targets: [
				pair[0] === null ? null : idFor("treasures", pair[0]),
				pair[1] === null ? null : idFor("treasures", pair[1]),
			],
		};
		continue;
	}
	index.treasures[id] = {
		...entry,
		type: chain.type,
		source: idFor("treasures", chain.source),
	};
}

for (const id of reconciled.treasures.retired) {
	const entry = previous.treasures[id];
	if (entry !== undefined) index.treasures[id] = { ...entry, retired: true };
}
for (const section of ["cookies", "pets"] as const) {
	for (const id of reconciled[section].retired) {
		const entry = previous[section][id];
		if (entry !== undefined) index[section][id] = { ...entry, retired: true };
	}
}

const moved: string[] = [];
for (const section of SECTIONS) {
	for (const [id, entry] of Object.entries(previous[section])) {
		const now = index[section][id];
		if (now === undefined || now.url !== entry.url) {
			moved.push(
				`${section}/${id} was ${entry.url}, now ${now?.url ?? "gone"}`,
			);
		}
	}
}
bail(moved, "ids moved");

// Only icons absent from disk are fetched; everything else is already correct.
const jobs: [remote: string, local: string][] = [];
for (const [remote, local] of downloads) {
	if (!(await Bun.file(ASSETS + local).exists())) jobs.push([remote, local]);
}

console.log(
	`entries: ${SECTIONS.map((s) => `${s}=${Object.keys(index[s]).length}`).join(" ")}` +
		` (${spriteless} without a sprite)`,
);
console.log(
	`icons: ${downloads.size} referenced, ${downloads.size - jobs.length} on disk, ${jobs.length} to download`,
);

const failures: string[] = [];

await pool("icons", jobs, async ([remote, local]) => {
	try {
		await Bun.write(ASSETS + local, await (await get(remote)).arrayBuffer());
	} catch (err) {
		failures.push(String(err));
	}
});

// Said before anything below can bail: `bail` exits, and an operator whose run
// failed still needs to know which icons did not arrive.
console.log(
	`done: ${jobs.length - failures.length} downloaded, ${failures.length} failed`,
);
for (const failure of failures) console.log("  FAIL", failure);

// Verified before it is written, not after: a broken index that never reaches
// disk costs nothing, while one that does needs `git checkout` to undo.
const written = serializeIndex({ fetchedAt: previous.fetchedAt, ...index });
bail(verifyStructure(written), "the index this run assembled is not intact");

const FINGERPRINT = `${ASSETS}fingerprint.json`;
let appended: Section[] = [];

if (await Bun.file(FINGERPRINT).exists()) {
	const parsed: unknown = await Bun.file(FINGERPRINT).json();
	bail(fingerprintProblems(parsed), "cannot read the fingerprint");
	const expected = parsed as Fingerprints;

	// `verifyCovered`, not `verifyIndex`: appending ids is exactly what a scrape
	// is for, and covering them is `--update`'s job. What must hold is that no id
	// the fingerprint already covers has changed meaning.
	bail(
		verifyCovered(written, expected),
		"the index this run assembled moved an id",
	);

	appended = SECTIONS.filter(
		(section) => Object.keys(index[section]).length > expected[section].through,
	);
}

await Bun.write(ASSETS_INDEX, written);
console.log("index written");

if (appended.length > 0) {
	console.log(
		`appended ids beyond the fingerprint's coverage (${appended.join(", ")});` +
			" run `bun run verify:assets --update` in the same commit, or the suite will fail",
	);
}

if (failures.length > 0) process.exit(1);
