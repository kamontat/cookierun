/**
 * Scrapes cookie, pet and treasure icons from cookierundb.com into `assets/`
 * and writes `assets/index.json`, keying every entry by a PascalCase id derived
 * from its display name and recording the name, its page on cookierundb.com and
 * its icon path (relative to `assets/`, or `null` where the game has no sprite).
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
const ORIGIN = "https://cookierundb.com";
const ASSETS = new URL("../assets/", import.meta.url).pathname;
const CONCURRENCY = 4;
const BAR_WIDTH = 24;

type Section = "cookies" | "pets" | "treasures";
const SECTIONS: Section[] = ["cookies", "pets", "treasures"];

/**
 * Each listing page renders one `<a class="ecard">` per entry. The icon frame
 * holds an `<img>` for entries with a sprite and a placeholder `<span>` for
 * the handful that have none, so the `<img>` is matched optionally. Only the
 * treasure listing carries `data-evo`, so that attribute is optional too.
 */
const CARD_RE =
	/<a class="ecard" href="([^"]+)"[^>]*?data-name="([^"]*)"(?:[^>]*?data-evo="([^"]*)")?[^>]*>\s*<span class="icon-frame">(?:<img src="([^"]+)")?/g;

/**
 * A treasure detail page renders its relatives as `<a class="rel-card">`, each
 * labelled by an `rc-sub` caption. Three captions matter: `Evolves from` names
 * the base treasure, and `Unblessed form` appears only on a blessed page —
 * an evolved page shows `Blessed form` instead, when a blessed form exists.
 */
const REL_RE =
	/<a class="rel-card" href="\.\.\/treasures\/([^"]+)"[\s\S]*?<span class="rc-sub">([^<]*)<\/span>/g;

const LOC_RE = /<loc>https:\/\/cookierundb\.com\/([^<]*)<\/loc>/g;

type Card = {
	slug: string;
	name: string;
	icon: string | null;
	evolved: boolean;
};

type Entry = { name: string; url: string; image: string | null };
type TreasureEntry = Entry & {
	type: "N" | "E" | "B";
	targets?: [string | null, string | null];
	source?: string;
};

function unescapeHtml(text: string): string {
	return text
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

/**
 * `Squirrel's Seashell Necklace` becomes `SquirrelSSeashellNecklace`: every run
 * of non-alphanumerics is dropped and the piece after it capitalised. A name
 * that is already one word keeps its own casing, so `GingerBrave` survives.
 */
function toId(name: string): string {
	return (name.match(/[A-Za-z0-9]+/g) ?? [])
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

/**
 * Ids are display names, and a display name can cover several entries. When two
 * entries collapse onto one id, every member of that group is numbered from 1 in
 * listing order — `SotdaeFlock1`, `SotdaeFlock2` — so no id is ever silently
 * overwritten and no colliding entry keeps the bare name. Numbering follows the
 * listing, so inserting an entry upstream can renumber the ones after it.
 */
function assignIds(cards: Card[]): Map<string, string> {
	const groups = new Map<string, Card[]>();
	for (const card of cards) {
		const id = toId(card.name);
		groups.set(id, [...(groups.get(id) ?? []), card]);
	}
	const ids = new Map<string, string>();
	for (const [id, group] of groups) {
		group.forEach((card, i) => {
			ids.set(card.slug, group.length > 1 ? `${id}${i + 1}` : id);
		});
	}
	// A numbered id can in principle land on a name that already ends in a digit,
	// which would drop one of the two entries. Nothing upstream does that today.
	const taken = new Set<string>();
	for (const [slug, id] of ids) {
		if (taken.has(id)) throw new Error(`id ${id} claimed twice, at ${slug}`);
		taken.add(id);
	}
	return ids;
}

async function get(path: string): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(ORIGIN + path);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res;
		} catch (err) {
			if (attempt === 3) throw new Error(`${path}: ${err}`);
			await Bun.sleep(500 * attempt);
		}
	}
}

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

/** Slugs the sitemap declares for each section, ignoring `/th/` translations. */
async function fetchSitemap(): Promise<Record<Section, Set<string>>> {
	const xml = await (await get("/sitemap.xml")).text();
	const slugs: Record<Section, Set<string>> = {
		cookies: new Set(),
		pets: new Set(),
		treasures: new Set(),
	};
	for (const [, loc] of xml.matchAll(LOC_RE)) {
		if (loc === undefined) continue;
		const [section, slug] = loc.split("/");
		if (slug && SECTIONS.includes(section as Section)) {
			slugs[section as Section].add(slug);
		}
	}
	return slugs;
}

async function fetchListing(section: Section): Promise<Card[]> {
	const html = await (await get(`/${section}/`)).text();
	return [...html.matchAll(CARD_RE)].map(
		([, href = "", name = "", evo = "0", icon]) => ({
			slug: href.split("/").pop() ?? "",
			name: unescapeHtml(name),
			icon: icon ? icon.replace(/^\.\.\//, "/") : null,
			evolved: evo === "1",
		}),
	);
}

/**
 * The base a treasure evolved from, and whether this page is the blessed form.
 * Returns `null` when the page names no base at all, which the caller reports
 * as drift rather than silently writing a chainless evolved treasure.
 */
async function fetchEvolution(
	slug: string,
): Promise<{ source: string; type: "E" | "B" } | null> {
	const html = await (await get(`/treasures/${slug}`)).text();
	let source: string | null = null;
	let blessed = false;
	for (const [, target = "", label = ""] of html.matchAll(REL_RE)) {
		if (label === "Evolves from") source ??= target;
		if (label === "Unblessed form") blessed = true;
	}
	return source === null ? null : { source, type: blessed ? "B" : "E" };
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

const ids: Record<Section, Map<string, string>> = {
	cookies: assignIds(cards.cookies),
	pets: assignIds(cards.pets),
	treasures: assignIds(cards.treasures),
};

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

function entryFor(section: Section, card: Card): Entry {
	if (card.icon === null) {
		spriteless++;
		return {
			name: card.name,
			url: `${ORIGIN}/${section}/${card.slug}`,
			image: null,
		};
	}
	const local = `${section}/${card.icon.split("/").pop()}`;
	downloads.set(card.icon, local);
	return {
		name: card.name,
		url: `${ORIGIN}/${section}/${card.slug}`,
		image: local,
	};
}

/** Ids are only resolvable once every card has one, so chains are mapped last. */
function idOf(slug: string): string {
	return ids.treasures.get(slug) ?? slug;
}

for (const section of ["cookies", "pets"] as const) {
	for (const card of cards[section]) {
		index[section][ids[section].get(card.slug) ?? card.slug] = entryFor(
			section,
			card,
		);
	}
}

for (const card of cards.treasures) {
	const entry = entryFor("treasures", card);
	const chain = chains.get(card.slug);
	if (chain === undefined) {
		const pair = targets.get(card.slug) ?? [null, null];
		index.treasures[idOf(card.slug)] = {
			...entry,
			type: "N",
			targets: [
				pair[0] === null ? null : idOf(pair[0]),
				pair[1] === null ? null : idOf(pair[1]),
			],
		};
		continue;
	}
	index.treasures[idOf(card.slug)] = {
		...entry,
		type: chain.type,
		source: idOf(chain.source),
	};
}

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

await Bun.write(`${ASSETS}index.json`, `${JSON.stringify(index, null, 2)}\n`);
console.log(
	`done: ${jobs.length - failures.length} downloaded, ${failures.length} failed`,
);
for (const failure of failures) console.log("  FAIL", failure);
if (failures.length > 0) process.exit(1);
