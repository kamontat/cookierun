/**
 * Scrapes cookie, pet and treasure icons from cookierundb.com into `assets/`
 * and writes `assets/index.json` mapping each entry's display name to its
 * icon path (relative to `assets/`), or `null` where the game has no sprite.
 *
 * Network cost is four page requests (sitemap + one listing page per section)
 * plus one request per icon that is not already on disk, so a re-run after a
 * complete scrape downloads nothing.
 *
 * The sitemap lists page URLs, not icon URLs, so it cannot drive the download
 * itself. It is used as a completeness check: if a listing page ever stops
 * rendering entries the sitemap declares, the run fails loudly instead of
 * quietly writing a short index.
 */
const ORIGIN = "https://cookierundb.com";
const ASSETS = new URL("../assets/", import.meta.url).pathname;
const CONCURRENCY = 4;

type Section = "cookies" | "pets" | "treasures";
const SECTIONS: Section[] = ["cookies", "pets", "treasures"];

/**
 * Each listing page renders one `<a class="ecard">` per entry. The icon frame
 * holds an `<img>` for entries with a sprite and a placeholder `<span>` for
 * the handful that have none, so the `<img>` is matched optionally.
 */
const CARD_RE =
	/<a class="ecard" href="([^"]+)"[^>]*?data-name="([^"]*)"[^>]*>\s*<span class="icon-frame">(?:<img src="([^"]+)")?/g;

const LOC_RE = /<loc>https:\/\/cookierundb\.com\/([^<]*)<\/loc>/g;

type Card = { slug: string; name: string; icon: string | null };

function unescapeHtml(text: string): string {
	return text
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
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
	return [...html.matchAll(CARD_RE)].map(([, href = "", name = "", icon]) => ({
		slug: href.split("/").pop() ?? "",
		name: unescapeHtml(name),
		icon: icon ? icon.replace(/^\.\.\//, "/") : null,
	}));
}

const sitemap = await fetchSitemap();
const index: Record<Section, Record<string, string | null>> = {
	cookies: {},
	pets: {},
	treasures: {},
};
const downloads = new Map<string, string>(); // remote icon path -> path under assets/
const drift: string[] = [];
let spriteless = 0;

for (const section of SECTIONS) {
	const cards = await fetchListing(section);

	const declared = sitemap[section];
	const found = new Set(cards.map((c) => c.slug));
	for (const slug of declared) {
		if (!found.has(slug))
			drift.push(`${section}/${slug} in sitemap, not parsed`);
	}
	for (const slug of found) {
		if (!declared.has(slug))
			drift.push(`${section}/${slug} parsed, not in sitemap`);
	}

	const byName = new Map<string, Card[]>();
	for (const card of cards) {
		byName.set(card.name, [...(byName.get(card.name) ?? []), card]);
	}

	for (const [name, group] of byName) {
		// A name can repeat across entries. When those entries share one icon the
		// duplicate collapses; when they differ, the slug disambiguates them.
		const ambiguous = new Set(group.map((c) => c.icon)).size > 1;
		for (const card of group) {
			const key = ambiguous ? `${name} [${card.slug}]` : name;
			if (card.icon === null) {
				index[section][key] = null;
				spriteless++;
				continue;
			}
			const local = `${section}/${card.icon.split("/").pop()}`;
			downloads.set(card.icon, local);
			index[section][key] = local;
		}
	}
}

if (drift.length > 0) {
	console.error(`sitemap mismatch (${drift.length}):`);
	for (const line of drift) console.error(`  ${line}`);
	process.exit(1);
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

let cursor = 0;
let done = 0;
const failures: string[] = [];

await Promise.all(
	Array.from({ length: CONCURRENCY }, async () => {
		while (cursor < jobs.length) {
			const job = jobs[cursor++];
			if (job === undefined) break;
			const [remote, local] = job;
			try {
				await Bun.write(
					ASSETS + local,
					await (await get(remote)).arrayBuffer(),
				);
			} catch (err) {
				failures.push(String(err));
			}
			if (++done % 100 === 0) console.log(`  ${done}/${jobs.length}`);
		}
	}),
);

await Bun.write(`${ASSETS}index.json`, `${JSON.stringify(index, null, 2)}\n`);
console.log(
	`done: ${done - failures.length} downloaded, ${failures.length} failed`,
);
for (const failure of failures) console.log("  FAIL", failure);
if (failures.length > 0) process.exit(1);
