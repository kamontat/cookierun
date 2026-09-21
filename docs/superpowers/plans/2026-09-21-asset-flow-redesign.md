# Asset Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `bun run fetch:assets` record when it last succeeded and report what changed, and make `bun run verify:assets` ask cookierundb.com whether the index is still complete — removing the offline fingerprint entirely.

**Architecture:** The cookierundb.com client moves out of `scripts/fetch-assets.ts` into `scripts/utils/cookierundb.ts` so both scripts can use it and its three scrape patterns become testable. `assets/index.json` gains one top-level `fetchedAt` key. `assets/fingerprint.json` and every function that read it are deleted; the structural checks they shared a script with stay in `scripts/utils/asset-ids.test.ts`, which already runs them on every `bun run test`.

**Tech Stack:** Bun (runtime, test runner, `Bun.file`/`Bun.write`/`Bun.CryptoHasher`), TypeScript 7 with `tsc --noEmit`, Biome 2 for format and lint, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-21-asset-flow-redesign-design.md`

## Global Constraints

- **Runtime is Bun, never Node.** `Bun.file` / `Bun.write` over `node:fs`. `bun <file>`, `bun test`, `bun run <script>`. The only `node:` import in `scripts/` is `node:url`'s `fileURLToPath`, which the existing scripts already use — keep that idiom.
- **No file extensions in imports.** `from "./asset-ids"`, not `"./asset-ids.ts"`. `#assets/*` is the exception and names the extension itself (`#assets/index.json`).
- **A route never imports from `scripts/`.** Nothing in this plan changes `src/`. `src/routes/combi-name/catalog.ts` reads only `DATA.cookies`, `DATA.pets` and `DATA.treasures` and never enumerates the top level, so `fetchedAt` is invisible to it — no route edit is needed, and none should be made.
- **Treasure detail pages are re-read on every scrape, as today.** The timestamp does not gate fetching. Do not add a TTL, a staleness check or a `--force` flag; that was considered and rejected.
- **Both checks must pass:** `bun run check` (`tsc --noEmit` then `biome check`) and `bun run test`. The test files are typechecked too.
- **`assets/index.json` is written through `serializeIndex` and nothing else**, so the scraper and the verifier cannot disagree about the file's shape.
- **Ids are append-only and never reused.** Nothing in this plan may change `reconcile`, `toId`, `fromId`, `ID_WIDTH`, or `CAPACITY`.
- **`bun run format:biome` before each commit** if formatting drifts; read the diff after, since it runs `--write --unsafe`.
- Tab indentation, as the existing files use.

---

### Task 1: Extract the cookierundb.com client

Pure refactor: no behaviour changes, no output changes. It exists so `verify-assets.ts` can fetch listing pages without importing `fetch-assets.ts` — which runs its entire scrape as top-level module code — and so `CARD_RE`, `REL_RE` and `LOC_RE`, untested today, get tests.

**Files:**
- Create: `scripts/utils/cookierundb.ts`
- Create: `scripts/utils/cookierundb.test.ts`
- Modify: `scripts/fetch-assets.ts` — remove lines 44–48 (`ORIGIN`, `CONCURRENCY`), 56–99 (`CARD_RE`, `REL_RE`, `LOC_RE`, `Card`, `unescapeHtml`, `get`), 168–214 (`fetchSitemap`, `fetchListing`, `fetchEvolution`); import them instead

**Interfaces:**
- Consumes: `Section` and `SECTIONS` from `./asset-ids`
- Produces: from `scripts/utils/cookierundb.ts` —
  - `ORIGIN: string`
  - `type Card = { slug: string; name: string; icon: string | null; evolved: boolean }`
  - `unescapeHtml(text: string): string`
  - `get(path: string): Promise<Response>`
  - `parseListing(html: string): Card[]`
  - `fetchListing(section: Section): Promise<Card[]>`
  - `parseEvolution(html: string): { source: string; type: "E" | "B" } | null`
  - `fetchEvolution(slug: string): Promise<{ source: string; type: "E" | "B" } | null>`
  - `parseSitemap(xml: string): Record<Section, Set<string>>`
  - `fetchSitemap(): Promise<Record<Section, Set<string>>>`

- [ ] **Step 1: Write the failing test**

Create `scripts/utils/cookierundb.test.ts`. The fixtures mirror the real markup the three patterns were written against — a listing card is an `<a class="ecard">` whose icon frame holds an `<img>` when the entry has a sprite and a placeholder `<span>` when it does not; a treasure detail page renders relatives as `<a class="rel-card">` captioned by `<span class="rc-sub">`.

```ts
import { expect, test } from "bun:test";

import { parseEvolution, parseListing, parseSitemap } from "./cookierundb";

const withIcon =
	'<a class="ecard" href="../cookies/ch01" data-name="GingerBrave">' +
	'<span class="icon-frame"><img src="../img/cookies/ch01.png" alt=""></span></a>';

const spriteless =
	'<a class="ecard" href="../cookies/ch99" data-name="No Sprite">' +
	'<span class="icon-frame"><span class="placeholder"></span></span></a>';

const escaped =
	'<a class="ecard" href="../cookies/ch07" data-name="Dr. Wasabi&#x27;s &quot;Cookie&quot;">' +
	'<span class="icon-frame"><img src="../img/cookies/ch07.png" alt=""></span></a>';

const evolvedCard =
	'<a class="ecard" href="../treasures/stretched-acorn" data-name="Stretched Acorn" data-evo="1">' +
	'<span class="icon-frame"><img src="../img/treasures/tr034.png" alt=""></span></a>';

test("a listing card yields its slug, name and icon, rooted at the site", () => {
	expect(parseListing(withIcon)).toEqual([
		{
			slug: "ch01",
			name: "GingerBrave",
			icon: "/img/cookies/ch01.png",
			evolved: false,
		},
	]);
});

test("a card whose frame holds no img is spriteless, not skipped", () => {
	expect(parseListing(spriteless)).toEqual([
		{ slug: "ch99", name: "No Sprite", icon: null, evolved: false },
	]);
});

test("a card name is unescaped", () => {
	expect(parseListing(escaped)[0]?.name).toBe('Dr. Wasabi\'s "Cookie"');
});

// Only the treasure listing carries data-evo, which is why the pattern makes it
// optional — but when it is there, it has to be read.
test("data-evo marks a treasure as evolved", () => {
	expect(parseListing(evolvedCard)[0]?.evolved).toBe(true);
	expect(parseListing(withIcon)[0]?.evolved).toBe(false);
});

test("every card on a page is parsed, not just the first", () => {
	expect(parseListing(withIcon + spriteless + escaped)).toHaveLength(3);
});

const relCard = (slug: string, caption: string) =>
	`<a class="rel-card" href="../treasures/${slug}">` +
	`<span class="rc-name">Whatever</span><span class="rc-sub">${caption}</span></a>`;

test("an evolved page names the base it evolves from", () => {
	expect(parseEvolution(relCard("acorn", "Evolves from"))).toEqual({
		source: "acorn",
		type: "E",
	});
});

// "Unblessed form" appears only on a blessed page; an evolved one shows
// "Blessed form" instead, when a blessed form exists.
test("a page carrying an Unblessed form caption is the blessed one", () => {
	const html =
		relCard("acorn", "Evolves from") +
		relCard("stretched-acorn", "Unblessed form");

	expect(parseEvolution(html)).toEqual({ source: "acorn", type: "B" });
});

test("a page that names no base yields null rather than a chainless treasure", () => {
	expect(parseEvolution(relCard("stretched-acorn", "Blessed form"))).toBe(null);
});

test("the sitemap is read per section, ignoring the /th/ translations", () => {
	const xml =
		"<urlset>" +
		"<url><loc>https://cookierundb.com/</loc></url>" +
		"<url><loc>https://cookierundb.com/cookies/ch01</loc></url>" +
		"<url><loc>https://cookierundb.com/th/cookies/ch01</loc></url>" +
		"<url><loc>https://cookierundb.com/pets/pet01</loc></url>" +
		"<url><loc>https://cookierundb.com/treasures/acorn</loc></url>" +
		"</urlset>";

	const slugs = parseSitemap(xml);

	expect([...slugs.cookies]).toEqual(["ch01"]);
	expect([...slugs.pets]).toEqual(["pet01"]);
	expect([...slugs.treasures]).toEqual(["acorn"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test scripts/utils/cookierundb.test.ts`
Expected: FAIL — `Cannot find module './cookierundb'`.

- [ ] **Step 3: Create the module**

Create `scripts/utils/cookierundb.ts`. Every regex, the retry loop and the unescaper are moved verbatim from `scripts/fetch-assets.ts`; the only new code is the split of each parser from the fetcher that calls it.

```ts
/**
 * The cookierundb.com client: the requests, and the parsers that read what
 * comes back.
 *
 * It lives apart from `fetch-assets.ts` because that script runs its whole
 * scrape as top-level module code — importing anything from it would scrape —
 * and `verify-assets.ts` needs the listing pages too. Each parser is exported
 * beside its fetcher, so the three patterns below are testable against fixture
 * HTML without touching the network.
 */

import { SECTIONS, type Section } from "./asset-ids";

export const ORIGIN = "https://cookierundb.com";

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
 * labelled by an `rc-sub` caption. Two captions matter: `Evolves from` names
 * the base treasure, and `Unblessed form` appears only on a blessed page —
 * an evolved page shows `Blessed form` instead, when a blessed form exists.
 */
const REL_RE =
	/<a class="rel-card" href="\.\.\/treasures\/([^"]+)"[\s\S]*?<span class="rc-sub">([^<]*)<\/span>/g;

const LOC_RE = /<loc>https:\/\/cookierundb\.com\/([^<]*)<\/loc>/g;

export type Card = {
	slug: string;
	name: string;
	icon: string | null;
	evolved: boolean;
};

export function unescapeHtml(text: string): string {
	return text
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

export async function get(path: string): Promise<Response> {
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

export function parseListing(html: string): Card[] {
	return [...html.matchAll(CARD_RE)].map(
		([, href = "", name = "", evo = "0", icon]) => ({
			slug: href.split("/").pop() ?? "",
			name: unescapeHtml(name),
			icon: icon ? icon.replace(/^\.\.\//, "/") : null,
			evolved: evo === "1",
		}),
	);
}

export async function fetchListing(section: Section): Promise<Card[]> {
	return parseListing(await (await get(`/${section}/`)).text());
}

/**
 * The base a treasure evolved from, and whether this page is the blessed form.
 * Returns `null` when the page names no base at all, which the caller reports
 * as drift rather than silently writing a chainless evolved treasure.
 */
export function parseEvolution(
	html: string,
): { source: string; type: "E" | "B" } | null {
	let source: string | null = null;
	let blessed = false;
	for (const [, target = "", label = ""] of html.matchAll(REL_RE)) {
		if (label === "Evolves from") source ??= target;
		if (label === "Unblessed form") blessed = true;
	}
	return source === null ? null : { source, type: blessed ? "B" : "E" };
}

export async function fetchEvolution(
	slug: string,
): Promise<{ source: string; type: "E" | "B" } | null> {
	return parseEvolution(await (await get(`/treasures/${slug}`)).text());
}

/** Slugs the sitemap declares for each section, ignoring `/th/` translations. */
export function parseSitemap(xml: string): Record<Section, Set<string>> {
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

export async function fetchSitemap(): Promise<Record<Section, Set<string>>> {
	return parseSitemap(await (await get("/sitemap.xml")).text());
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test scripts/utils/cookierundb.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Point `fetch-assets.ts` at the new module**

In `scripts/fetch-assets.ts`, delete the moved code: the `ORIGIN` constant (line 44) — but keep `ASSETS`, `CONCURRENCY` and `BAR_WIDTH`, which stay local — the `CARD_RE`, `REL_RE` and `LOC_RE` constants with their doc comments, the `Card` type, `unescapeHtml`, `get`, `fetchSitemap`, `fetchListing` and `fetchEvolution`. Then add the import beside the existing one:

```ts
import {
	type Card,
	fetchEvolution,
	fetchListing,
	fetchSitemap,
	get,
	ORIGIN,
} from "./utils/cookierundb";
```

`ORIGIN` stays in use at the two `url:` assignments inside `entryFor`; `get` stays in use in the icon-download pool. Everything else in the file is untouched.

- [ ] **Step 6: Verify nothing else changed**

Run: `bun run check && bun run test`
Expected: both pass. The suite count rises by 9.

- [ ] **Step 7: Commit**

```bash
git add scripts/utils/cookierundb.ts scripts/utils/cookierundb.test.ts scripts/fetch-assets.ts
git commit -m "refactor: extract the cookierundb.com client from fetch-assets

The three scrape patterns had no tests, and verify-assets cannot import
from a script that runs its scrape on import.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Record `fetchedAt` in the index

Adds the timestamp field and everything that reads or writes it. The fingerprint is still in place after this task; the suite must stay green throughout, which is why `assets/index.json` gains the field here rather than later.

**Files:**
- Modify: `scripts/utils/asset-ids.ts` — `AssetIndex` (43–47), `migrate` (124–183), `serializeIndex` (198–208), `verifyStructure` (333–398)
- Modify: `scripts/utils/asset-ids.test.ts` — imports, and three new tests
- Modify: `scripts/fetch-assets.ts:241-243` — the empty-index fallback literal, which stops satisfying `AssetIndex` the moment the field is required
- Modify: `assets/index.json` — add `"fetchedAt": null,` as the first key

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: `AssetIndex` gains `fetchedAt: string | null` as its first property; new export `readFetchedAt(value: unknown): string | null`

- [ ] **Step 1: Write the failing tests**

Add to the imports at the top of `scripts/utils/asset-ids.test.ts` (keep the existing ones):

```ts
import { serializeIndex, verifyStructure } from "./asset-ids";
```

Merge those two names into the existing `from "./asset-ids"` import block rather than adding a second import — Biome will flag a duplicate.

Append these three tests to the end of `scripts/utils/asset-ids.test.ts`:

```ts
test("fetchedAt round-trips through migrate and serializeIndex, written first", () => {
	const index = migrate({
		fetchedAt: "2026-09-21T08:11:04.000Z",
		cookies: {},
		pets: {},
		treasures: {},
	});

	expect(index.fetchedAt).toBe("2026-09-21T08:11:04.000Z");
	expect(serializeIndex(index)).toBe(
		'{\n  "fetchedAt": "2026-09-21T08:11:04.000Z",\n' +
			'  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n',
	);
});

// `migrate` normalises a malformed timestamp to null, so the check has to read
// the parsed input rather than migrate's output, or it could never fire.
test("a fetchedAt that is not an ISO instant migrates to null and is reported", () => {
	const text =
		'{\n  "fetchedAt": "last tuesday",\n' +
		'  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n';

	expect(migrate(JSON.parse(text)).fetchedAt).toBe(null);
	expect(verifyStructure(text)).toContain(
		'index.json: fetchedAt "last tuesday" is neither null nor an ISO 8601 instant',
	);
});

test("an index with no fetchedAt at all is reported as missing", () => {
	const text = '{\n  "cookies": {},\n  "pets": {},\n  "treasures": {}\n}\n';

	expect(verifyStructure(text)).toContain("index.json: fetchedAt is missing");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test -t "fetchedAt"`
Expected: FAIL — `serializeIndex` writes no `fetchedAt`, so the first test's string does not match, and `verifyStructure` reports nothing about it.

- [ ] **Step 3: Add `fetchedAt` to the type and the reader**

In `scripts/utils/asset-ids.ts`, replace the `AssetIndex` type:

```ts
export type AssetIndex = {
	/**
	 * When the last fully successful scrape finished, or `null` if none has.
	 * A run that failed to download an icon leaves the previous value standing.
	 */
	fetchedAt: string | null;
	cookies: Record<string, Entry>;
	pets: Record<string, Entry>;
	treasures: Record<string, TreasureEntry>;
};
```

Add below it, beside `slugOf`:

```ts
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
```

Making the field required breaks one literal elsewhere. In `scripts/fetch-assets.ts`, the fallback for a first-ever run no longer satisfies `AssetIndex`:

```ts
const previous: AssetIndex = onDisk
	? migrate(raw)
	: { fetchedAt: null, cookies: {}, pets: {}, treasures: {} };
```

`tsc` catches this; fix it now rather than puzzling over it in Step 8.

- [ ] **Step 4: Carry it through `migrate` and `serializeIndex`**

In `migrate`, replace the first line of the body:

```ts
	const out: AssetIndex = {
		fetchedAt: readFetchedAt(
			typeof old === "object" && old !== null
				? (old as { fetchedAt?: unknown }).fetchedAt
				: undefined,
		),
		cookies: {},
		pets: {},
		treasures: {},
	};
```

In `serializeIndex`, add the field ahead of the sections:

```ts
export function serializeIndex(index: AssetIndex): string {
	return `${JSON.stringify(
		{
			fetchedAt: index.fetchedAt,
			cookies: byId(index.cookies),
			pets: byId(index.pets),
			treasures: byId(index.treasures),
		},
		null,
		2,
	)}\n`;
}
```

- [ ] **Step 5: Report a malformed timestamp in `verifyStructure`**

In `verifyStructure`, insert this immediately after `const problems: string[] = [];` and before the `serializeIndex(index) !== text` check, so the specific message comes first:

```ts
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
```

- [ ] **Step 6: Run the new tests to verify they pass**

Run: `bun run test -t "fetchedAt"`
Expected: PASS, 3 tests.

- [ ] **Step 7: Give the committed index its field**

`assets/index.json` has no `fetchedAt`, so `verifyStructure` now reports it missing and the byte-identity check fails — the whole suite goes red. Add the field as the file's first key:

```bash
bun -e 'const p = "assets/index.json"; const text = await Bun.file(p).text(); if (text.startsWith("{\n  \"fetchedAt\"")) { console.log("already present"); } else { await Bun.write(p, text.replace(/^\{\n/, "{\n  \"fetchedAt\": null,\n")); console.log("added"); }'
```

Expected: `added`. Confirm it is a one-line change and nothing else moved:

```bash
git diff --stat assets/index.json
```

Expected: `1 file changed, 1 insertion(+)`.

`null` is correct here: no scrape has run under the new code yet. Task 6 replaces it with a real timestamp.

- [ ] **Step 8: Run the whole suite**

Run: `bun run check && bun run test`
Expected: both pass. The fingerprint hashes cover entry fields only, so the new top-level key does not disturb them.

- [ ] **Step 9: Commit**

```bash
git add scripts/utils/asset-ids.ts scripts/utils/asset-ids.test.ts scripts/fetch-assets.ts assets/index.json
git commit -m "feat: record when the index was last successfully fetched

A top-level fetchedAt, null until a scrape writes one. This ends the
property that a rescrape changing nothing rewrites nothing — deliberately:
a timestamp that moved only when data changed would answer a different
question.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Delete the fingerprint

Removes `assets/fingerprint.json` and every function that read it. Six tests go with it and a seventh is rewritten. Three of those six are the *only* guard against their fault, and deleting them is the accepted trade recorded in the spec — do not try to replace them:

- a `url` swapped between two ids (`verifyStructure`'s position check sees only insertion and deletion)
- `name`/`image`/`key` swapped between two ids
- the **highest** id deleted (the remaining ids stay dense from zero, so the position check passes)

The other three tested the fingerprint's own machinery and have nothing left to test.

**Files:**
- Modify: `scripts/utils/asset-ids.ts` — delete lines 210–322 and 476–549
- Modify: `scripts/utils/asset-ids.test.ts` — imports, the `tampered` helper, six tests deleted and one rewritten
- Modify: `scripts/fetch-assets.ts` — imports, and the block at 480–509
- Delete: `assets/fingerprint.json`

**Interfaces:**
- Consumes: `verifyStructure` from `./asset-ids`, unchanged since Task 2
- Produces: `scripts/utils/asset-ids.ts` no longer exports `Fingerprint`, `Fingerprints`, `fingerprintsFor`, `fingerprintProblems`, `verifyCovered`, `verifyIndex`. `verifyStructure` becomes the only verification entry point.

- [ ] **Step 1: Cut the fingerprint out of `asset-ids.ts`**

Delete, in `scripts/utils/asset-ids.ts`:

- the `Fingerprint` and `Fingerprints` types and their doc comment (from `export type Fingerprint = {` through `export type Fingerprints = ...`)
- `fingerprintOf` and its doc comment
- `hashLines`
- `fingerprintsFor`
- `const HASH` and `fingerprintProblems`
- `verifyCovered` and its doc comment
- `verifyIndex` and its doc comment

Keep everything else exactly as it is: `Section`, `SECTIONS`, `ID_WIDTH`, `CAPACITY`, `Entry`, `TreasureEntry`, `AssetIndex`, `toId`, `fromId`, `slugOf`, `ISO`, `readFetchedAt`, `FIELD_ORDER`, `ordered`, `sectionOf`, `isMigrated`, `migrate`, `byId`, `serializeIndex`, `verifyStructure`, `chainProblems`, `reconcile`.

Then update the module's own doc comment if it mentions fingerprints — as of now it does not, so no change is expected there.

- [ ] **Step 2: Cut it out of `fetch-assets.ts`**

Change the import from `./utils/asset-ids` to drop `type Fingerprints`, `fingerprintProblems` and `verifyCovered`. It should read:

```ts
import {
	type AssetIndex,
	type Entry,
	ID_WIDTH,
	migrate,
	reconcile,
	SECTIONS,
	type Section,
	serializeIndex,
	type TreasureEntry,
	verifyStructure,
} from "./utils/asset-ids";
```

Then replace everything from `const FINGERPRINT = ...` through the closing brace of the final `if (appended.length > 0) { ... }` block with just the write:

```ts
await Bun.write(ASSETS_INDEX, written);
console.log("index written");

if (failures.length > 0) process.exit(1);
```

The `bail(verifyStructure(written), ...)` line immediately above stays — an index that never reaches disk costs nothing, while one that does needs `git checkout` to undo.

- [ ] **Step 3: Cut it out of the test file**

In `scripts/utils/asset-ids.test.ts`:

Delete the line `import fingerprint from "#assets/fingerprint.json";`. From the `./asset-ids` import block, drop `type Fingerprints`, `fingerprintProblems`, `fingerprintsFor`, `verifyCovered` and `verifyIndex`; keep `verifyStructure` and `serializeIndex` from Task 2.

Delete `const COMMITTED = fingerprint as unknown as Fingerprints;`.

Rewrite the `tampered` helper — it no longer takes a verifier or a fingerprint:

```ts
type LooseIndex = Record<string, Record<string, Record<string, unknown>>>;

async function tampered(change: (index: LooseIndex) => void): Promise<string[]> {
	const index = JSON.parse(await Bun.file(INDEX).text());
	change(index);
	return verifyStructure(`${JSON.stringify(index, null, 2)}\n`);
}
```

Replace the test at what was line 294 with the structural version:

```ts
/**
 * `bun run verify:assets` asks a different question now — is the index complete
 * against the site — so this is the only thing that checks the file's own
 * shape, and a contributor runs the suite far more often than a script they
 * have to remember.
 */
test("the committed index is structurally intact", async () => {
	const text = await Bun.file(INDEX).text();

	expect(verifyStructure(text)).toEqual([]);
});
```

Delete these six tests entirely, with their comments:

- `"the committed fingerprint covers every entry, so nothing sits outside it"`
- `"an id that comes to name a different entry is caught"`
- `"display fields swapped between two entries are caught separately"`
- `"an entry removed from the end is caught by the covered count"`
- `"an id appended past the fingerprint's coverage fails the suite"`
- `"a malformed fingerprint reports itself rather than throwing"`

Keep `"an entry removed from the middle is caught as a gap"`, `"a chain that resolves but does not point back is caught"` and `"a treasure whose type is not N, E or B is caught"` — all three run on `verifyStructure` alone and still pass.

The `entryIn` helper is still used by the type test; leave it.

- [ ] **Step 4: Delete the file**

```bash
git rm assets/fingerprint.json
```

- [ ] **Step 5: Verify**

Run: `bun run check && bun run test`
Expected: both pass. `tsc` is the check that matters most here — a leftover reference to a deleted export fails it.

- [ ] **Step 6: Commit**

```bash
git add scripts/utils/asset-ids.ts scripts/utils/asset-ids.test.ts scripts/fetch-assets.ts
git commit -m "refactor: remove the offline fingerprint

The --update ritual was paid on every append; the corruption it caught
never occurred. Three faults lose their only guard with it: a url swapped
between two ids, display fields swapped between two ids, and the highest
id deleted. verifyStructure still catches an id deleted or inserted
anywhere else, and every broken chain.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Rewrite `verify:assets` as an online count check, and schedule it

**Files:**
- Modify: `scripts/verify-assets.ts` — replaced in full
- Create: `.github/workflows/assets.yml`

**Interfaces:**
- Consumes: `fetchListing` from Task 1; `migrate`, `SECTIONS`, `AssetIndex` from `./utils/asset-ids`
- Produces: nothing other tasks import

- [ ] **Step 1: Replace `scripts/verify-assets.ts`**

```ts
/**
 * Asks cookierundb.com whether `assets/index.json` is still complete: for each
 * section, how many entries the site lists against how many this index carries
 * without `retired: true`.
 *
 * It does not check the index's own structure. `scripts/utils/asset-ids.test.ts`
 * runs `verifyStructure` over the committed file on every `bun run test`, and
 * duplicating it here would mean two places to keep in step — the thing
 * `scripts/utils/asset-ids.ts` exists to prevent.
 *
 * Network cost is three requests, one listing page per section.
 */

import { fileURLToPath } from "node:url";

import {
	type AssetIndex,
	type Entry,
	migrate,
	SECTIONS,
} from "./utils/asset-ids";
import { fetchListing } from "./utils/cookierundb";

const INDEX = fileURLToPath(new URL("../assets/index.json", import.meta.url));

function fail(lines: string[], label: string): never {
	console.error(`${label} (${lines.length}):`);
	for (const line of lines) console.error(`  ${line}`);
	process.exit(1);
}

async function readIndex(): Promise<AssetIndex> {
	if (!(await Bun.file(INDEX).exists())) {
		fail(["assets/index.json does not exist"], "nothing to verify");
	}
	try {
		return migrate(await Bun.file(INDEX).json());
	} catch (error) {
		fail(
			[`assets/index.json could not be read: ${String(error)}`],
			"nothing to verify",
		);
	}
}

const index = await readIndex();
const width = Math.max(...SECTIONS.map((section) => section.length)) + 2;
const problems: string[] = [];

console.log(`fetched ${index.fetchedAt ?? "never"}`);

for (const section of SECTIONS) {
	let site: number;
	try {
		site = (await fetchListing(section)).length;
	} catch (error) {
		fail([`${section}: ${String(error)}`], "cookierundb.com is unreachable");
	}

	// Annotated, not inferred: `index[section]` is a union of two record types,
	// and calling `.filter` on the union of their value arrays does not typecheck.
	// TreasureEntry extends Entry, so widening to Entry[] is free.
	const entries: Entry[] = Object.values(index[section]);
	const retired = entries.filter((entry) => entry.retired === true).length;
	const listed = entries.length - retired;
	const label = `${section}:`.padEnd(width);
	const tail =
		site === listed
			? "ok"
			: site > listed
				? `${site - listed} missing`
				: `${listed - site} no longer listed`;

	console.log(
		`${label} ${site} on site, ${listed} listed (${retired} retired) — ${tail}`,
	);
	if (tail !== "ok") problems.push(`${section}: ${tail}`);
}

if (problems.length > 0) {
	console.error("");
	console.error(
		"run `bun run fetch:assets` to reconcile, then commit the result",
	);
	process.exit(1);
}
```

- [ ] **Step 2: Check it compiles and the suite is unaffected**

Run: `bun run check && bun run test`
Expected: both pass. No test covers this script — it is network-bound orchestration, and its two testable pieces (`fetchListing`'s parser, `migrate`) are covered in Tasks 1 and 2.

- [ ] **Step 3: Run it against the live site**

Run: `bun run verify:assets`
Expected, given the committed index and a site that has not drifted:

```
fetched never
cookies:   94 on site, 94 listed (0 retired) — ok
pets:      103 on site, 103 listed (0 retired) — ok
treasures: 1144 on site, 1144 listed (0 retired) — ok
```

`fetched never` is correct at this point — Task 2 wrote `null` and no scrape has run yet.

If a section reports drift, that is a real finding about the site, not a bug in this task: record the numbers, continue the plan, and let Task 6's scrape reconcile it. If the site is unreachable, note it and continue — the script's behaviour on an unreachable site is the `fail` path, which is itself correct.

- [ ] **Step 4: Add the scheduled workflow**

Create `.github/workflows/assets.yml`. The action SHAs are the ones already pinned in `main.yml`; the `permissions: {}` at the top with a narrower grant on the job is the shape every workflow in this repository uses.

```yaml
name: Assets

on:
  schedule:
    - cron: "0 6 * * 1" # Mondays 06:00 UTC
  workflow_dispatch:

permissions: {}

concurrency:
  group: ${{ github.workflow }}
  cancel-in-progress: true

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    permissions:
      contents: read
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: oven-sh/setup-bun@0c5077e51419868618aeaa5fe8019c62421857d6 # v2.2.0
      - run: bun install
      - run: bun run verify:assets
```

Scheduled rather than added to `main.yml`: `verify:assets` fails whenever the site gains an entry, and `main.yml` gates the deploys — on push, the day cookierundb.com adds a cookie every open branch would go red for a reason unrelated to its own diff.

- [ ] **Step 5: Commit**

Pushing anything under `.github/workflows/` needs a token with the `workflow` scope. If the push is rejected, run `gh auth refresh -h github.com -u <account> -s workflow` and retry.

```bash
git add scripts/verify-assets.ts .github/workflows/assets.yml
git commit -m "feat: verify:assets asks the site whether the index is complete

Per section, the site's listing count against the index's non-retired
count. Weekly in CI rather than on push: it fails when upstream adds an
entry, and main.yml gates the deploys.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Report what a scrape changed

**Files:**
- Modify: `scripts/fetch-assets.ts` — imports, and the tail of the file after `console.log("index written")`

**Interfaces:**
- Consumes: `ordered` from `./utils/asset-ids`
- Produces: nothing other tasks import

- [ ] **Step 1: Import `ordered`**

Add `ordered,` to the existing `./utils/asset-ids` import block in `scripts/fetch-assets.ts`, in alphabetical position between `migrate` and `reconcile`.

- [ ] **Step 2: Add the classifier and the report**

Insert after `console.log("index written")`, replacing nothing else:

```ts
/**
 * What a run did to one entry. `restored` is not new behaviour — `reconcile`
 * matches by slug, so an entry the site lists again keeps its id and is rebuilt
 * without the flag — it is only newly visible.
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

for (const section of SECTIONS) {
	const tally: Record<Change, number> = {
		added: 0,
		updated: 0,
		retired: 0,
		restored: 0,
		unchanged: 0,
	};
	// Annotated for the same reason as in verify-assets.ts: the union of the two
	// record types does not survive Object.entries without widening.
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
```

`previous` is `migrate`'s output from the top of the script, so it is already normalised through `ordered` — which is why comparing `ordered(before)` to `ordered(after)` is a comparison of the written form, not of whatever field order happened to be in memory.

- [ ] **Step 3: Compute `fetchedAt`**

Immediately above `const written = serializeIndex(index);`, add:

```ts
// Icon downloads are the only partial-success path in this script: sitemap
// drift, a broken chain and a failed structure check all bail before the write.
// So an icon that did not arrive means the run was not a success, and the
// previous timestamp stands while the index itself is still written.
const fetchedAt =
	failures.length === 0 ? new Date().toISOString() : previous.fetchedAt;
```

and change the write itself:

```ts
const written = serializeIndex({ fetchedAt, ...index });
```

- [ ] **Step 4: Verify**

Run: `bun run check && bun run test`
Expected: both pass.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-assets.ts
git commit -m "feat: fetch:assets records fetchedAt and reports what changed

Per section: added, updated, retired, restored, unchanged. A run that
failed to download an icon leaves the previous timestamp standing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Scrape for real

Proves the whole flow end to end and replaces the placeholder `null` with a genuine timestamp. This task makes ~530 requests and takes a few minutes.

**Files:**
- Modify: `assets/index.json` — `fetchedAt`, and whatever the site has changed since the last scrape
- Possibly create: files under `assets/cookies/`, `assets/pets/`, `assets/treasures/` if the site has added icons

**Interfaces:**
- Consumes: everything from Tasks 1–5
- Produces: a committed index with a real `fetchedAt`

- [ ] **Step 1: Run the scrape**

Run: `bun run fetch:assets`
Expected: the entry and icon counts, a `chains` progress bar over the evolved treasures, `index written`, then the per-section change report.

- [ ] **Step 2: Read the diff before trusting it**

```bash
git diff --stat assets/
git diff assets/index.json | head -40
```

Expected in the quiet case: one file changed, one `fetchedAt` line replaced. If the report showed `added`, `updated`, `retired` or `restored` counts above zero, the diff must show exactly those entries and nothing else. An id whose `url` changed would have failed the run — `fetch-assets` bails on `ids moved` — so anything reaching this point is an append, a retirement or a rename.

- [ ] **Step 3: Verify both ways**

Run: `bun run verify:assets`
Expected: `fetched <the timestamp just written>` and `ok` on all three sections.

Run: `bun run check && bun run test`
Expected: both pass — in particular `"the committed index is structurally intact"`.

- [ ] **Step 4: Commit**

```bash
git add assets/
git commit -m "chore: rescrape assets under the new flow

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

**If the site is unreachable:** leave `"fetchedAt": null` in place, skip this task, say so explicitly in the final report, and carry on to Task 7. `null` is a valid value that every check accepts, and `verify:assets` prints `fetched never` for it — the flow is still correct, just unexercised.

---

### Task 7: Update the documentation

Six files describe behaviour that no longer exists. Each edit below gives the text to find and the text to replace it with.

**Files:**
- Modify: `README.md:134`
- Modify: `AGENTS.md:39-40`, `AGENTS.md:44`
- Modify: `.claude/skills/assets/SKILL.md` — frontmatter, and lines 8, 10, 32, 44–60
- Modify: `.claude/skills/repo-scripts/SKILL.md:12`
- Modify: `.claude/skills/combi-codec/SKILL.md:37`
- Modify: `.claude/skills/build-and-deploy/SKILL.md:14`, `:36-40`

**Interfaces:**
- Consumes: the behaviour built in Tasks 1–6
- Produces: nothing code imports

- [ ] **Step 1: `README.md`**

Find:

```
bun run verify:assets # checks assets/index.json against its committed fingerprint, offline
```

Replace with:

```
bun run verify:assets # asks cookierundb.com whether assets/index.json is still complete
```

- [ ] **Step 2: `AGENTS.md`**

Find the two command lines:

```
bun run fetch:assets                         # re-scrapes icons into assets/ (idempotent, skips existing)
bun run verify:assets                        # checks assets/index.json offline; --update extends the fingerprint's coverage
```

Replace with:

```
bun run fetch:assets                         # re-scrapes into assets/, records fetchedAt, reports what changed
bun run verify:assets                        # asks cookierundb.com whether index.json is still complete
```

Then find, in the paragraph below:

```
`fetch-assets.ts` scrapes the site, `verify-assets.ts` checks the committed index — against a hand edit or a bad merge as much as against a scrape.
```

Replace with:

```
`fetch-assets.ts` scrapes the site, `verify-assets.ts` asks it whether the committed index is still complete.
```

- [ ] **Step 3: `.claude/skills/repo-scripts/SKILL.md`**

Find:

```
`bun run verify:assets` checks that file against `assets/fingerprint.json` offline and is what a hand edit or a bad merge trips over.
```

Replace with:

```
`bun run verify:assets` asks cookierundb.com whether that file is still complete, comparing each section's non-retired count against the site's listing. It needs the network, so it runs weekly in `.github/workflows/assets.yml` rather than on push.
```

- [ ] **Step 4: `.claude/skills/combi-codec/SKILL.md`**

Find:

```
`assets/index.json` has no version character, so the same promise is kept by three guards instead: `reconcile` in `scripts/utils/asset-ids.ts` only ever appends an id, `fetch-assets` fails the run rather than let a rescrape move one, and `assets/fingerprint.json` — checked by `bun run verify:assets` and by the suite — catches an id moved by a hand edit or a bad merge, which no scrape would ever see.
```

Replace with:

```
`assets/index.json` has no version character, so the same promise is kept by two guards instead: `reconcile` in `scripts/utils/asset-ids.ts` only ever appends an id, and `fetch-assets` fails the run rather than let a rescrape move one. `verifyStructure`, run over the committed file by the suite, adds a third partial one: it catches an id deleted or inserted anywhere but the end, since ids must sit dense from zero. A `url` swapped between two existing ids is caught by none of them — read `git diff assets/index.json` when a merge touches it.
```

- [ ] **Step 5: `.claude/skills/build-and-deploy/SKILL.md`**

Find:

```
which is why `assets/index.json` and `assets/fingerprint.json` stay out of `dist/`
```

Replace with:

```
which is why `assets/index.json` stays out of `dist/`
```

Then find:

```
Three workflows, each pinning every action to a full commit SHA with the release tag in a trailing comment:
```

Replace with:

```
Four workflows, each pinning every action to a full commit SHA with the release tag in a trailing comment:
```

And add this bullet after the `deploy-production.yml` one:

```
- `assets.yml` — Mondays at 06:00 UTC and on `workflow_dispatch`, `bun run verify:assets`. It is the only workflow that reaches cookierundb.com, and the only one on a schedule. It is deliberately not part of `main.yml`: it fails whenever the site gains an entry, and `main.yml` gates the deploys.
```

- [ ] **Step 6: `.claude/skills/assets/SKILL.md` — the frontmatter and the opening**

In the `description:` field, remove `assets/fingerprint.json, ` so it reads `...touching assets/, assets/index.json, scripts/fetch-assets.ts, ...`.

Find:

```
Two commands own this directory. `bun run fetch:assets` scrapes cookierundb.com and rewrites the index; `bun run verify:assets` checks the index offline and touches nothing. Everything either one knows lives in `scripts/utils/asset-ids.ts`, so they cannot disagree.
```

Replace with:

```
Two commands own this directory. `bun run fetch:assets` scrapes cookierundb.com and rewrites the index; `bun run verify:assets` asks the site whether the index is still complete and touches nothing. What they know about the file's shape lives in `scripts/utils/asset-ids.ts` and what they know about the site lives in `scripts/utils/cookierundb.ts`, so they cannot disagree about either.
```

- [ ] **Step 7: `.claude/skills/assets/SKILL.md` — the scrape paragraph**

Find:

```
`bun run fetch:assets` scrapes cookie, pet, and treasure icons into `assets/` and writes `assets/index.json`. It is idempotent for icons — those already on disk are skipped, so re-running only fills gaps — but it always re-reads the treasure evolution chains, which costs one request per evolved or blessed treasure (524 today) on every run. It verifies what it wrote before exiting.
```

Replace with:

```
`bun run fetch:assets` scrapes cookie, pet, and treasure icons into `assets/` and writes `assets/index.json`. Icons already on disk are skipped, so re-running only fills gaps — but it always re-reads the treasure evolution chains, which costs one request per evolved or blessed treasure (524 today) on every run. It verifies what it wrote before writing it, prints a per-section report of what changed (`added`, `updated`, `retired`, `restored`, `unchanged`), and records the run in the index's top-level `fetchedAt`.

`fetchedAt` is written only when the run was a complete success. Icon downloads are the one partial-success path — sitemap drift, a broken chain and a failed structure check all bail before the write — so a run that lost an icon writes the index and leaves the previous timestamp standing. Because a successful run always writes it, a rescrape that changes nothing still produces a one-line diff; that is the cost of having the field, and it was taken deliberately.
```

- [ ] **Step 8: `.claude/skills/assets/SKILL.md` — the chain paragraph**

Find, inside the treasure chain paragraph:

```
The two directions are inverses of each other, so either can be walked — `verify:assets` checks that they agree, since a reference that merely resolves can still point somewhere the other side does not point back from.
```

Replace with:

```
The two directions are inverses of each other, so either can be walked — the suite checks that they agree, since a reference that merely resolves can still point somewhere the other side does not point back from.
```

In the same paragraph, find the trailing sentence:

```
so a rescrape that changes nothing rewrites nothing.
```

Replace with:

```
so a rescrape rewrites no entry it did not change.
```

- [ ] **Step 9: `.claude/skills/assets/SKILL.md` — replace the fingerprint section**

Delete the entire section from the heading `## The fingerprint, and what it is for` down to (but not including) the next `##` heading — the JSON sample, the `through` paragraph, the `verify:assets` paragraph, the `--update` paragraph, and the malformed-shape paragraph. Replace all of it with:

```
## What guards the ids now

Two guards, both inside a scrape: `reconcile` only ever appends an id, and `fetch-assets` fails the run rather than let a rescrape move one — comparing the assembled index against what was on disk before it started, and against what `migrate` made of that file, so a migration that renumbered is caught too.

A third, partial guard runs outside a scrape. `verifyStructure` in `scripts/utils/asset-ids.ts` checks that the file parses, that `migrate` leaves it alone, that it is byte-identical to what the writer would produce, that `fetchedAt` is `null` or an ISO 8601 instant, that every id is the right shape and sits where its position says, that no two entries claim one slug, that every treasure's `type` is `N`, `E` or `B`, and that every chain reference both resolves and points back. `scripts/utils/asset-ids.test.ts` runs it over the committed file, so `bun run test` fails on a broken index without anyone remembering a script.

What none of them catch is a `url` swapped between two existing ids, or display fields swapped between two entries, or the highest id deleted — ids would still sit dense from zero. A hashed fingerprint used to cover exactly those, at the cost of a `--update` that had to land in the same commit as every append; it was removed because the ritual was paid constantly and the corruption never occurred. **Read `git diff assets/index.json` when a merge touches it** — that is the guard now.

## Is the index still complete?

`bun run verify:assets` answers that, and nothing else. It fetches the three listing pages and compares, per section, the site's count against the number of entries this index carries without `retired: true`:

```
fetched 2026-09-21T08:11:04.000Z
cookies:   94 on site, 94 listed (0 retired) — ok
pets:      103 on site, 103 listed (0 retired) — ok
treasures: 1145 on site, 1144 listed (0 retired) — 1 missing
```

It exits non-zero on any mismatch, on an unreachable site, and on an index it cannot read. It does no structural checking — the suite owns that, and two implementations would drift. Because it needs the network it is not in `bun run check` and not in `main.yml`; `.github/workflows/assets.yml` runs it weekly instead.
```

- [ ] **Step 10: Check the skill files still parse and nothing stale remains**

```bash
grep -rn "fingerprint" README.md AGENTS.md .claude/skills/ scripts/ src/
```

Expected: no matches. If any remain, they are stale references — fix them.

```bash
bun run check && bun run test
```

Expected: both pass. (Documentation does not affect either, but this is the last gate before the branch is done.)

- [ ] **Step 11: Commit**

```bash
git add README.md AGENTS.md .claude/skills/
git commit -m "docs: describe the new asset flow

verify:assets is an online completeness check, the fingerprint is gone,
and the assets skill says what guards the ids in its place.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

## Done when

- `bun run check` and `bun run test` pass.
- `bun run verify:assets` prints a real timestamp and `ok` on all three sections.
- `grep -rn fingerprint` over `README.md`, `AGENTS.md`, `.claude/skills/`, `scripts/` and `src/` returns nothing.
- `assets/fingerprint.json` is gone and `assets/index.json` opens with a `fetchedAt`.
