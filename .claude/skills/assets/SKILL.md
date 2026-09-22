---
name: assets
description: Use when touching assets/, assets/index.json, scripts/fetch-assets.ts, scripts/verify-assets.ts or scripts/utils/asset-ids.ts, or when planning to show a cookie, pet, treasure, boost or episode icon in a page — an icon is inlined as a data URI by default, so wiring a new one in has a size consequence (the combi page's own icons are the one deliberate exception, see the `build-and-deploy` skill). Read it before hand-editing the boosts or episodes section, which no scrape writes.
---

# Assets

Two commands own this directory. `bun run fetch:assets` scrapes cookierundb.com and rewrites the index; `bun run verify:assets` asks the site whether the index is still complete and touches nothing. What they know about the file's shape lives in `scripts/utils/asset-ids.ts` and what they know about the site lives in `scripts/utils/cookierundb.ts`, so they cannot disagree about either.

`bun run fetch:assets` scrapes cookie, pet, and treasure icons into `assets/` and writes `assets/index.json`. Icons already on disk are skipped, so re-running only fills gaps — but it always re-reads the treasure evolution chains, which costs one request per evolved or blessed treasure (524 today) on every run. It verifies what it wrote before writing it, prints a per-section report of what changed (`added`, `updated`, `retired`, `restored`, `unchanged`), and records the run in the index's top-level `fetchedAt`.

`fetchedAt` is written only when the run was a complete success. Icon downloads are the one partial-success path — sitemap drift, a broken chain and a failed structure check all bail before the write — so a run that lost an icon writes the index and leaves the previous timestamp standing. Because a successful run always writes it, a rescrape that changes nothing still produces a one-line diff; that is the cost of having the field, and it was taken deliberately.

`index.json` has one object per section. The three the scraper owns — `cookies`, `pets`, `treasures` — are keyed by the entry's **wire id**: a fixed-width, uppercase base-36 string, 2 characters for a cookie or pet and 3 for a treasure. That id is what a loadout code carries, so it is assigned once and never reused — see below. Every entry also carries a `key`, the old PascalCase handle the id replaced; nothing resolves it, it survives only so a diff or a person reading the file has something readable to search for.

```jsonc
{
  "cookies": {
    "00": {
      "name": "GingerBrave",
      "url": "https://cookierundb.com/cookies/ch01",
      "image": "cookies/ch01.png", // relative to assets/, or null where the game has no sprite
      "key": "GingerBrave"
    }
  },
  "treasures": {
    "000": { "name": "Always Cute Acorn", /* … */ "type": "N", "targets": ["00S", "007"], "key": "AlwaysCuteAcorn" },
    "00S": { "name": "Stretched Acorn", /* … */ "type": "E", "source": "000", "key": "StretchedAcorn" },
    "007": { "name": "Blessed Stretched Acorn", /* … */ "type": "B", "source": "000", "key": "BlessedStretchedAcorn" }
  }
}
```

Treasures also carry a `family`, read from the listing card's `data-fam`: one of `cookie`, `draw`, `pet`, `special` or `consumable`. `TREASURE_FAMILIES` in `scripts/utils/asset-ids.ts` is the closed set, and both ends check against it — `fetch-assets` fails the run on a family it does not know rather than writing it, and `verifyStructure` rejects a committed entry missing one or carrying an unknown one. A new family is therefore a decision someone makes, not something that silently changes what the combi page offers. The field is optional in `TreasureEntry` and required by `verifyStructure`, the same split `fetchedAt` has: `migrate` must accept a file written before the field existed and cannot invent one, so the type says what may arrive and the check says what may be committed.

Treasures carry their chain: `type` is `N` (base), `E` (evolved) or `B` (blessed). A base lists `targets` as `[evolved, blessed]` ids, with either half `null` when that form does not exist — 358 of the 620 bases are `[null, null]`. An evolved or blessed treasure names its base's id as `source`. The two directions are inverses of each other, so either can be walked — the suite checks that they agree, since a reference that merely resolves can still point somewhere the other side does not point back from. `ordered()` in `scripts/utils/asset-ids.ts` fixes one field order for every entry regardless of whether `migrate` or the scraper's own writer built it, so a rescrape rewrites no entry it did not change.

The chain comes from the detail pages, not the listing: a listing card's `data-evo` says only that a treasure is evolved. The `rc-sub` captions on the detail page carry the meaning — `Evolves from` names the base, and `Unblessed form` appears only on a blessed page. Both the sitemap check and the chain checks fail the run loudly rather than writing a partial index.

## The two sections nobody scrapes

`boosts` and `episodes` are written by hand. `STATIC_SECTIONS` in `scripts/utils/asset-ids.ts` names them, `StaticEntry` is their whole shape, and they sit after `treasures` in the file so a hand edit shows up at the end of a 13,000-line diff rather than in the middle of it.

```jsonc
{
  "boosts": {
    "fast-start": { "name": "Fast Start", "url": null, "image": "boosts/fast-start.png" }
  },
  "episodes": {
    "ep1": { "name": "Escape from the Oven", "url": "https://cookierundb.com/episodes/1", "image": "episodes/ep1.png" }
  }
}
```

They are here because the game has a fixed set of each, and a page wanting a boost or episode icon should not need a second file to find one. Neither is a catalog that grows: five boosts and thirteen episodes, unchanged for years.

**The keys are authored, not assigned, and they are not wire values.** `src/routes/combi-name/codec.ts` carries its own character for an episode (`EPISODE_CHARS`) and its own slot for a boost (`BOOST_SLOTS`); a code never carries `ep1`. So none of the id machinery above applies here — no `reconcile`, no capacity, no retirement, no append-only promise — and an entry can be renamed, rekeyed or deleted without breaking a published code. The key exists so a person can find an icon. `STATIC_KEY` requires it to be lowercase and start with a letter, which is what keeps `serializeIndex`'s sorted order equal to the file's own order: a key that is a canonical integer string enumerates ahead of everything else whatever order it was written in.

Neither script touches them. `fetch-assets` has no source for them, so it copies both sections from what was on disk into the file it rewrites — that copy is the only reason a scrape does not delete them. `verify:assets` asks the site about the three scraped sections and says nothing about these two, since there is no `/boosts/` page on cookierundb.com at all.

What does check them is `verifyStructure`, through `staticProblems`: the key shape, a non-empty `name`, a `url` that is a string or `null`, an `image` that is `null` or a path under the section's own directory, and no two entries claiming one `url` or one `image` — copying an entry and changing only one of its two pointers is the mistake hand-writing invites. `asset-ids.test.ts` adds the one check that needs the directory rather than the text: every `image` a static entry names is on disk.

`url` is `null` for every boost. The site has no page for them, and inventing one would be worse than admitting there is none. Episodes all have one, and the site lists thirteen against the eleven the codec can encode — `601` Coin Palace Rush and `701` Party Run are in the index and have no combi character. That is not drift: the index describes the game, the codec describes what a code can say.

## Ids are assigned once, and never move

`reconcile` in `scripts/utils/asset-ids.ts` assigns every id, matching each scraped card against what is already on disk by the **slug** recovered from its `url` (the page's last path segment), not by name — two entries can share a display name, but never a slug. A slug already known keeps its id; a new slug takes one past the highest id currently in use for that section, never the entry count, so a gap left by a retirement is never refilled. `fetch-assets.ts` then checks the assembled index against what was on disk before the run: if an id that already existed would now point at a different `url`, the run fails rather than silently moving it — a moved id is a published code that now means something else.

An entry that disappears from the site is not deleted — it is marked `"retired": true` and keeps its id forever, since that id may already be sitting in someone's published code. `src/routes/combi-name/catalog.ts` and `describe.ts` still resolve a retired entry, and the page shows its name with a `(no longer listed)` suffix rather than refusing to read the code.

`migrate` (also in `asset-ids.ts`) turns an old-shape file — PascalCase keys, no `key` field, ids implied by object order — into the current id-keyed shape. It is a fixed point on a file already in the current shape, so `fetch-assets` calls it unconditionally on whatever is on disk before reconciling; there is no separate "is this migrated?" branch in the scraper itself; a scrape can equally be pointed at a fresh clone's file or a not-yet-migrated one from before this change. A section whose keys are *partly* ids is refused rather than migrated, because re-deriving ids from object order would move every id in it.

## What guards the ids now

Two guards, both inside a scrape: `reconcile` only ever appends an id, and `fetch-assets` fails the run rather than let a rescrape move one — comparing the assembled index against what was on disk before it started, and against what `migrate` made of that file, so a migration that renumbered is caught too.

A third, partial guard runs outside a scrape. `verifyStructure` in `scripts/utils/asset-ids.ts` checks that the file parses, that `migrate` leaves it alone, that it is byte-identical to what the writer would produce, that `fetchedAt` is `null` or an ISO 8601 instant, that every id is the right shape and sits where its position says, that no two entries claim one slug, that every treasure's `type` is `N`, `E` or `B`, and that every chain reference both resolves and points back. `scripts/utils/asset-ids.test.ts` runs it over the committed file, so `bun run test` fails on a broken index without anyone remembering a script.

What none of them catch is a `url` swapped between two existing ids, or display fields swapped between two entries, or the highest id deleted — ids would still sit dense from zero. A hashed fingerprint used to cover exactly those, at the cost of a `--update` that had to land in the same commit as every append; it was removed because the ritual was paid constantly and the corruption never occurred. **Read `git diff assets/index.json` when a merge touches it** — that is the guard now.

Counts as of this writing: 94 cookies, 103 pets, 1,144 treasures, against capacities of 1,296 (`36^2`) for a 2-character id and 46,656 (`36^3`) for a 3-character one — there is no pressure to widen an id any time soon.

## Is the index still complete?

`bun run verify:assets` answers that, and nothing else. It fetches the three listing pages and compares, per section, the site's count against the number of entries this index carries without `retired: true`:

```
fetched 2026-09-21T08:11:04.000Z
cookies:   94 on site, 94 listed (0 retired) — ok
pets:      103 on site, 103 listed (0 retired) — ok
treasures: 1145 on site, 1144 listed (0 retired) — 1 missing
```

It exits non-zero on any mismatch, on an unreachable site, and on an index it cannot read. It does no structural checking — the suite owns that, and two implementations would drift. Because it needs the network it is not in `bun run check` and not in `main.yml`; `.github/workflows/assets.yml` runs it weekly instead.

## What consumes it

`src/routes/combi-name/catalog.ts` reads `assets/index.json` through the `#assets/*` import mapping (`package.json`'s `imports` field) to resolve every id a loadout carries and to build the picker options. It also exposes `imageForKey`, which finds an entry's picture by the scraper's own `key` rather than by its wire id; `src/routes/combi-name/art.ts` uses it to give each cookie power+ the faces of the cookies or pets it belongs to, without the codec ever learning a cookie id. Five name one cookie each, Serenade of Love names the two pets that sing it, and EXP Party the four cookies that throw it.

`HIDDEN_TREASURE_FAMILIES` in `catalog.ts` is what the `family` field is for: `optionsFor("treasures")` leaves out the `consumable` and `special` families, 208 of the 1,144 entries, because a run cannot equip any of them. It hides them from the picker and from nowhere else — `nameFor`, `labelFor` and `hasId` still resolve a hidden entry, the same promise a retired one gets, and `labelFor`'s map is built from the unfiltered listing so a hidden treasure keeps its disambiguated name. The combi page goes one step further: a code that already carries a hidden treasure has that id appended to the slot's own `options` before the pick is written, since a slot drops a pick its options do not contain and the page must never rewrite someone's saved build on the way in. The page build inlines that JSON straight into the bundle like any other imported module, but the icons themselves are too large to inline — see the `build-and-deploy` skill for how the combi page instead ships `dist/assets/` as a sibling folder. Read that skill before wiring a new icon into a page; it has a size consequence.

`assets/` is 15 MB (868 treasure icon files, shared across 1,144 treasure entries, account for 11 MB of it — 8 entries have no icon; the 13 episode icons are a further 808 KB, which is why an episode icon belongs in `dist/assets/` and not inlined) and, unlike `dist/`, is committed on purpose: `catalog.ts` reads it, so the scrape output stays in the repository rather than being fetched per clone.

`biome.json` ignores `assets/` — reformatting 14 MB of generated scrape output would bury every real diff.
