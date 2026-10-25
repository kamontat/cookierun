/**
 * Syncs cookie, pet and treasure entries and icons from cookierunhub.com into
 * `assets/` and writes `assets/index.json`. Every entry is keyed by its wire
 * id — the site's own number for it in base 36, see `utils/asset-ids.ts` — and
 * records a readable key, its name, its page on cookierunhub.com and its icon
 * path (relative to `assets/`, or `null` where the site has no picture). An
 * entry the site no longer lists is kept and marked `retired` rather than
 * deleted, since its id may already be part of a published code.
 *
 * Treasures carry their evolution chain as well: `type` is `N` for a base
 * treasure, `E` for an evolved one and `B` for a blessed one. A base lists its
 * `targets` as `[evolved, blessed]` — either half is `null` when that form does
 * not exist — and an evolved or blessed treasure names its base as `source`.
 *
 * Network cost is three API requests, one per section, plus one request per
 * icon that is not already on disk. An icon on disk that no entry names any
 * more is deleted, so `assets/` holds exactly what the index points at.
 */
import { fileURLToPath } from "node:url";

import {
	type AssetIndex,
	type Entry,
	ordered,
	parseIndex,
	SECTIONS,
	type Section,
	serializeIndex,
	type TreasureEntry,
	verifyStructure,
} from "./utils/asset-ids";
import { fetchRows, get } from "./utils/cookierunhub";
import { entriesFrom } from "./utils/hub-index";

// `fileURLToPath`, not `.pathname`: the latter percent-encodes, so a checkout
// under a path containing a space would not resolve.
const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));
const ASSETS_INDEX = `${ASSETS}index.json`;
const CONCURRENCY = 4;
const BAR_WIDTH = 24;

/**
 * A one-line progress bar for the download loop, which runs long enough to look
 * hung. It redraws in place on a TTY; anywhere else — a pipe, a CI log — it
 * prints one line per tenth instead, so the output stays readable without
 * escape codes.
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

const onDisk = await Bun.file(ASSETS_INDEX).exists();
const previous: AssetIndex = parseIndex(
	onDisk ? await Bun.file(ASSETS_INDEX).json() : {},
);

const index: {
	cookies: Record<string, Entry>;
	pets: Record<string, Entry>;
	treasures: Record<string, TreasureEntry>;
} = { cookies: {}, pets: {}, treasures: {} };
const downloads = new Map<string, string>(); // path under assets/ -> remote URL
const problems: string[] = [];

for (const section of SECTIONS) {
	const synced = entriesFrom(section, await fetchRows(section));
	problems.push(...synced.problems);
	for (const [local, remote] of synced.icons) downloads.set(local, remote);
	Object.assign(index[section], synced.entries);
}
bail(problems, "the site's listing cannot be represented");

// An id the site stopped listing keeps its entry, flagged, so a code that
// carries it still reads. Its icon stays on disk for the same reason.
for (const section of SECTIONS) {
	const current: Record<string, Entry> = index[section];
	for (const [id, entry] of Object.entries(previous[section])) {
		if (Object.hasOwn(current, id)) continue;
		current[id] = { ...entry, retired: true };
	}
}

const spriteless = SECTIONS.flatMap((section) =>
	Object.values(index[section] as Record<string, Entry>),
).filter((entry) => entry.image === null).length;

// Only icons absent from disk are fetched; everything else is already correct.
const jobs: [local: string, remote: string][] = [];
for (const [local, remote] of downloads) {
	if (!(await Bun.file(ASSETS + local).exists())) jobs.push([local, remote]);
}

console.log(
	`entries: ${SECTIONS.map((s) => `${s}=${Object.keys(index[s]).length}`).join(" ")}` +
		` (${spriteless} without a picture)`,
);
console.log(
	`icons: ${downloads.size} referenced, ${downloads.size - jobs.length} on disk, ${jobs.length} to download`,
);

const failures: string[] = [];
const absent = new Set<string>();

await pool("icons", jobs, async ([local, remote]) => {
	try {
		const res = await get(remote);
		await Bun.write(ASSETS + local, await res.arrayBuffer());
	} catch (err) {
		// The site lists a picture it does not serve — its own page falls back
		// to a placeholder for these too. That is an entry without a picture,
		// not a download that failed and should be retried.
		if (String(err).includes("HTTP 404")) absent.add(local);
		else failures.push(String(err));
	}
});

for (const section of SECTIONS) {
	for (const entry of Object.values(index[section] as Record<string, Entry>)) {
		if (entry.image !== null && absent.has(entry.image)) entry.image = null;
	}
}

// Said before anything below can bail: `bail` exits, and an operator whose run
// failed still needs to know which icons did not arrive.
console.log(
	`done: ${jobs.length - failures.length - absent.size} downloaded, ` +
		`${absent.size} not on the site, ${failures.length} failed`,
);
for (const local of absent) console.log("  MISSING", local);
for (const failure of failures) console.log("  FAIL", failure);

// Icon downloads are the only partial-success path in this script: a listing
// it cannot represent and a failed structure check both bail before the write.
// So an icon that did not arrive means the run was not a success, and the
// previous timestamp stands while the index itself is still written.
const fetchedAt =
	failures.length === 0 ? new Date().toISOString() : previous.fetchedAt;

// Verified before it is written, not after: a broken index that never reaches
// disk costs nothing, while one that does needs `git checkout` to undo.
//
// The static sections are copied from what was on disk. This script has no
// source for them — they are authored — so a sync must hand them back exactly
// as it found them rather than dropping them from the file it rewrites.
const written = serializeIndex({
	fetchedAt,
	...index,
	boosts: previous.boosts,
	episodes: previous.episodes,
});
bail(verifyStructure(written), "the index this run assembled is not intact");

await Bun.write(ASSETS_INDEX, written);
console.log("index written");

// Every icon an entry names, retired ones included; anything else under a
// section's directory is left over from an entry or a source that is gone.
const named = new Set<string>();
for (const section of SECTIONS) {
	for (const entry of Object.values(index[section] as Record<string, Entry>)) {
		if (entry.image !== null) named.add(entry.image);
	}
}
let pruned = 0;
for (const section of SECTIONS) {
	for await (const file of new Bun.Glob(`${section}/*`).scan(ASSETS)) {
		if (named.has(file)) continue;
		await Bun.file(ASSETS + file).delete();
		pruned++;
	}
}
console.log(`icons pruned: ${pruned}`);

/**
 * What a run did to one entry. `restored` is an entry the site lists again
 * after a run that retired it: its id is the site's number, so it comes back
 * under the same one.
 */
type Change = "added" | "updated" | "retired" | "restored" | "unchanged";

function classify(before: Entry | undefined, after: Entry): Change {
	if (before === undefined) return "added";
	if (before.retired !== true && after.retired === true) return "retired";
	if (before.retired === true && after.retired !== true) return "restored";
	return JSON.stringify(ordered(before)) === JSON.stringify(ordered(after))
		? "unchanged"
		: "updated";
}

const reportWidth = Math.max(...SECTIONS.map((section) => section.length)) + 2;

for (const section of SECTIONS as Section[]) {
	const tally: Record<Change, number> = {
		added: 0,
		updated: 0,
		retired: 0,
		restored: 0,
		unchanged: 0,
	};
	// Annotated: the union of the two record types does not survive
	// Object.entries without widening.
	const entries: [string, Entry][] = Object.entries(index[section]);
	for (const [id, entry] of entries) {
		tally[classify(previous[section][id], entry)]++;
	}
	console.log(
		`${`${section}:`.padEnd(reportWidth)} ${entries.length} total —` +
			` ${tally.added} added, ${tally.updated} updated,` +
			` ${tally.retired} retired, ${tally.restored} restored,` +
			` ${tally.unchanged} unchanged`,
	);
}

if (failures.length > 0) process.exit(1);
