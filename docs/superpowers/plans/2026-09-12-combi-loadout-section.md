# Loadout Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second, variable-length code section that carries the cookie, relay, pet, and up to three treasure slots, so a full build — not just the run configuration — fits in one shareable code.

**Architecture:** A code becomes `loadout.combi`, where `combi` is the existing untouched ten-character code and `loadout` is a new tagged-group section. `assets/index.json` is re-keyed by a fixed-width base-36 wire ID, assigned append-only, making it the catalog the codec resolves against. The page grows pickers for the four new fields, and the icons those pickers show ship beside the built HTML instead of inlined into it.

**Tech Stack:** Bun 1.4.2, TypeScript 7.0.2 (`tsc --noEmit`), Biome 2.5.13, `bun test` with happy-dom, Pico CSS, plain custom elements (no framework).

**Spec:** `docs/superpowers/specs/2026-09-12-combi-loadout-section-design.md`

## Global Constraints

- `routes/combi-name/codec.ts` is not modified. `VERSION` stays `"1"`, the character tables keep their key order, and `routes/combi-name/exhaustive.test.ts` keeps both hardcoded counts (1,769,472 and 1,474,560).
- Every code valid today must stay valid and decode to the same combi, with an empty loadout.
- ID widths: cookies 2, pets 2, treasures 3. Capacities: 1,296 / 1,296 / 46,656. In use today: 94 / 103 / 1,144.
- IDs are fixed-width uppercase base-36. Lexicographic order on them equals numeric order, so plain string sorting is correct everywhere.
- Loadout section version is `"1"`, independent of the combi section's version.
- Group order in a loadout is always `C R P T`; each group appears at most once.
- `scripts/utils/shell.ts`'s `execAsync` calls `process.exit` and never returns. Anything after it in a script is dead code.
- `tsconfig.json` sets `noUncheckedIndexedAccess` and `@kcconfigs/biome` forbids `!`. Narrow with a destructuring default, `??`, or a guarded `const` — never a non-null assertion. Test files may use `!` only where the existing tests already do (`components/check-group.test.ts` does).
- Components are light DOM, no shadow root; styles go in `routes/base.css` scoped by element name and must include a `display` rule; `customElements.define` is guarded by `customElements.get`; attributes carry markup configuration, properties carry data; nothing in `components/` imports from `routes/`.
- Run `bun run check` (typecheck plus Biome) before every commit.
- `bun run test` is the whole suite (~3s). `bun run test <file>` and `bun run test -t "<name>"` filter.

---

### Task 1: Base-36 IDs and the index migration

**Files:**
- Create: `scripts/utils/asset-ids.ts`
- Create: `scripts/utils/asset-ids.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `type Section = "cookies" | "pets" | "treasures"`, `type Entry`, `type TreasureEntry`, `type AssetIndex`, `ID_WIDTH: Record<Section, number>`, `CAPACITY: Record<Section, number>`, `toId(n: number, width: number): string`, `fromId(id: string): number`, `migrate(old: unknown): AssetIndex`.

- [ ] **Step 1: Write the failing test**

Create `scripts/utils/asset-ids.test.ts`:

```ts
import { expect, test } from "bun:test";

import { fromId, migrate, toId } from "./asset-ids.ts";

test("an id is fixed-width uppercase base-36", () => {
	expect(toId(0, 2)).toBe("00");
	expect(toId(35, 2)).toBe("0Z");
	expect(toId(36, 2)).toBe("10");
	expect(toId(1143, 3)).toBe("0VR");
});

test("ids read back as the number they encode", () => {
	expect(fromId("00")).toBe(0);
	expect(fromId("0Z")).toBe(35);
	expect(fromId("0VR")).toBe(1143);
});

// Lexicographic order has to equal numeric order, because every sort in the
// codec and the catalog sorts the strings rather than the numbers.
test("lexicographic order on ids equals numeric order", () => {
	const ids = Array.from({ length: 300 }, (_, n) => toId(n, 3));
	expect([...ids].sort()).toEqual(ids);
});

test("migrate keys each section by id in file order and moves the old key", () => {
	const migrated = migrate({
		cookies: {
			GingerBrave: {
				name: "GingerBrave",
				url: "https://cookierundb.com/cookies/ch01",
				image: "cookies/ch01.png",
			},
		},
		pets: {},
		treasures: {},
	});

	expect(migrated.cookies).toEqual({
		"00": {
			key: "GingerBrave",
			name: "GingerBrave",
			url: "https://cookierundb.com/cookies/ch01",
			image: "cookies/ch01.png",
		},
	});
});

test("migrate rewrites treasure chain references to the new ids", () => {
	const migrated = migrate({
		cookies: {},
		pets: {},
		treasures: {
			Acorn: {
				name: "Acorn",
				url: "https://cookierundb.com/treasures/acorn",
				image: null,
				type: "N",
				targets: ["StretchedAcorn", null],
			},
			StretchedAcorn: {
				name: "Stretched Acorn",
				url: "https://cookierundb.com/treasures/stretched-acorn",
				image: "treasures/tr_ga034.png",
				type: "E",
				source: "Acorn",
			},
		},
	});

	expect(migrated.treasures["000"]).toEqual({
		key: "Acorn",
		name: "Acorn",
		url: "https://cookierundb.com/treasures/acorn",
		image: null,
		type: "N",
		targets: ["001", null],
	});
	expect(migrated.treasures["001"]).toEqual({
		key: "StretchedAcorn",
		name: "Stretched Acorn",
		url: "https://cookierundb.com/treasures/stretched-acorn",
		image: "treasures/tr_ga034.png",
		type: "E",
		source: "000",
	});
});

test("migrate leaves an already-migrated index alone", () => {
	const once = migrate({
		cookies: {
			GingerBrave: {
				name: "GingerBrave",
				url: "https://cookierundb.com/cookies/ch01",
				image: "cookies/ch01.png",
			},
		},
		pets: {},
		treasures: {},
	});

	expect(migrate(once)).toEqual(once);
});

test("migrate refuses a section that would overflow its id width", () => {
	const cookies: Record<string, unknown> = {};
	for (let n = 0; n < 1297; n++) {
		cookies[`C${n}`] = {
			name: `C${n}`,
			url: `https://cookierundb.com/cookies/c${n}`,
			image: null,
		};
	}

	expect(() => migrate({ cookies, pets: {}, treasures: {} })).toThrow(
		"cookies: 1297 entries exceeds the 1296 an id of width 2 can hold",
	);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test scripts/utils/asset-ids.test.ts`
Expected: FAIL — `Cannot find module './asset-ids.ts'`.

- [ ] **Step 3: Write the implementation**

Create `scripts/utils/asset-ids.ts`:

```ts
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
 * Keys each section by id in file order, moving the old key into `key`. Runs on
 * an already-migrated index without changing it, which is what lets
 * `fetch-assets` call it unconditionally.
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

		entries.forEach(([oldKey, entry], position) => {
			const id = toId(position, width);
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test scripts/utils/asset-ids.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add scripts/utils/asset-ids.ts scripts/utils/asset-ids.test.ts
git commit -m "feat(assets): add base-36 wire ids and the index migration"
```

---

### Task 2: Migrate `assets/index.json` in place

**Files:**
- Modify: `assets/index.json` (generated content, ~340KB diff)

**Interfaces:**
- Consumes: `migrate` from `scripts/utils/asset-ids.ts`.
- Produces: an `assets/index.json` keyed by wire id, which every later task reads.

- [ ] **Step 1: Record what the file looks like now**

Run:

```bash
bun -e 'const j = await Bun.file("assets/index.json").json();
for (const s of ["cookies","pets","treasures"]) console.log(s, Object.keys(j[s]).length);
console.log(Object.keys(j.treasures).slice(0,2));'
```

Expected: `cookies 94`, `pets 103`, `treasures 1144`, and PascalCase keys such as `AlwaysCuteAcorn`. Write those three counts down; the next step must reproduce them exactly.

- [ ] **Step 2: Apply the migration**

Run:

```bash
bun -e 'import { migrate } from "./scripts/utils/asset-ids.ts";
const old = await Bun.file("assets/index.json").json();
const next = migrate(old);
await Bun.write("assets/index.json", `${JSON.stringify(next, null, 2)}\n`);'
```

- [ ] **Step 3: Verify the result**

Run:

```bash
bun -e 'const j = await Bun.file("assets/index.json").json();
for (const s of ["cookies","pets","treasures"]) {
  // Sorted, not in key order: JavaScript enumerates canonical integer-string
  // keys ("10", "11") ahead of every other key, so ids[0] is not the lowest id.
  const ids = Object.keys(j[s]).sort();
  const width = s === "treasures" ? 3 : 2;
  console.log(s, ids.length, ids[0], ids.at(-1), ids.every((i) => new RegExp(`^[0-9A-Z]{${width}}$`).test(i)));
}
const broken = Object.entries(j.treasures).filter(([, e]) =>
  e.type === "N"
    ? e.targets.some((t) => t !== null && !(t in j.treasures))
    : !(e.source in j.treasures));
console.log("broken chain references:", broken.length);
console.log(j.cookies["00"]);'
```

Expected: the same three counts as Step 1; lowest id `00`/`00`/`000`; highest id `2L`/`2U`/`0VR`; every id the right width; `broken chain references: 0`; and the cookie entry carrying `key`, `name`, `url`, `image`.

Then confirm the migration is a fixed point, since `fetch-assets` will call it on every run:

```bash
bun -e 'import { migrate } from "./scripts/utils/asset-ids.ts";
const now = await Bun.file("assets/index.json").json();
console.log("stable:", Bun.deepEquals(migrate(now), now));'
```

Expected: `stable: true`.

- [ ] **Step 4: Commit**

```bash
git add assets/index.json
git commit -m "refactor(assets)!: key index.json by wire id instead of display name"
```

---

### Task 3: Append-only reconciliation in the scraper

**Files:**
- Modify: `scripts/utils/asset-ids.ts` (add `reconcile`)
- Modify: `scripts/utils/asset-ids.test.ts` (add `reconcile` tests)
- Modify: `scripts/fetch-assets.ts:80-113` (delete `toId`/`assignIds`), `:264-268` (call `reconcile`), `:317-377` (build the index by id), `:403` (sort keys on write)

**Interfaces:**
- Consumes: `AssetIndex`, `ID_WIDTH`, `CAPACITY`, `toId`, `fromId`, `slugOf`, `migrate`.
- Produces: `reconcile(section: Section, existing: Record<string, Entry>, slugs: string[]): { ids: Map<string, string>; retired: string[] }` — `ids` maps every listed slug to its id, `retired` lists existing ids whose slug is no longer listed.

- [ ] **Step 1: Write the failing test**

Append to `scripts/utils/asset-ids.test.ts`:

```ts
import { reconcile } from "./asset-ids.ts";

const existing = {
	"00": {
		key: "First",
		name: "First",
		url: "https://cookierundb.com/cookies/first",
		image: null,
	},
	"01": {
		key: "Second",
		name: "Second",
		url: "https://cookierundb.com/cookies/second",
		image: null,
	},
};

test("a slug already in the index keeps its id, wherever it now sorts", () => {
	const { ids } = reconcile("cookies", existing, ["second", "first"]);

	expect(ids.get("first")).toBe("00");
	expect(ids.get("second")).toBe("01");
});

test("a new slug takes the next free id", () => {
	const { ids } = reconcile("cookies", existing, ["first", "second", "third"]);

	expect(ids.get("third")).toBe("02");
});

test("a vanished slug is reported as retired rather than dropped", () => {
	const { ids, retired } = reconcile("cookies", existing, ["first"]);

	expect(retired).toEqual(["01"]);
	expect(ids.has("second")).toBe(false);
});

// The next free id is one past the highest in use, never the entry count, or a
// retired id would be handed to a different entry.
test("a retired id is never reused", () => {
	const { ids } = reconcile("cookies", existing, ["first", "third"]);

	expect(ids.get("third")).toBe("02");
});

test("reconcile refuses to exceed the section capacity", () => {
	const full: Record<string, (typeof existing)["00"]> = {};
	for (let n = 0; n < 1296; n++) {
		full[`X${n}`] = {
			key: `X${n}`,
			name: `X${n}`,
			url: `https://cookierundb.com/cookies/x${n}`,
			image: null,
		};
	}
	// Keys above are placeholders for shape only; ids come from the map below.
	const byId = Object.fromEntries(
		Object.values(full).map((entry, n) => [toId(n, 2), entry]),
	);

	expect(() => reconcile("cookies", byId, ["brand-new"])).toThrow(
		"cookies: no id left, 1296 already in use",
	);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test scripts/utils/asset-ids.test.ts`
Expected: FAIL — `reconcile` is not exported.

- [ ] **Step 3: Add `reconcile`**

Append to `scripts/utils/asset-ids.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test scripts/utils/asset-ids.test.ts`
Expected: PASS, 12 tests.

- [ ] **Step 5: Wire the scraper to it**

In `scripts/fetch-assets.ts`:

1. Delete `toId` and `assignIds` with their doc comments (lines 80-113) and the `idOf` helper (lines 343-346).
2. Add to the imports at the top of the file:

```ts
import {
	type AssetIndex,
	type Entry,
	migrate,
	reconcile,
	type Section,
	SECTIONS,
	type TreasureEntry,
} from "./utils/asset-ids.ts";
```

3. Replace the `const ids = { ... assignIds ... }` block (lines 264-268) with:

```ts
const ASSETS_INDEX = `${ASSETS}index.json`;

const onDisk = await Bun.file(ASSETS_INDEX).exists();
const previous: AssetIndex = onDisk
	? migrate(await Bun.file(ASSETS_INDEX).json())
	: { cookies: {}, pets: {}, treasures: {} };

const reconciled = {
	cookies: reconcile("cookies", previous.cookies, cards.cookies.map((c) => c.slug)),
	pets: reconcile("pets", previous.pets, cards.pets.map((c) => c.slug)),
	treasures: reconcile("treasures", previous.treasures, cards.treasures.map((c) => c.slug)),
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
```

4. Replace `entryFor` (lines 325-341) with a version that carries the `key`, which is no longer an id and is resolved by nothing:

```ts
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
```

5. Replace both index-building loops (lines 348-377) with:

```ts
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
```

6. After those loops, carry retired entries across and assert nothing moved:

```ts
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
			moved.push(`${section}/${id} was ${entry.url}, now ${now?.url ?? "gone"}`);
		}
	}
}
bail(moved, "ids moved");
```

7. Sort each section by id before writing, so the output is deterministic and a rescrape appends rather than interleaving. Note the limit: `JSON.stringify` emits canonical integer-string keys (`"10"`, `"11"`) first whatever the insertion order, so the file is sorted within those two groups rather than globally. Deterministic either way, which is what matters — nothing reads the file in key order:

```ts
function byId<T>(entries: Record<string, T>): Record<string, T> {
	const sorted: Record<string, T> = {};
	for (const id of Object.keys(entries).sort()) {
		const entry = entries[id];
		if (entry !== undefined) sorted[id] = entry;
	}
	return sorted;
}

await Bun.write(
	ASSETS_INDEX,
	`${JSON.stringify(
		{
			cookies: byId(index.cookies),
			pets: byId(index.pets),
			treasures: byId(index.treasures),
		},
		null,
		2,
	)}\n`,
);
```

8. Delete the now-duplicated local declarations: `type Section` and `const SECTIONS` (lines 28-29) and `type Entry`/`type TreasureEntry` (lines 58-63). `Section`, `SECTIONS`, `Entry` and `TreasureEntry` all come from `./utils/asset-ids.ts` instead. Note the imported `TreasureEntry` is a discriminated union rather than the old optional-field shape, so the `type: "N"` branch must set `targets` and the `"E"`/`"B"` branch must set `source` — which the loops above already do.

- [ ] **Step 6: Verify the scraper typechecks and is idempotent on the committed index**

Run: `bun run check`
Expected: clean.

Run: `bun run fetch-assets`
Expected: `entries: cookies=94 pets=103 treasures=1144`, `0 to download`, and `git diff --stat assets/index.json` shows **no change**. If the network is unavailable, skip this run and say so in the commit message; the reconcile tests cover the logic.

- [ ] **Step 7: Commit**

```bash
bun run check
git add scripts/utils/asset-ids.ts scripts/utils/asset-ids.test.ts scripts/fetch-assets.ts
git commit -m "feat(assets): assign ids append-only and retire vanished entries"
```

---

### Task 4: The catalog module

**Files:**
- Modify: `package.json:6-9` (add `#assets/*`)
- Create: `routes/combi-name/catalog.ts`
- Create: `routes/combi-name/catalog.test.ts`

**Interfaces:**
- Consumes: `assets/index.json`, and the types from `scripts/utils/asset-ids.ts`.
- Produces: `type CatalogSection = "cookies" | "pets" | "treasures"`, `type PickerOption = readonly [id: string, label: string, image: string | null]`, `hasId(section, id): boolean`, `isRetired(section, id): boolean`, `nameFor(section, id): string`, `imageFor(section, id): string | null`, `optionsFor(section): readonly PickerOption[]`, `ID_WIDTH`, `CAPACITY`.

- [ ] **Step 1: Add the import mapping**

In `package.json`, the `imports` field becomes:

```json
	"imports": {
		"#lib/*": "./lib/*",
		"#components/*": "./components/*",
		"#assets/*": "./assets/*"
	},
```

- [ ] **Step 2: Write the failing test**

Create `routes/combi-name/catalog.test.ts`:

```ts
import { expect, test } from "bun:test";

import {
	CAPACITY,
	hasId,
	ID_WIDTH,
	imageFor,
	isRetired,
	nameFor,
	optionsFor,
	type CatalogSection,
} from "./catalog.ts";

const SECTIONS: CatalogSection[] = ["cookies", "pets", "treasures"];

test("every id is the right width for its section and within capacity", () => {
	for (const section of SECTIONS) {
		const width = ID_WIDTH[section];
		const ids = optionsFor(section).map(([id]) => id);

		expect(ids.length).toBeGreaterThan(0);
		expect(ids.length).toBeLessThanOrEqual(CAPACITY[section]);
		for (const id of ids) {
			expect(id).toMatch(new RegExp(`^[0-9A-Z]{${width}}$`));
		}
	}
});

test("options come back in id order, which is what the wire format sorts by", () => {
	for (const section of SECTIONS) {
		const ids = optionsFor(section).map(([id]) => id);
		expect([...ids].sort()).toEqual(ids);
	}
});

test("known ids resolve and unknown ones do not", () => {
	expect(hasId("cookies", "00")).toBe(true);
	expect(hasId("treasures", "000")).toBe(true);
	expect(hasId("cookies", "ZZ")).toBe(false);
	expect(hasId("treasures", "00")).toBe(false);
});

test("the first cookie reads as its display name", () => {
	expect(nameFor("cookies", "00")).toBe("GingerBrave");
	expect(imageFor("cookies", "00")).toBe("cookies/ch01.png");
});

test("an unknown id names itself rather than throwing", () => {
	expect(nameFor("cookies", "ZZ")).toBe("ZZ");
	expect(imageFor("cookies", "ZZ")).toBe(null);
});

// Two live entries can share a display name — 5 treasure names and 1 pet name
// do today. The id disambiguates the code; the label has to disambiguate the
// picker, and it disambiguates with the id, since a shared name yields a shared
// key and so the key would add nothing.
test("a display name shared by two entries is labelled with its id", () => {
	const labels = optionsFor("treasures").map(([, label]) => label);
	expect(new Set(labels).size).toBe(labels.length);

	const sotdae = optionsFor("pets").filter(([, label]) =>
		label.startsWith("Sotdae Flock"),
	);
	expect(sotdae).toHaveLength(3);
	for (const [id, label] of sotdae) {
		expect(label).toBe(`Sotdae Flock [${id}]`);
	}
});

test("nothing in the catalog is retired yet, and retired entries stay out of the options", () => {
	for (const section of SECTIONS) {
		const ids = optionsFor(section).map(([id]) => id);
		expect(ids.filter((id) => isRetired(section, id))).toEqual([]);
	}
});

// The catalog declares these itself so a route never imports from scripts/.
// This is the guard against the two copies drifting apart.
test("the widths match the ones the scraper assigns ids with", async () => {
	const scraper = await import("../../scripts/utils/asset-ids.ts");

	expect(ID_WIDTH).toEqual(scraper.ID_WIDTH);
	expect(CAPACITY).toEqual(scraper.CAPACITY);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `bun run test routes/combi-name/catalog.test.ts`
Expected: FAIL — `Cannot find module './catalog.ts'`.

- [ ] **Step 4: Write the implementation**

Create `routes/combi-name/catalog.ts`:

```ts
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

export function imageFor(
	section: CatalogSection,
	id: string,
): string | null {
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `bun run test routes/combi-name/catalog.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Check and commit**

```bash
bun run check
git add package.json routes/combi-name/catalog.ts routes/combi-name/catalog.test.ts
git commit -m "feat(combi-name): read the asset catalog through #assets"
```

---

### Task 5: The loadout codec

**Files:**
- Create: `routes/combi-name/loadout.ts`
- Create: `routes/combi-name/loadout.test.ts`

**Interfaces:**
- Consumes: `hasId`, `ID_WIDTH` from `./catalog.ts`.
- Produces: `type Loadout = { cookie: string | null; relay: string | null; pet: string | null; treasures: string[][]; ordered: boolean }`, `LOADOUT_VERSION = "1"`, `emptyLoadout(): Loadout`, `isEmptyLoadout(l: Loadout): boolean`, `encodeLoadout(l: Loadout): string`, `decodeLoadout(section: string): Loadout`, `MAX_TREASURE_SLOTS = 3`.

- [ ] **Step 1: Write the failing test**

Create `routes/combi-name/loadout.test.ts`:

```ts
import { expect, test } from "bun:test";

import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
} from "./loadout.ts";

function loadout(over: Partial<Loadout> = {}): Loadout {
	return { ...emptyLoadout(), ...over };
}

test("an empty loadout is recognised as empty", () => {
	expect(isEmptyLoadout(emptyLoadout())).toBe(true);
	expect(isEmptyLoadout(loadout({ cookie: "00" }))).toBe(false);
	expect(isEmptyLoadout(loadout({ treasures: [["000"]] }))).toBe(false);
});

test("each group carries its tag, and an unset field is left out", () => {
	expect(encodeLoadout(loadout({ cookie: "2L" }))).toBe("1C2L");
	expect(encodeLoadout(loadout({ pet: "1Z" }))).toBe("1P1Z");
	expect(
		encodeLoadout(loadout({ cookie: "00", relay: "01", pet: "02" })),
	).toBe("1C00R01P02");
});

test("groups are written in C R P T order", () => {
	const code = encodeLoadout(
		loadout({ cookie: "00", relay: "01", pet: "02", treasures: [["000"]] }),
	);
	expect(code).toBe("1C00R01P02TU000");
});

test("alternatives within a slot are joined by _ and sorted", () => {
	expect(encodeLoadout(loadout({ treasures: [["0RB", "0FZ"]] }))).toBe(
		"1TU0FZ_0RB",
	);
});

test("slots are joined by - and sorted when order does not matter", () => {
	expect(
		encodeLoadout(loadout({ treasures: [["0QQ"], ["000"]], ordered: false })),
	).toBe("1TU000-0QQ");
});

test("slot order is preserved when order matters", () => {
	expect(
		encodeLoadout(loadout({ treasures: [["0QQ"], ["000"]], ordered: true })),
	).toBe("1TO0QQ-000");
});

// With one slot there is nothing to order, so O would be a second code for the
// same build.
test("a single slot is always written U", () => {
	expect(encodeLoadout(loadout({ treasures: [["000"]], ordered: true }))).toBe(
		"1TU000",
	);
});

test("decoding reads every group back", () => {
	expect(decodeLoadout("1C00R01P02TO0QQ-000_0RB")).toEqual({
		cookie: "00",
		relay: "01",
		pet: "02",
		treasures: [["0QQ"], ["000", "0RB"]],
		ordered: true,
	});
});

test("a non-canonical code decodes as written and re-encodes canonically", () => {
	const decoded = decodeLoadout("1TU0QQ-000");
	expect(decoded.treasures).toEqual([["0QQ"], ["000"]]);
	expect(encodeLoadout(decoded)).toBe("1TU000-0QQ");
});

test("the version character is checked", () => {
	expect(() => decodeLoadout("2C00")).toThrow('unsupported loadout version "2"');
	expect(() => decodeLoadout("")).toThrow("loadout section is empty");
});

test("an unknown group tag is rejected", () => {
	expect(() => decodeLoadout("1X00")).toThrow('unknown loadout group "X"');
});

test("a repeated group is rejected", () => {
	expect(() => decodeLoadout("1C00C01")).toThrow(
		'loadout group "C" appears twice',
	);
});

test("groups out of C R P T order are rejected", () => {
	expect(() => decodeLoadout("1P02C00")).toThrow(
		'loadout group "C" is out of order, expected C R P T',
	);
});

test("an id of the wrong width or shape is rejected", () => {
	expect(() => decodeLoadout("1C0")).toThrow(
		'loadout group "C": "0" is not 2 characters of [0-9A-Z]',
	);
	expect(() => decodeLoadout("1TU00")).toThrow(
		'loadout group "T": "00" is not 3 characters of [0-9A-Z]',
	);
});

test("an id absent from the catalog is rejected", () => {
	expect(() => decodeLoadout("1CZZ")).toThrow(
		'loadout group "C": no cookie has id "ZZ"',
	);
	expect(() => decodeLoadout("1TUZZZ")).toThrow(
		'loadout group "T": no treasure has id "ZZZ"',
	);
});

test("the order flag has to be U or O", () => {
	expect(() => decodeLoadout("1TX000")).toThrow(
		'loadout group "T": order flag "X" is neither "U" nor "O"',
	);
	expect(() => decodeLoadout("1T")).toThrow(
		'loadout group "T": missing the order flag',
	);
});

test("more than three slots is rejected", () => {
	expect(() => decodeLoadout("1TU000-001-002-003")).toThrow(
		"loadout group \"T\": 4 treasure slots, at most 3 fit",
	);
});

test("an empty slot is rejected", () => {
	expect(() => decodeLoadout("1TU000--001")).toThrow(
		'loadout group "T": slot 2 is empty',
	);
});

// The same treasure cannot be equipped twice in one slot, but two slots may
// both accept it — that is how overlapping alternatives are written.
test("a repeated id within one slot is rejected, across slots is allowed", () => {
	expect(() => decodeLoadout("1TU000_000")).toThrow(
		'loadout group "T": slot 1 lists "000" twice',
	);
	expect(decodeLoadout("1TU000-000").treasures).toEqual([["000"], ["000"]]);
});

test("encoding validates the same rules as decoding", () => {
	expect(() => encodeLoadout(loadout({ cookie: "ZZ" }))).toThrow(
		'loadout group "C": no cookie has id "ZZ"',
	);
	expect(() =>
		encodeLoadout(loadout({ treasures: [["000"], ["001"], ["002"], ["003"]] })),
	).toThrow("loadout group \"T\": 4 treasure slots, at most 3 fit");
	expect(() => encodeLoadout(loadout({ treasures: [[]] }))).toThrow(
		'loadout group "T": slot 1 is empty',
	);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test routes/combi-name/loadout.test.ts`
Expected: FAIL — `Cannot find module './loadout.ts'`.

- [ ] **Step 3: Write the implementation**

Create `routes/combi-name/loadout.ts`:

```ts
/**
 * The loadout section: the cookie, relay, pet and treasure slots the game
 * already stores in a combi, carried so a whole build fits in one code.
 *
 * It is the left half of `loadout.combi`, variable length, and lives outside
 * the game's ten-character combi name — which is why it can afford tags and
 * separators the combi section cannot.
 *
 *     1C2LR0BP1ZTU0FZ_0RB-0QQ
 *     │└cookie      │ └ treasures: slot 1 accepts 0FZ or 0RB, slot 2 wants 0QQ
 *     │  └relay     └pet
 *     └ this section's own version, independent of the combi section's
 *
 * Encoding canonicalizes — ids sorted within a slot, slots sorted when order
 * does not matter — so one build has exactly one code. Decoding accepts a
 * non-canonical code as written.
 */

import { hasId, ID_WIDTH, type CatalogSection } from "./catalog.ts";

export type Loadout = {
	/** Catalog id, or null when unset. */
	cookie: string | null;
	relay: string | null;
	pet: string | null;
	/** 0-3 slots, each holding one or more acceptable treasure ids. */
	treasures: string[][];
	/** Whether slot position matters. Meaningless with fewer than two slots. */
	ordered: boolean;
};

export const LOADOUT_VERSION = "1";
export const MAX_TREASURE_SLOTS = 3;

/** A factory rather than a shared constant: the default must not be mutable. */
export function emptyLoadout(): Loadout {
	return { cookie: null, relay: null, pet: null, treasures: [], ordered: false };
}

export function isEmptyLoadout(loadout: Loadout): boolean {
	return (
		loadout.cookie === null &&
		loadout.relay === null &&
		loadout.pet === null &&
		loadout.treasures.length === 0
	);
}

type SingleGroup = {
	tag: "C" | "R" | "P";
	section: CatalogSection;
	noun: string;
	field: "cookie" | "relay" | "pet";
	width: number;
};

/** Group order is the wire format: a loadout always reads C, R, P, T. */
const SINGLE_GROUPS: SingleGroup[] = [
	{
		tag: "C",
		section: "cookies",
		noun: "cookie",
		field: "cookie",
		width: ID_WIDTH.cookies,
	},
	{
		tag: "R",
		section: "cookies",
		noun: "cookie",
		field: "relay",
		width: ID_WIDTH.cookies,
	},
	{
		tag: "P",
		section: "pets",
		noun: "pet",
		field: "pet",
		width: ID_WIDTH.pets,
	},
];

const TREASURE_WIDTH = ID_WIDTH.treasures;
const TAG_ORDER = ["C", "R", "P", "T"];

function fail(tag: string, detail: string): never {
	throw new Error(`loadout group "${tag}": ${detail}`);
}

function checkId(
	tag: string,
	section: CatalogSection,
	noun: string,
	width: number,
	id: string,
): void {
	if (!new RegExp(`^[0-9A-Z]{${width}}$`).test(id)) {
		fail(tag, `"${id}" is not ${width} characters of [0-9A-Z]`);
	}
	if (!hasId(section, id)) fail(tag, `no ${noun} has id "${id}"`);
}

function checkTreasures(slots: string[][]): void {
	if (slots.length > MAX_TREASURE_SLOTS) {
		fail("T", `${slots.length} treasure slots, at most ${MAX_TREASURE_SLOTS} fit`);
	}
	slots.forEach((slot, position) => {
		if (slot.length === 0) fail("T", `slot ${position + 1} is empty`);
		const seen = new Set<string>();
		for (const id of slot) {
			checkId("T", "treasures", "treasure", TREASURE_WIDTH, id);
			if (seen.has(id)) fail("T", `slot ${position + 1} lists "${id}" twice`);
			seen.add(id);
		}
	});
}

export function encodeLoadout(loadout: Loadout): string {
	let out = LOADOUT_VERSION;

	for (const { tag, section, noun, field, width } of SINGLE_GROUPS) {
		const id = loadout[field];
		if (id === null) continue;
		checkId(tag, section, noun, width, id);
		out += tag + id;
	}

	checkTreasures(loadout.treasures);
	if (loadout.treasures.length === 0) return out;

	const slots = loadout.treasures.map((slot) => [...slot].sort());
	const ordered = slots.length > 1 && loadout.ordered;
	// Fixed-width uppercase base-36 sorts lexicographically in numeric order, so
	// comparing slots as strings is comparing their ids. It has to be the whole
	// slot: two slots sharing their smallest id would otherwise tie, and a tie
	// leaves the caller's order in place — one build with two codes.
	const key = (slot: string[]): string => slot.join("_");
	const arranged = ordered
		? slots
		: [...slots].sort((a, b) => {
				if (key(a) === key(b)) return 0;
				return key(a) < key(b) ? -1 : 1;
			});

	return `${out}T${ordered ? "O" : "U"}${arranged.map((slot) => slot.join("_")).join("-")}`;
}

export function decodeLoadout(section: string): Loadout {
	if (section.length === 0) throw new Error("loadout section is empty");

	const version = section.slice(0, 1);
	if (version !== LOADOUT_VERSION) {
		throw new Error(`unsupported loadout version "${version}"`);
	}

	const loadout = emptyLoadout();
	const seen = new Set<string>();
	let furthest = -1;
	let rest = section.slice(1);

	while (rest.length > 0) {
		const tag = rest.slice(0, 1);
		const position = TAG_ORDER.indexOf(tag);
		if (position === -1) throw new Error(`unknown loadout group "${tag}"`);
		if (seen.has(tag)) throw new Error(`loadout group "${tag}" appears twice`);
		if (position < furthest) {
			throw new Error(
				`loadout group "${tag}" is out of order, expected C R P T`,
			);
		}
		seen.add(tag);
		furthest = position;
		rest = rest.slice(1);

		const single = SINGLE_GROUPS.find((group) => group.tag === tag);
		if (single !== undefined) {
			const id = rest.slice(0, single.width);
			checkId(single.tag, single.section, single.noun, single.width, id);
			loadout[single.field] = id;
			rest = rest.slice(single.width);
			continue;
		}

		// T is last in the order, so the whole remainder belongs to it.
		const flag = rest.slice(0, 1);
		if (flag.length === 0) fail("T", "missing the order flag");
		if (flag !== "U" && flag !== "O") {
			fail("T", `order flag "${flag}" is neither "U" nor "O"`);
		}
		loadout.ordered = flag === "O";
		loadout.treasures = rest
			.slice(1)
			.split("-")
			.map((slot) => (slot === "" ? [] : slot.split("_")));
		checkTreasures(loadout.treasures);
		rest = "";
	}

	return loadout;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test routes/combi-name/loadout.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add routes/combi-name/loadout.ts routes/combi-name/loadout.test.ts
git commit -m "feat(combi-name): encode and decode the loadout section"
```

---

### Task 6: Joining the two sections

**Files:**
- Create: `routes/combi-name/full-code.ts`
- Create: `routes/combi-name/full-code.test.ts`

**Interfaces:**
- Consumes: `encode`, `decode`, `type Combi` from `./codec.ts`; `encodeLoadout`, `decodeLoadout`, `emptyLoadout`, `isEmptyLoadout`, `type Loadout` from `./loadout.ts`.
- Produces: `type FullCode = { loadout: Loadout; combi: Combi }`, `encodeFull(full: FullCode): string`, `decodeFull(code: string): { full: FullCode; warnings: string[] }`, `combiSectionOf(code: string): string`.

- [ ] **Step 1: Write the failing test**

Create `routes/combi-name/full-code.test.ts`:

```ts
import { expect, test } from "bun:test";

import type { Combi } from "./codec.ts";
import { combiSectionOf, decodeFull, encodeFull } from "./full-code.ts";
import { emptyLoadout, type Loadout } from "./loadout.ts";

const combi: Combi = {
	type: "score",
	episode: "any",
	boosts: [],
	randomBoost: null,
	cookiePowers: [],
	action: "none",
};

function loadout(over: Partial<Loadout> = {}): Loadout {
	return { ...emptyLoadout(), ...over };
}

test("an empty loadout writes the bare ten-character code", () => {
	expect(encodeFull({ loadout: emptyLoadout(), combi })).toBe("1S0---000-");
});

test("a loadout is written before the combi, separated by a dot", () => {
	expect(
		encodeFull({ loadout: loadout({ cookie: "00", treasures: [["000"]] }), combi }),
	).toBe("1C00TU000.1S0---000-");
});

// Every code that worked before this feature has to keep working.
test("a bare code decodes with an empty loadout and the same combi", () => {
	const { full, warnings } = decodeFull("1E3-PF400J");

	expect(full.loadout).toEqual(emptyLoadout());
	expect(full.combi.type).toBe("exp");
	expect(full.combi.boosts).toEqual(["powerJellyBoost", "fastStart"]);
	expect(full.combi.randomBoost).toBe("revive");
	expect(full.combi.action).toBe("jumpAtStart");
	expect(warnings).toEqual([]);
});

test("both sections decode together", () => {
	const { full } = decodeFull("1C00P02TU000.1S0HPF014-");

	expect(full.loadout.cookie).toBe("00");
	expect(full.loadout.pet).toBe("02");
	expect(full.loadout.treasures).toEqual([["000"]]);
	expect(full.combi.cookiePowers).toEqual(["fairy", "seaFairy"]);
});

test("the combi section's soft warning survives the join", () => {
	const { warnings } = decodeFull("1C00.1A3H-F400-");

	expect(warnings).toHaveLength(1);
	expect(warnings[0]).toContain("slot 2 says Auto");
});

test("a second dot is refused", () => {
	expect(() => decodeFull("1C00.1S0---000-.x")).toThrow(
		'a code holds at most one ".", got 2',
	);
});

test("an unreadable combi section still throws from the combi codec", () => {
	expect(() => decodeFull("1C00.1S0---000")).toThrow(
		"code must be exactly 10 characters",
	);
});

test("combiSectionOf picks the right half, or the whole code", () => {
	expect(combiSectionOf("1C00.1S0---000-")).toBe("1S0---000-");
	expect(combiSectionOf("1S0---000-")).toBe("1S0---000-");
	expect(combiSectionOf("1C0")).toBe("1C0");
});

// The loadout space is unbounded once alternatives exist, so the round trip is
// covered by a seeded sample rather than exhaustively.
test("a seeded sample of loadouts round-trips to its canonical form", () => {
	// mulberry32: every step stays in 32-bit range. The obvious LCG
	// (`seed * 1103515245 + 12345`) overflows 2^53 and degenerates into a
	// generator that returns 0 almost always, which silently empties this loop.
	let seed = 20260912;
	const random = (bound: number): number => {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) % bound;
	};

	const cookieIds = ["00", "01", "2L"];
	const petIds = ["00", "02", "2U"];
	const treasureIds = ["000", "001", "0FZ", "0QQ", "0VR"];
	const pick = <T>(from: T[]): T => from[random(from.length)] as T;

	for (let run = 0; run < 2000; run++) {
		const slots: string[][] = [];
		for (let slot = 0; slot < random(4); slot++) {
			const ids = new Set<string>();
			for (let alt = 0; alt <= random(3); alt++) ids.add(pick(treasureIds));
			slots.push([...ids]);
		}

		const full = {
			loadout: {
				cookie: random(2) === 0 ? null : pick(cookieIds),
				relay: random(2) === 0 ? null : pick(cookieIds),
				pet: random(2) === 0 ? null : pick(petIds),
				treasures: slots,
				ordered: random(2) === 0,
			},
			combi,
		};

		const code = encodeFull(full);
		expect(encodeFull(decodeFull(code).full)).toBe(code);
	}
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test routes/combi-name/full-code.test.ts`
Expected: FAIL — `Cannot find module './full-code.ts'`.

- [ ] **Step 3: Write the implementation**

Create `routes/combi-name/full-code.ts`:

```ts
/**
 * A full code is `loadout.combi`, or just `combi` when there is no loadout.
 *
 * The right half is the ten characters the game's combi name field holds,
 * unchanged; the left half is everything the game already stores in the combi
 * itself. Splitting them is what keeps the right half copy-pasteable into the
 * game, and what keeps every code written before the loadout existed valid.
 */

import { type Combi, decode, encode } from "./codec.ts";
import {
	decodeLoadout,
	emptyLoadout,
	encodeLoadout,
	isEmptyLoadout,
	type Loadout,
} from "./loadout.ts";

export type FullCode = {
	loadout: Loadout;
	combi: Combi;
};

export const SECTION_SEPARATOR = ".";

export function encodeFull(full: FullCode): string {
	const combi = encode(full.combi);
	if (isEmptyLoadout(full.loadout)) return combi;
	return `${encodeLoadout(full.loadout)}${SECTION_SEPARATOR}${combi}`;
}

/**
 * The combi half of whatever has been typed so far, so the page can count
 * characters against it while the code is still incomplete.
 */
export function combiSectionOf(code: string): string {
	const at = code.lastIndexOf(SECTION_SEPARATOR);
	return at === -1 ? code : code.slice(at + 1);
}

export function decodeFull(code: string): {
	full: FullCode;
	warnings: string[];
} {
	const parts = code.split(SECTION_SEPARATOR);
	if (parts.length > 2) {
		throw new Error(
			`a code holds at most one "${SECTION_SEPARATOR}", got ${parts.length - 1}`,
		);
	}

	const [first = "", second] = parts;
	if (second === undefined) {
		const { combi, warnings } = decode(first);
		return { full: { loadout: emptyLoadout(), combi }, warnings };
	}

	const loadout = decodeLoadout(first);
	const { combi, warnings } = decode(second);
	return { full: { loadout, combi }, warnings };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test routes/combi-name/full-code.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Confirm the combi codec is untouched**

Run: `bun run test routes/combi-name/exhaustive.test.ts routes/combi-name/codec.test.ts`
Expected: PASS, with both hardcoded counts intact.

Run: `git diff --stat routes/combi-name/codec.ts`
Expected: no output.

- [ ] **Step 6: Check and commit**

```bash
bun run check
git add routes/combi-name/full-code.ts routes/combi-name/full-code.test.ts
git commit -m "feat(combi-name): join the loadout and combi sections"
```

---

### Task 7: Describing a loadout

**Files:**
- Modify: `routes/combi-name/describe.ts`
- Modify: `routes/combi-name/describe.test.ts`

**Interfaces:**
- Consumes: `nameFor`, `isRetired` from `./catalog.ts`; `type Loadout` from `./loadout.ts`; `type FullCode` from `./full-code.ts`.
- Produces: `describeLoadout(loadout: Loadout): DescribedRow[]`, `describeFull(full: FullCode): DescribedCombi`. `describeCombi` keeps its current signature and behaviour.

- [ ] **Step 1: Write the failing test**

Append to `routes/combi-name/describe.test.ts`:

```ts
import { describeFull, describeLoadout } from "./describe.ts";
import { emptyLoadout } from "./loadout.ts";

test("an empty loadout reads as four None rows", () => {
	expect(describeLoadout(emptyLoadout())).toEqual([
		{ field: "Cookie", value: "None" },
		{ field: "Relay", value: "None" },
		{ field: "Pet", value: "None" },
		{ field: "Treasures", value: "None" },
	]);
});

test("a picked cookie, relay and pet read as their names", () => {
	const rows = describeLoadout({
		...emptyLoadout(),
		cookie: "00",
		relay: "01",
		pet: "00",
	});

	expect(rows[0]).toEqual({ field: "Cookie", value: "GingerBrave" });
	expect(rows[1]?.field).toBe("Relay");
	expect(rows[2]?.field).toBe("Pet");
});

test("alternatives read as or, and slots as a numbered list when order matters", () => {
	const unordered = describeLoadout({
		...emptyLoadout(),
		treasures: [["000", "001"], ["002"]],
		ordered: false,
	});
	expect(unordered[3]?.field).toBe("Treasures");
	expect(unordered[3]?.value).toContain(" or ");
	expect(unordered[3]?.value).toContain("; ");

	const ordered = describeLoadout({
		...emptyLoadout(),
		treasures: [["000"], ["001"]],
		ordered: true,
	});
	expect(ordered[3]?.field).toBe("Treasures (exact order)");
	expect(ordered[3]?.value.startsWith("1. ")).toBe(true);
});

test("the loadout rows come before the combi rows", () => {
	const { rows } = describeFull({
		loadout: { ...emptyLoadout(), cookie: "00" },
		combi: {
			type: "score",
			episode: "any",
			boosts: [],
			randomBoost: null,
			cookiePowers: [],
			action: "none",
		},
	});

	expect(rows.map(({ field }) => field)).toEqual([
		"Cookie",
		"Relay",
		"Pet",
		"Treasures",
		"Type",
		"Episode",
		"Boosts",
		"Random boost",
		"Cookie power+",
		"Action",
	]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test routes/combi-name/describe.test.ts`
Expected: FAIL — `describeLoadout` is not exported.

- [ ] **Step 3: Write the implementation**

In `routes/combi-name/describe.ts`, add to the imports:

```ts
import { isRetired, nameFor, type CatalogSection } from "./catalog.ts";
import type { FullCode } from "./full-code.ts";
import type { Loadout } from "./loadout.ts";
```

and append:

```ts
const RETIRED_SUFFIX = " (no longer listed)";

/**
 * A code stays readable after the site drops an entry, so the entry is still
 * named — with a note, because the reader will not find it in the game.
 */
function entryName(section: CatalogSection, id: string): string {
	const name = nameFor(section, id);
	return isRetired(section, id) ? name + RETIRED_SUFFIX : name;
}

function slotName(slot: string[]): string {
	return slot.map((id) => entryName("treasures", id)).join(" or ");
}

function treasureRow(loadout: Loadout): DescribedRow {
	const { treasures, ordered } = loadout;
	if (treasures.length === 0) return { field: "Treasures", value: NONE };

	if (ordered && treasures.length > 1) {
		return {
			field: "Treasures (exact order)",
			value: treasures
				.map((slot, position) => `${position + 1}. ${slotName(slot)}`)
				.join("; "),
		};
	}

	return {
		field: "Treasures",
		value: treasures.map(slotName).join("; "),
	};
}

export function describeLoadout(loadout: Loadout): DescribedRow[] {
	const single = (
		field: string,
		section: CatalogSection,
		id: string | null,
	): DescribedRow => ({
		field,
		value: id === null ? NONE : entryName(section, id),
	});

	return [
		single("Cookie", "cookies", loadout.cookie),
		single("Relay", "cookies", loadout.relay),
		single("Pet", "pets", loadout.pet),
		treasureRow(loadout),
	];
}

export function describeFull(full: FullCode): DescribedCombi {
	const combi = describeCombi(full.combi);
	return { ...combi, rows: [...describeLoadout(full.loadout), ...combi.rows] };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test routes/combi-name/describe.test.ts`
Expected: PASS, existing tests plus 4 new ones.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add routes/combi-name/describe.ts routes/combi-name/describe.test.ts
git commit -m "feat(combi-name): describe a loadout in prose"
```

---

### Task 8: `<entry-picker>`

**Files:**
- Create: `components/entry-picker.ts`
- Create: `components/entry-picker.test.ts`
- Modify: `routes/base.css` (add the element's rules)

**Interfaces:**
- Consumes: nothing — like the other five leaf components, it imports nothing.
- Produces: `class EntryPicker extends HTMLElement` with attribute `label`, properties `options: readonly Option[]` where `Option = readonly [value: string, label: string, image: string | null]` and `value: string | null`, registered as `entry-picker`. Emits a bubbling `input` event when the pick changes.

- [ ] **Step 1: Write the failing test**

Create `components/entry-picker.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-picker.ts";

import type { EntryPicker } from "./entry-picker.ts";

function mount(): EntryPicker {
	document.body.replaceChildren();
	const element = document.createElement("entry-picker");
	element.setAttribute("label", "Cookie");
	document.body.append(element);
	element.options = [
		["00", "GingerBrave", "cookies/ch01.png"],
		["01", "Strawberry Cookie", "cookies/ch02.png"],
		["02", "Wizard Cookie", null],
	];
	return element;
}

function rows(element: EntryPicker): HTMLButtonElement[] {
	return [...element.querySelectorAll<HTMLButtonElement>("button[value]")];
}

test("the label names the control", () => {
	expect(mount().querySelector("label")?.textContent).toBe("Cookie");
});

test("one row per option plus a None row, in the order given", () => {
	expect(rows(mount()).map((row) => row.value)).toEqual(["", "00", "01", "02"]);
});

test("an option with an icon renders an image, one without does not", () => {
	const element = mount();
	const images = [...element.querySelectorAll("img")];

	expect(images).toHaveLength(2);
	expect(images[0]?.getAttribute("src")).toBe("cookies/ch01.png");
	expect(images[0]?.getAttribute("loading")).toBe("lazy");
});

test("clicking a row sets the value and bubbles an input event", () => {
	const element = mount();
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	rows(element)[2]?.click();

	expect(element.value).toBe("01");
	expect(seen).toBe(1);
});

test("clicking the None row clears the value", () => {
	const element = mount();
	element.value = "01";

	rows(element)[0]?.click();

	expect(element.value).toBe(null);
});

test("setting the value marks that row as the selected one", () => {
	const element = mount();
	element.value = "02";

	expect(
		rows(element).map((row) => row.getAttribute("aria-selected")),
	).toEqual(["false", "false", "false", "true"]);
});

test("setting a value that is not an option is ignored rather than invented", () => {
	const element = mount();
	element.value = "nonsense";

	expect(element.value).toBe(null);
});

test("typing filters the rows to matching labels, case-insensitively", () => {
	const element = mount();
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	search.value = "wiz";
	search.dispatchEvent(new Event("input", { bubbles: true }));

	expect(rows(element).map((row) => row.value)).toEqual(["", "02"]);
});

test("the selected row stays visible even when the filter excludes it", () => {
	const element = mount();
	element.value = "00";
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	search.value = "wiz";
	search.dispatchEvent(new Event("input", { bubbles: true }));

	expect(rows(element).map((row) => row.value)).toContain("00");
});

// 1,144 treasures cannot all be in the DOM of three pickers at once.
test("only the first rows are rendered, with a count of what is hidden", () => {
	const element = mount();
	element.options = Array.from(
		{ length: 120 },
		(_, n) => [String(n).padStart(3, "0"), `Treasure ${n}`, null] as const,
	);

	expect(rows(element)).toHaveLength(51);
	expect(element.querySelector(".more")?.textContent).toBe(
		"Showing 50 of 120. Type to narrow the list.",
	);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test components/entry-picker.test.ts`
Expected: FAIL — `Cannot find module './entry-picker.ts'`.

- [ ] **Step 3: Write the implementation**

Create `components/entry-picker.ts`:

```ts
export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

/**
 * A type-to-filter list that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * Only the first `LIMIT` matches are rendered, because three of these plus
 * three `<entry-set>`s over the same catalog would otherwise put tens of
 * thousands of rows in one page. The selected row is always rendered, even when
 * the filter excludes it, so the control never appears to have lost the pick.
 */
export class EntryPicker extends HTMLElement {
	readonly #search = document.createElement("input");
	readonly #list = document.createElement("div");
	readonly #more = document.createElement("small");
	#options: readonly Option[] = [];
	#value: string | null = null;
	#built = false;

	connectedCallback(): void {
		if (this.#built) return;
		this.#built = true;

		const id = `entry-picker-${Math.random().toString(36).slice(2, 8)}`;

		const label = document.createElement("label");
		label.textContent = this.getAttribute("label") ?? "";
		label.htmlFor = id;

		this.#search.type = "search";
		this.#search.id = id;
		this.#search.autocomplete = "off";
		this.#search.placeholder = "Type to filter";
		this.#search.addEventListener("input", (event) => {
			// Filtering is not a change of value, so it must not read as one.
			event.stopPropagation();
			this.#render();
		});

		this.#list.className = "entries";
		this.#more.className = "more";

		const field = document.createElement("div");
		field.className = "field";
		field.replaceChildren(label, this.#search, this.#list, this.#more);
		this.replaceChildren(field);
		this.#render();
	}

	get options(): readonly Option[] {
		return this.#options;
	}

	set options(options: readonly Option[]) {
		this.#options = options;
		if (this.#value !== null && !this.#has(this.#value)) this.#value = null;
		this.#render();
	}

	get value(): string | null {
		return this.#value;
	}

	set value(value: string | null) {
		this.#value = value !== null && this.#has(value) ? value : null;
		this.#render();
	}

	#has(value: string): boolean {
		return this.#options.some(([candidate]) => candidate === value);
	}

	#matches(): { shown: readonly Option[]; total: number } {
		const needle = this.#search.value.trim().toLowerCase();
		const matching =
			needle === ""
				? this.#options
				: this.#options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		const capped = matching.slice(0, LIMIT);
		const total = matching.length;
		if (this.#value === null) return { shown: capped, total };
		if (capped.some(([value]) => value === this.#value)) {
			return { shown: capped, total };
		}

		const picked = this.#options.find(([value]) => value === this.#value);
		return {
			shown: picked === undefined ? capped : [picked, ...capped],
			total,
		};
	}

	#row(value: string, text: string, image: string | null): HTMLElement {
		const button = document.createElement("button");
		button.type = "button";
		button.value = value;
		button.className = "entry";
		button.setAttribute("aria-selected", String((this.#value ?? "") === value));
		button.addEventListener("click", () => {
			this.#value = value === "" ? null : value;
			this.#render();
			this.dispatchEvent(new Event("input", { bubbles: true }));
		});

		if (image !== null) {
			const icon = document.createElement("img");
			icon.src = image;
			icon.alt = "";
			icon.loading = "lazy";
			button.append(icon);
		}
		button.append(document.createTextNode(text));
		return button;
	}

	#render(): void {
		if (!this.#built) return;

		const { shown, total } = this.#matches();

		this.#list.replaceChildren(
			this.#row("", "None", null),
			...shown.map(([value, label, image]) => this.#row(value, label, image)),
		);

		this.#more.textContent =
			total > LIMIT
				? `Showing ${LIMIT} of ${total}. Type to narrow the list.`
				: "";
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-picker": EntryPicker;
	}
}

if (!customElements.get("entry-picker")) {
	customElements.define("entry-picker", EntryPicker);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test components/entry-picker.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Style it**

In `routes/base.css`, beside the other component rules, add:

```css
entry-picker,
entry-set {
  display: block;
}

entry-picker .entries,
entry-set .entries {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  max-height: 14rem;
  overflow-y: auto;
  border: var(--pico-border-width) solid var(--pico-form-element-border-color);
  border-radius: var(--pico-border-radius);
  padding: 0.25rem;
}

entry-picker .entry,
entry-set .entry {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
  margin: 0;
  padding: 0.25rem 0.5rem;
  background: none;
  border: none;
  color: var(--pico-color);
  text-align: left;
  font-size: 0.875rem;
}

entry-picker .entry[aria-selected="true"],
entry-set .entry[aria-selected="true"] {
  background: var(--pico-primary-focus);
}

entry-picker .entry img,
entry-set .entry img {
  width: 1.75rem;
  height: 1.75rem;
  object-fit: contain;
}

entry-picker .more,
entry-set .more {
  color: var(--pico-muted-color);
}

entry-set .picked {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

entry-set .chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0;
  padding: 0.125rem 0.5rem;
  width: auto;
  font-size: 0.8125rem;
  border-radius: var(--pico-border-radius);
}
```

- [ ] **Step 6: Check and commit**

```bash
bun run check
git add components/entry-picker.ts components/entry-picker.test.ts routes/base.css
git commit -m "feat(components): add entry-picker for one pick from a long catalog"
```

---

### Task 9: `<entry-set>`

**Files:**
- Create: `components/entry-set.ts`
- Create: `components/entry-set.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class EntrySet extends HTMLElement` with attribute `legend`, properties `options: readonly Option[]` (same triple shape, declared locally) and `selected: string[]`, registered as `entry-set`. Emits a bubbling `input` event on every add and remove. `selected` reads back in the element's own `options` order.

- [ ] **Step 1: Write the failing test**

Create `components/entry-set.test.ts`:

```ts
/// <reference lib="dom" />

import { expect, test } from "bun:test";

import "./entry-set.ts";

import type { EntrySet } from "./entry-set.ts";

function mount(): EntrySet {
	document.body.replaceChildren();
	const element = document.createElement("entry-set");
	element.setAttribute("legend", "Treasure slot 1");
	document.body.append(element);
	element.options = [
		["000", "Acorn", "treasures/tr_ga034.png"],
		["001", "Mushroom", null],
		["002", "Slate", null],
	];
	return element;
}

function addRows(element: EntrySet): HTMLButtonElement[] {
	return [...element.querySelectorAll<HTMLButtonElement>(".entry")];
}

function chips(element: EntrySet): HTMLButtonElement[] {
	return [...element.querySelectorAll<HTMLButtonElement>(".chip")];
}

test("the legend names the slot", () => {
	expect(mount().querySelector("legend")?.textContent).toBe(
		"Treasure slot 1",
	);
});

test("nothing is picked to begin with", () => {
	const element = mount();
	expect(element.selected).toEqual([]);
	expect(chips(element)).toHaveLength(0);
});

test("clicking a row adds it as a chip and bubbles an input event", () => {
	const element = mount();
	let seen = 0;
	document.body.addEventListener("input", () => {
		seen += 1;
	});

	addRows(element)[1]?.click();

	expect(element.selected).toEqual(["001"]);
	expect(chips(element).map((chip) => chip.value)).toEqual(["001"]);
	expect(seen).toBe(1);
});

test("clicking a chip removes it", () => {
	const element = mount();
	element.selected = ["000", "002"];

	chips(element)[0]?.click();

	expect(element.selected).toEqual(["002"]);
});

// This is the wire format: alternatives are written in id order, so reading
// back in click order would produce a different code for the same slot.
test("selected reads back in option order, not the order clicked", () => {
	const element = mount();

	addRows(element)[2]?.click();
	addRows(element)[0]?.click();

	expect(element.selected).toEqual(["000", "002"]);
});

test("adding the same entry twice is a no-op", () => {
	const element = mount();

	addRows(element)[0]?.click();
	addRows(element)[0]?.click();

	expect(element.selected).toEqual(["000"]);
});

test("a value that is not an option is ignored rather than invented", () => {
	const element = mount();

	element.selected = ["000", "nonsense"];

	expect(element.selected).toEqual(["000"]);
});

test("an already-picked row is marked so", () => {
	const element = mount();
	element.selected = ["001"];

	expect(addRows(element).map((row) => row.getAttribute("aria-selected"))).toEqual(
		["false", "true", "false"],
	);
});

test("typing filters the rows", () => {
	const element = mount();
	const search = element.querySelector<HTMLInputElement>("input[type=search]");
	if (search === null) throw new Error("no search input");

	search.value = "sla";
	search.dispatchEvent(new Event("input", { bubbles: true }));

	expect(addRows(element).map((row) => row.value)).toEqual(["002"]);
});

test("only the first rows are rendered, with a count of what is hidden", () => {
	const element = mount();
	element.options = Array.from(
		{ length: 120 },
		(_, n) => [String(n).padStart(3, "0"), `Treasure ${n}`, null] as const,
	);

	expect(addRows(element)).toHaveLength(50);
	expect(element.querySelector(".more")?.textContent).toBe(
		"Showing 50 of 120. Type to narrow the list.",
	);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test components/entry-set.test.ts`
Expected: FAIL — `Cannot find module './entry-set.ts'`.

- [ ] **Step 3: Write the implementation**

Create `components/entry-set.ts`:

```ts
export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

/**
 * One treasure slot, holding the entries that slot will accept — a build that
 * says "this, or that" writes both here.
 *
 * `selected` filters this element's own `options` rather than reading the order
 * chips were added in, the same rule `<check-group>` follows and for the same
 * reason: a slot's alternatives are written in id order, so click order would
 * produce a different code for the same slot.
 *
 * It declares its own `Option` type rather than sharing `<entry-picker>`'s. A
 * shared type between two components is the first step towards a component that
 * cannot be read on its own.
 */
export class EntrySet extends HTMLElement {
	readonly #picked = document.createElement("div");
	readonly #search = document.createElement("input");
	readonly #list = document.createElement("div");
	readonly #more = document.createElement("small");
	#options: readonly Option[] = [];
	#chosen = new Set<string>();
	#built = false;

	connectedCallback(): void {
		if (this.#built) return;
		this.#built = true;

		const legend = document.createElement("legend");
		legend.textContent = this.getAttribute("legend") ?? "";

		this.#picked.className = "picked";
		this.#list.className = "entries";
		this.#more.className = "more";

		this.#search.type = "search";
		this.#search.autocomplete = "off";
		this.#search.placeholder = "Type to filter";
		this.#search.setAttribute(
			"aria-label",
			`Filter ${this.getAttribute("legend") ?? "entries"}`,
		);
		this.#search.addEventListener("input", (event) => {
			event.stopPropagation();
			this.#render();
		});

		const fieldset = document.createElement("fieldset");
		fieldset.replaceChildren(
			legend,
			this.#picked,
			this.#search,
			this.#list,
			this.#more,
		);
		this.replaceChildren(fieldset);
		this.#render();
	}

	get options(): readonly Option[] {
		return this.#options;
	}

	set options(options: readonly Option[]) {
		this.#options = options;
		this.selected = [...this.#chosen];
	}

	get selected(): string[] {
		return this.#options
			.map(([value]) => value)
			.filter((value) => this.#chosen.has(value));
	}

	set selected(values: readonly string[]) {
		const known = new Set(this.#options.map(([value]) => value));
		this.#chosen = new Set(values.filter((value) => known.has(value)));
		this.#render();
	}

	#changed(): void {
		this.#render();
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	#chip(value: string, label: string): HTMLElement {
		const chip = document.createElement("button");
		chip.type = "button";
		chip.value = value;
		chip.className = "chip";
		chip.title = `Remove ${label}`;
		chip.append(document.createTextNode(`${label} ×`));
		chip.addEventListener("click", () => {
			this.#chosen.delete(value);
			this.#changed();
		});
		return chip;
	}

	#row(option: Option): HTMLElement {
		const [value, label, image] = option;
		const button = document.createElement("button");
		button.type = "button";
		button.value = value;
		button.className = "entry";
		button.setAttribute("aria-selected", String(this.#chosen.has(value)));
		button.addEventListener("click", () => {
			this.#chosen.add(value);
			this.#changed();
		});

		if (image !== null) {
			const icon = document.createElement("img");
			icon.src = image;
			icon.alt = "";
			icon.loading = "lazy";
			button.append(icon);
		}
		button.append(document.createTextNode(label));
		return button;
	}

	#render(): void {
		if (!this.#built) return;

		const labels = new Map(this.#options.map(([value, label]) => [value, label]));
		this.#picked.replaceChildren(
			...this.selected.map((value) =>
				this.#chip(value, labels.get(value) ?? value),
			),
		);

		const needle = this.#search.value.trim().toLowerCase();
		const matching =
			needle === ""
				? this.#options
				: this.#options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		this.#list.replaceChildren(
			...matching.slice(0, LIMIT).map((option) => this.#row(option)),
		);
		this.#more.textContent =
			matching.length > LIMIT
				? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
				: "";
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-set": EntrySet;
	}
}

if (!customElements.get("entry-set")) {
	customElements.define("entry-set", EntrySet);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test components/entry-set.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Check and commit**

```bash
bun run check
git add components/entry-set.ts components/entry-set.test.ts
git commit -m "feat(components): add entry-set for one treasure slot and its alternatives"
```

---

### Task 10: Wire the page

**Files:**
- Modify: `routes/combi-name/index.html` (loadout section, reader input, legend)
- Modify: `routes/combi-name/index.ts` (read and write the loadout)
- Modify: `routes/combi-name/index.test.ts` (loadout tests)
- Modify: `routes/combi-name/index.css` (span the loadout panel)

**Interfaces:**
- Consumes: `optionsFor` from `./catalog.ts`; `encodeFull`, `decodeFull`, `combiSectionOf` from `./full-code.ts`; `emptyLoadout`, `type Loadout` from `./loadout.ts`; `describeFull` from `./describe.ts`; `EntryPicker`, `EntrySet`.
- Produces: nothing other tasks consume.

- [ ] **Step 1: Write the failing test**

Append to `routes/combi-name/index.test.ts`:

```ts
const orderSelect = need<HTMLSelectElement>("treasureOrder");

function clickEntry(hostId: string, value: string): void {
	const host = need(hostId);
	const row = host.querySelector<HTMLButtonElement>(
		`button[value="${value}"]`,
	);
	if (row === null) throw new Error(`no entry ${value} in #${hostId}`);
	row.click();
}

// These run against the same page as the tests above, in file order, so the
// combi half is whatever the last test left in the builder: 1E3-PF400J.
test("picking a cookie puts a loadout section in front of the combi code", () => {
	clickEntry("cookie", "00");

	expect(code.textContent).toBe("1C00.1E3-PF400J");
});

test("picking treasures writes a slot group, and clearing the cookie drops its group", () => {
	clickEntry("treasure1", "000");

	expect(code.textContent).toBe("1C00TU000.1E3-PF400J");

	clickEntry("cookie", "");

	expect(code.textContent).toBe("1TU000.1E3-PF400J");
});

test("the order select switches the flag once there are two slots", () => {
	clickEntry("treasure2", "001");
	orderSelect.value = "ordered";
	fire(orderSelect);

	expect(code.textContent).toBe("1TO000-001.1E3-PF400J");

	orderSelect.value = "any";
	fire(orderSelect);

	expect(code.textContent).toBe("1TU000-001.1E3-PF400J");
});

test("the reader still counts the combi half while a full code is short", () => {
	codeInput.value = "1C00.1S0";
	fire(codeInput);

	expect(readerMessage.textContent).toBe("3 of 10 characters.");
});

test("the reader spells out both sections", () => {
	codeInput.value = "1c00tu000.1s0hpf014-";
	fire(codeInput);

	const rows = [...readerRows.querySelectorAll("dt")].map(
		(term) => term.textContent,
	);
	expect(rows.slice(0, 4)).toEqual(["Cookie", "Relay", "Pet", "Treasures"]);
	expect(readerMessage.textContent).toBe("");
});

test("an unreadable loadout section is reported, not guessed at", () => {
	codeInput.value = "1CZZ.1S0---000-";
	fire(codeInput);

	expect(readerMessage.textContent).toContain('no cookie has id "ZZ"');
});

test("loading a full code into the builder fills the loadout controls too", () => {
	codeInput.value = "1C01P02TU001.1S0---000-";
	fire(codeInput);
	need<HTMLButtonElement>("load").click();

	expect(code.textContent).toBe("1C01P02TU001.1S0---000-");
});
```

Note: these tests run in file order against one shared page, as the existing ones do, so each builds on the state the previous left — including the combi half, which the existing final test sets to `1E3-PF400J`. Keep them in this order. A test that needs a clean loadout clears it by clicking the `""` row of each picker and setting `selected = []` on each `entry-set`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test routes/combi-name/index.test.ts`
Expected: FAIL — `the page is missing #cookie`.

- [ ] **Step 3: Add the markup**

In `routes/combi-name/index.html`:

1. After the "Build a code" `<section>`, add:

```html
      <section class="panel loadout" aria-labelledby="loadout-heading">
        <h2 id="loadout-heading">Cookie, relay, pet, treasures</h2>
        <p>
          The game stores these four in the combi itself, so they live in the
          left-hand section of the code rather than in the 10-character name.
          Leave them alone and the code stays exactly 10 characters.
        </p>

        <form id="loadout" novalidate>
          <entry-picker id="cookie" label="Cookie"></entry-picker>
          <entry-picker id="relay" label="Relay"></entry-picker>
          <entry-picker id="pet" label="Pet"></entry-picker>

          <entry-set id="treasure1" legend="Treasure slot 1"></entry-set>
          <entry-set id="treasure2" legend="Treasure slot 2"></entry-set>
          <entry-set id="treasure3" legend="Treasure slot 3"></entry-set>

          <labelled-select
            id="treasureOrder"
            label="Treasure order"
          ></labelled-select>
        </form>
      </section>
```

2. In the reader, delete `maxlength="10"` from `#code-input`, change its `placeholder` to `1C00TU000.1S0HPF014-`, and replace the hint text with:

```html
          <small id="code-input-hint" class="hint">
            A bare 10-character name, or a full code with a loadout in front of
            the dot. It reads back as you type, and a code that contradicts
            itself still reads - you get a warning, not a refusal.
          </small>
```

3. Replace the masthead paragraph with:

```html
      <p>
        A combi name holds 10 characters. That is enough to carry the run type,
        episode, boosts, random boost, cookie power+ selections, and starting
        action. Put a loadout section in front of it and the same code carries
        your cookie, relay, pet, and treasures too.
      </p>
```

4. In the legend section, after the existing slot table, add a second table for the loadout section.

```html
        <h3>The loadout section</h3>
        <p>
          Everything left of the dot. Groups always read in the order
          <code>C</code> <code>R</code> <code>P</code> <code>T</code>, and a
          group you did not pick is simply absent.
        </p>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Field</th>
                <th scope="col">Characters</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><code>1</code></td>
                <td>Loadout version</td>
                <td>Always <code>1</code>, and separate from the name's version</td>
              </tr>
              <tr>
                <td><code>C</code></td>
                <td>Cookie</td>
                <td>2 characters</td>
              </tr>
              <tr>
                <td><code>R</code></td>
                <td>Relay</td>
                <td>2 characters, from the same list as the cookie</td>
              </tr>
              <tr>
                <td><code>P</code></td>
                <td>Pet</td>
                <td>2 characters</td>
              </tr>
              <tr>
                <td><code>T</code></td>
                <td>Treasures</td>
                <td>
                  <code>U</code> any order or <code>O</code> exact order, then up
                  to 3 slots of 3 characters each, separated by <code>-</code>.
                  Alternatives within a slot are joined by <code>_</code>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
```

- [ ] **Step 4: Wire the script**

In `routes/combi-name/index.ts`:

1. Add the imports:

```ts
import { optionsFor } from "./catalog.ts";
import { combiSectionOf, decodeFull, encodeFull } from "./full-code.ts";
import { emptyLoadout, type Loadout } from "./loadout.ts";
import { describeFull } from "./describe.ts";

import "#components/entry-picker.ts";
import "#components/entry-set.ts";

import type { EntryPicker } from "#components/entry-picker.ts";
import type { EntrySet } from "#components/entry-set.ts";
```

Then prune the imports that are now unused: `describeCombi` (replaced by `describeFull`), and `decode`/`encode` from `./codec.ts` (replaced by `decodeFull`/`encodeFull`). `CODE_LENGTH` and `type Combi` are still used, as are every `ALL_*` array and label table. Biome fails the build on an unused import.

2. After the existing `need` calls, add:

```ts
const cookiePicker = need<EntryPicker>("cookie");
const relayPicker = need<EntryPicker>("relay");
const petPicker = need<EntryPicker>("pet");
const treasureSets = [
	need<EntrySet>("treasure1"),
	need<EntrySet>("treasure2"),
	need<EntrySet>("treasure3"),
];
const orderSelect = need<LabelledSelect>("treasureOrder");
const loadoutForm = need<HTMLFormElement>("loadout");

/** Icons sit beside the built page, one directory up from this route. */
const ASSET_BASE = "../assets/";

function pickerOptions(
	section: "cookies" | "pets" | "treasures",
): readonly (readonly [string, string, string | null])[] {
	return optionsFor(section).map(
		([id, label, image]) =>
			[id, label, image === null ? null : ASSET_BASE + image] as const,
	);
}
```

3. Add the loadout read and write, and route both through `encodeFull`:

```ts
const ORDER_OPTIONS = [
	["any", "Any order"],
	["ordered", "Exact order"],
] as const;

function readLoadout(): Loadout {
	return {
		cookie: cookiePicker.value,
		relay: relayPicker.value,
		pet: petPicker.value,
		// Empty slots are not gaps in the wire format, so they drop out.
		treasures: treasureSets
			.map((set) => set.selected)
			.filter((slot) => slot.length > 0),
		ordered: orderSelect.value === "ordered",
	};
}

function writeLoadout(loadout: Loadout): void {
	cookiePicker.value = loadout.cookie;
	relayPicker.value = loadout.relay;
	petPicker.value = loadout.pet;
	orderSelect.value = loadout.ordered ? "ordered" : "any";
	treasureSets.forEach((set, index) => {
		set.selected = loadout.treasures[index] ?? [];
	});
}
```

4. `renderBuilder` becomes:

```ts
function renderBuilder(): void {
	const code = encodeFull({ loadout: readLoadout(), combi: readForm() });
	codeOutput.value = code;

	// Read the code back so the verdict reflects the character actually written
	// into slot 2, not the type the select still shows.
	const { full } = decodeFull(code);
	builderVerdict.verdict = describeFull(full).auto;
}
```

5. `renderReader`'s length check and decode become:

```ts
	const combiPart = combiSectionOf(canonical);
	if (combiPart.length !== CODE_LENGTH) {
		setStatus(
			readerMessage,
			`${combiPart.length} of ${CODE_LENGTH} characters.`,
		);
		clearReader();
		return;
	}

	let full: FullCode;
	let warnings: string[];
	try {
		({ full, warnings } = decodeFull(canonical));
	} catch (error) {
		setStatus(
			readerMessage,
			error instanceof Error ? error.message : String(error),
			true,
		);
		clearReader();
		return;
	}

	const described = describeFull(full);
```

with `import type { FullCode } from "./full-code.ts";` added, and the `Combi`/`describeCombi` locals removed from that function.

6. Fill the new controls and listen to the new form:

```ts
const cookieOptions = pickerOptions("cookies");
const treasureOptions = pickerOptions("treasures");

cookiePicker.options = cookieOptions;
relayPicker.options = cookieOptions;
petPicker.options = pickerOptions("pets");
for (const set of treasureSets) set.options = treasureOptions;
orderSelect.options = ORDER_OPTIONS;

loadoutForm.addEventListener("input", renderBuilder);
```

7. The load button writes both halves:

```ts
loadButton.addEventListener("click", () => {
	const { full } = decodeFull(codeInput.value);
	writeForm(full.combi);
	writeLoadout(full.loadout);
	renderBuilder();
	typeSelect.focus();
});
```

- [ ] **Step 5: Let the panel span the grid**

In `routes/combi-name/index.css`, the first rule becomes:

```css
/* The result, the loadout and the legend are full-width; the builder and the
   reader pair up beside each other once the grid has two tracks. */
.result,
.loadout,
.legend {
	grid-column: 1 / -1;
}
```

The base stylesheet's `main > :only-child` rule is the other half of this layout and must not be touched — neither file can see the other's selectors, and losing either half is a layout break no test catches.

- [ ] **Step 6: Run the tests**

Run: `bun run test routes/combi-name/index.test.ts`
Expected: PASS, existing tests plus 7 new ones.

Run: `bun run test`
Expected: the whole suite passes.

- [ ] **Step 7: Check and commit**

```bash
bun run check
git add routes/combi-name/index.html routes/combi-name/index.ts routes/combi-name/index.test.ts routes/combi-name/index.css
git commit -m "feat(combi-name): build and read codes that carry a loadout"
```

---

### Task 11: Ship the icons beside the page

**Files:**
- Create: `scripts/copy-assets.ts`
- Modify: `package.json:10-21` (chain it into `build`)
- Modify: `scripts/dev.ts` (serve `/assets/*`)

**Interfaces:**
- Consumes: `execAsync` from `./utils/shell.ts`.
- Produces: `dist/assets/{cookies,pets,treasures}/` after a build, and `/assets/*` in the dev server.

- [ ] **Step 1: Write the copy script**

Create `scripts/copy-assets.ts`:

```ts
/**
 * Copies the icon directories next to the built pages.
 *
 * The page build inlines everything a page references, and the treasure icons
 * alone are 11 MB — as data URIs that is not a page. So they ship as sibling
 * files instead: `dist/combi-name/index.html` stays one file and loads
 * `../assets/...` lazily. `file://` still works from an intact `dist/`; what is
 * given up is the single-file property for that one page.
 *
 * This runs after `build`, which is why it is its own script: `execAsync` exits
 * the process, so nothing can follow it inside one file.
 */

import { execAsync } from "./utils/shell";

await execAsync(
	"bash",
	"-c",
	"mkdir -p dist/assets && cp -R assets/cookies assets/pets assets/treasures dist/assets/",
);
```

- [ ] **Step 2: Chain it into the build**

In `package.json`, `build` becomes:

```json
		"build": "bun scripts/build.ts && bun scripts/copy-assets.ts",
```

- [ ] **Step 3: Serve the icons in development**

In `scripts/dev.ts`, widen the route table and add the handler:

```ts
import { resolve } from "node:path";

const ASSETS = new URL("../assets/", import.meta.url).pathname;

/**
 * The built page loads icons from `../assets/`, which wrangler serves out of
 * `dist/`. In development nothing writes `dist/`, so the dev server answers for
 * the repository's own `assets/` directory instead.
 *
 * Containment is checked by resolving the path rather than by looking for
 * "..": `pathname` has already collapsed literal dot segments by the time the
 * handler sees it, and a percent-encoded one never matches a substring test, so
 * a ".." check would be reassuring and useless.
 */
const serveAsset = async (request: Request): Promise<Response> => {
	const { pathname } = new URL(request.url);
	const resolved = resolve(ASSETS + pathname.slice("/assets/".length));
	if (!resolved.startsWith(ASSETS)) {
		return new Response("outside the asset directory", { status: 403 });
	}

	const file = Bun.file(resolved);
	if (!(await file.exists())) {
		return new Response("no such asset", { status: 404 });
	}
	return new Response(file);
};

const routes: Record<
	string,
	HTMLBundle | ((request: Request) => Promise<Response>)
> = {
	"/": home,
	"/index.html": home,
	"/assets/*": serveAsset,
};
```

- [ ] **Step 4: Verify the build output**

Run: `bun run build`
Expected: exit 0.

Run:

```bash
ls dist/assets && ls dist/assets/treasures | wc -l && du -sh dist/combi-name/index.html dist/assets
```

Expected: `cookies pets treasures`, 868 treasure icons, the page around 500KB, and `dist/assets` around 14MB. The icon count is lower than the 1,144 treasure entries because entries share icons — there are 869 distinct paths, of which 8 entries have none.

Run: `grep -c "data:image/png;base64" dist/combi-name/index.html || true`
Expected: `0` — no icon was inlined.

- [ ] **Step 5: Verify the dev server**

Run: `bun run dev` in one shell, then in another:

```bash
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:3000/assets/cookies/ch01.png
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3000/assets/../package.json"
```

Expected: `200 image/png`, and not a 200 for the traversal attempt. Stop the dev server afterwards.

- [ ] **Step 6: Check and commit**

```bash
bun run check
git add scripts/copy-assets.ts scripts/dev.ts package.json
git commit -m "build: ship the icon directories beside the built pages"
```

---

### Task 12: Documentation

**Files:**
- Modify: `README.md`
- Modify: `.claude/skills/combi-codec/SKILL.md`
- Modify: `.claude/skills/assets/SKILL.md`
- Modify: `.claude/skills/build-and-deploy/SKILL.md`
- Modify: `AGENTS.md` (layout and commands, if either changed)

**Interfaces:**
- Consumes: everything the previous tasks built.
- Produces: documentation that matches the code.

- [ ] **Step 1: Update `README.md`**

Add, after the existing slot table and before "Auto vs semi-auto":

- A "Loadout section" heading explaining `loadout.combi`, that a bare 10-character code is still a whole code, and that the loadout lives outside the game.
- The group table: `1` version, `C` cookie (2 characters), `R` relay (2, same list as cookie), `P` pet (2), `T` order flag then up to three slots of 3 characters joined by `-`, alternatives joined by `_`.
- Worked examples:

```
1S0HPF014-                   no loadout, exactly as before
1C2L.1S0HPF014-              a cookie only
1C2LR0BP1ZTU0FZ_0RB-0QQ.1H3H-F400J
                             cookie, relay, pet, two treasure slots, any order
```

- The canonical-form rule: ids sorted within a slot, slots sorted when the flag is `U`, a single slot always `U`.
- That ids come from `assets/index.json`, are assigned append-only, and never change.

Update the intro paragraph, which currently says the run configuration "live only in your head", and the Development section's test count.

- [ ] **Step 2: Update the `combi-codec` skill**

- Delete the Scope paragraph's rule that the codec does not model the cookie, relay, pet or treasure. Replace it with: the combi section still does not, and the loadout section does.
- Add: `loadout.ts` owns the loadout grammar, `full-code.ts` joins the sections, `catalog.ts` resolves ids, and `assets/index.json` is the wire-format table whose keys must never be renumbered.
- Add the canonical-form rule and the fact that `decodeLoadout` accepts non-canonical input.
- Note that the exhaustive test still covers only the combi section, and that the loadout is covered by the seeded round-trip in `full-code.test.ts`.

- [ ] **Step 3: Rewrite the `assets` skill**

It describes a shape two commits out of date. It must now say:

- `index.json` is keyed by the wire id: 2 base-36 characters for cookies and pets, 3 for treasures. Each entry carries `key` (the old PascalCase handle, resolved by nothing), `name`, `url`, `image`, and treasures also carry `type` plus `targets` or `source` holding ids.
- Ids are assigned append-only by `reconcile` in `scripts/utils/asset-ids.ts`, matching on the slug recovered from `url`. A vanished entry is marked `"retired": true` and keeps its id forever. A scrape that would move an existing id fails.
- `migrate` normalizes an old-shape file, so the scraper can be pointed at either.
- The "nothing consumes `assets/`" claim is gone: `routes/combi-name/catalog.ts` reads it through `#assets/*`, and the combi page ships its icons from `dist/assets/`.

- [ ] **Step 4: Update the `build-and-deploy` skill**

- `build` is now two scripts chained, because `execAsync` exits and cannot be followed.
- `dist/assets/` holds the icon directories, and the combi page loads them relatively rather than inlining them — so that page is no longer a single file, though it still works from `file://`.
- The dev server answers `/assets/*` from the repository's `assets/`.

- [ ] **Step 5: Verify every documented command**

Run: `bun run test`, `bun run check`, `bun run build`
Expected: all three pass, and the test count in `README.md` matches what `bun run test` prints.

- [ ] **Step 6: Commit**

```bash
git add README.md AGENTS.md .claude/skills
git commit -m "docs: document the loadout section and the id-keyed asset index"
```

---

## Notes for the executor

- Tasks 1-3 touch generated data and the scraper; Task 2's diff is the whole of `assets/index.json` and is expected to be large.
- Task 3's Step 6 needs the network. If it is unavailable, the reconcile unit tests are the gate and the scrape verification moves to whoever next runs `bun run fetch-assets`.
- The spec named a constant `EMPTY_LOADOUT`; this plan uses an `emptyLoadout()` factory instead, so a caller cannot mutate a shared default.
- The spec described `catalog.ts` exposing a "retired-entry predicate" and display names; those are `isRetired` and `nameFor`, with `optionsFor` added for the pickers.
- The dev server's `/assets/*` route (Task 11, Step 3) is not in the spec. It is required all the same: the spec's sibling-asset decision means the page loads `../assets/...`, and nothing writes `dist/` during `bun run dev`, so without it every icon 404s in development.
- Every catalog id used in a test is a real entry as of this plan: cookies run `00`-`2L` (94), pets `00`-`2U` (103), treasures `000`-`0VR` (1,144). `ZZ` and `ZZZ` are used deliberately as ids that do not exist. If the catalog grows before this plan is executed, the ids stay valid — they are only ever appended to.
