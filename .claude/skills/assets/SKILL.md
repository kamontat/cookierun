---
name: assets
description: Use when touching assets/, assets/index.json, scripts/fetch-assets.ts, scripts/verify-assets.ts, scripts/utils/asset-ids.ts, scripts/utils/cookierunhub.ts or scripts/utils/hub-index.ts, or when planning to show a cookie, pet, treasure, boost or episode icon in a page — an icon is inlined as a data URI by default, so wiring a new one in has a size consequence (the combi page's own icons are the one deliberate exception, see the `build-and-deploy` skill). Read it before hand-editing the boosts or episodes section, which no sync writes.
---

# Assets

Two commands own this directory, and both read [cookierunhub.com](https://www.cookierunhub.com/en/encyclopedia). `bun run fetch:assets` syncs the catalog and rewrites the index; `bun run verify:assets` asks the site whether the index is still complete and touches nothing. The encyclopedia is a client-rendered page over a JSON API, so neither parses HTML: `GET https://www.cookierunhub.com/api/v1/game-data/{cookies,pets,treasures}` returns every entry of a section in one response. Where they live:

- `scripts/utils/cookierunhub.ts` — the site: its origin, `pageUrl`, `iconUrl`, the retrying `get`, `fetchRows`, and the `HubRow` shape (the handful of API fields this project reads).
- `scripts/utils/hub-index.ts` — `entriesFrom(section, rows)`, the pure mapping from API rows to index entries, icons to download, and problems. Both scripts call it, so they cannot disagree about what the site lists.
- `scripts/utils/asset-ids.ts` — the file: wire ids, entry types, `parseIndex`, `serializeIndex`, `verifyStructure`.

`bun run fetch:assets` costs three API requests plus one per icon not already on disk. It verifies what it wrote before writing it, deletes any icon under `assets/{cookies,pets,treasures}/` no entry names any more, prints a per-section report (`added`, `updated`, `retired`, `restored`, `unchanged`), and records the run in the top-level `fetchedAt`.

`fetchedAt` is written only when the run was a complete success. A failed icon download is the one partial-success path — a listing the mapping cannot represent and a failed structure check both bail before the write — so a run that lost an icon writes the index and leaves the previous timestamp standing. A **404** is not a failure: the site lists a handful of pictures it does not serve (its own page shows a placeholder for them), so the entry is written with `image: null` and the next run tries again. Because a successful run always writes `fetchedAt`, a rescrape that changes nothing still produces a one-line diff.

`index.json` has one object per section. The three the sync owns — `cookies`, `pets`, `treasures` — are keyed by the entry's **wire id**, the id a loadout code carries. Every entry also carries a `key`, a PascalCase handle derived from the name; nothing resolves it but `art.ts` (see below).

```jsonc
{
  "cookies": {
    "01": {
      "name": "GingerBrave",
      "url": "https://www.cookierunhub.com/en/encyclopedia/cookies/1",
      "image": "cookies/brave_cookie.webp", // relative to assets/, or null where the site has no picture
      "key": "GingerBrave"
    }
  },
  "treasures": {
    "009": { "name": "Quick Wheels", /* … */ "family": "cookie", "type": "N", "targets": ["09F", "I9F"], "key": "QuickWheels" },
    "09F": { "name": "Burn Some Rubber Tire", /* … */ "type": "E", "source": "009", "key": "BurnSomeRubberTire" },
    "I9F": { "name": "Blessed Burn Some Rubber Tire", "url": "…/treasures/339#blessed", /* … */ "type": "B", "source": "009" }
  }
}
```

## Wire ids are the site's own numbers

An id is the entry's number on cookierunhub.com — the one in its page URL, `/en/encyclopedia/treasures/50` — written in fixed-width uppercase base 36: 2 characters for a cookie or pet, 3 for a treasure. `wireId` and `hubIdOf` in `asset-ids.ts` convert both ways. Nothing in this repository assigns an id, so there is no allocator, no "next free id", and no rule against reuse to defend: the site owns the numbering.

A **blessed** treasure is the exception the site forces. It has no row, number or page of its own — it is a `has_blessed` flag (and an optional `blessed_english_name`) on its unblessed form, which is an evolved treasure for 265 of them and a base for 11. Since a loadout can ask for either form, `entriesFrom` writes the blessed one as its own entry: its id is the unblessed form's number plus `BLESSED_OFFSET` (23,328, half the 3-character space), so `01E` and `I1E` are one treasure's two forms; its `url` is the unblessed page with `#blessed`; its name falls back to `Blessed <name>` where the site gives none; it shares the unblessed form's picture. An unblessed treasure's number therefore has to stay under 23,328 and a cookie's or pet's under 1,296 — `entriesFrom` reports anything past that rather than truncating it. The highest today is 928.

`verifyStructure` checks every id against the url it sits beside: decode the id, rebuild `pageUrl`, compare. An id that disagrees with its own url is one that moved — a published code that now names something else — and that is the guard the old append-only machinery used to be. It also checks that only type `B` sits in the upper half.

**The ids moved once, wholesale.** Until the switch to cookierunhub.com they were cookierundb.com slugs numbered append-only from zero; the owner chose a clean break over a translation table, so every loadout code written before it names different entries now. `LOADOUT_VERSION` stayed `1`.

An entry the site stops listing is not deleted — `fetch-assets` keeps the previous entry with `"retired": true`, icon included, since its id may sit in a published code. `src/routes/combi-name/catalog.ts` and `describe.ts` still resolve a retired entry and the page names it with a `(no longer listed)` suffix. If the site lists it again it comes back under the same id, reported as `restored`. A retired evolved or blessed form is exempt from the chain's point-back check, since its base no longer names it.

## Treasure chains and families

`type` is `N` (base), `E` (evolved) or `B` (blessed). A base lists `targets` as `[evolved, blessed]`, either half `null` when that form does not exist — 362 of the 638 bases are `[null, null]`. An evolved or blessed treasure names its base as `source`; for a blessed form of an evolved treasure that is the evolved one's base, not the evolved one itself. Both directions come straight from the API (`evolved_from_id`, `has_blessed`), and `entriesFrom` reports a base with two evolved or two blessed forms, or an evolved treasure whose base is not listed, rather than writing a half-linked chain. `verifyStructure` checks the two directions agree.

`family` is the site's own `category`: one of `cookie`, `gacha`, `limited`, `pet` or `squirrel` (`TREASURE_FAMILIES`). It is a closed set on purpose — `entriesFrom` stops the sync on a category nobody has decided about, and `verifyStructure` rejects a committed entry without a known one. The site's categories are coarser than the old ones: XP-Elixirs, which a run cannot equip, sit in `limited` beside 200-odd treasures it can, so `HIDDEN_TREASURE_FAMILIES` in `catalog.ts` is empty and the picker offers everything. It stays a list so hiding a family again is one edit.

## Icons

Each icon is saved under its section by the site's own file name — the site serves most from `/images/<section>/…` and editor-added ones from `/uploads/<section>/…`, and `iconUrl` resolves both. A file name that is not plain ASCII (eight treasures have Korean ones) is saved as `hub-<number>.<ext>` instead, because macOS stores such names decomposed and Linux composed, so the same name would not match itself between a checkout and CI. Two different URLs claiming one local name is reported, not overwritten. Formats are whatever the site sent — mostly WebP, the rest PNG — which is why the `--statics` glob names both (see `build-and-deploy`).

## The two sections nobody syncs

`boosts` and `episodes` are written by hand. `STATIC_SECTIONS` in `scripts/utils/asset-ids.ts` names them, `StaticEntry` is their whole shape, and they sit after `treasures` in the file so a hand edit shows up at the end of the diff rather than in the middle of it.

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

They are here because the game has a fixed set of each, and a page wanting a boost or episode icon should not need a second file to find one. Neither is a catalog that grows: five boosts and thirteen episodes, unchanged for years. Their icons and episode urls predate the move to cookierunhub.com and still point at cookierundb.com; nothing reads the urls, so they were left as written.

**The keys are authored, not assigned, and they are not wire values.** `src/routes/combi-name/codec.ts` carries its own character for an episode (`EPISODE_CHARS`) and its own letter for a boost (`BOOST_SLOT`); a code never carries `ep1`. So none of the id machinery above applies here, and an entry can be renamed, rekeyed or deleted without breaking a published code. `STATIC_KEY` requires a key to be lowercase and start with a letter, which keeps `serializeIndex`'s sorted order equal to the file's own order: a key that is a canonical integer string enumerates ahead of everything else whatever order it was written in.

Neither script touches them. `fetch-assets` has no source for them, so it copies both sections from what was on disk into the file it rewrites — that copy is the only reason a sync does not delete them — and its icon pruning only looks at the three synced directories. `verify:assets` says nothing about these two.

What does check them is `verifyStructure`, through `staticProblems`: the key shape, a non-empty `name`, a `url` that is a string or `null`, an `image` that is `null` or a path under the section's own directory, and no two entries claiming one `url` or one `image`. `asset-ids.test.ts` adds the one check that needs the directory rather than the text: every `image` any entry names, static or synced, is on disk.

`url` is `null` for every boost. Episodes all have one, and the index lists thirteen against the eleven the codec can encode — `601` Coin Palace Rush and `701` Party Run have no combi character. That is not drift: the index describes the game, the codec describes what a code can say.

## What else guards the file

`verifyStructure` also checks that the file parses, that `fetchedAt` is `null` or an ISO 8601 instant, and that the file is byte-identical to what `serializeIndex` would write — `ordered()` fixes one field order for every entry so a sync rewrites no entry it did not change. `scripts/utils/asset-ids.test.ts` runs it over the committed file, so `bun run test` fails on a broken index without anyone remembering a script. What it cannot catch is the site renumbering its own pages: then an id would still agree with its url, but the url would show a different entry. **Read `git diff assets/index.json` when a sync renames entries.**

Counts as of this writing: 96 cookies, 103 pets, 1,179 treasures (903 site rows plus 276 blessed forms); 30 entries have no picture.

## Is the index still complete?

`bun run verify:assets` answers that, and nothing else. It fetches the three sections, runs them through `entriesFrom` (so blessed forms count as the sync writes them), and compares each section's count against the entries this index carries without `retired: true`:

```
fetched 2026-10-25T17:33:45.014Z
cookies:    96 on site, 96 listed (0 retired) — ok
pets:       103 on site, 103 listed (0 retired) — ok
treasures:  1179 on site, 1179 listed (0 retired) — ok
```

It exits non-zero on any mismatch, on an unreachable site, and on an index it cannot read. It does no structural checking — the suite owns that. Because it needs the network it is not in `bun run check` and not in `main.yml`; `.github/workflows/assets.yml` runs it weekly instead.

## What consumes it

`src/routes/combi-name/catalog.ts` reads `assets/index.json` through the `#assets/*` import mapping (`package.json`'s `imports` field) to resolve every id a loadout carries and to build the picker options. One id it resolves is not in the file: `anyIdFor` is `_` repeated to the section's width, the "anything fits here" a cookie, relay or pet slot can carry, deliberately outside the `[0-9A-Z]` alphabet every wire id is written in — so no catalog growth can collide with it. `labelFor` names it; `hasId` denies it, which keeps it out of every list built from the catalog. Its `staticImage` is the one reader of the two authored sections, and it reads only their pictures: display names come from `labels.ts`. `src/routes/combi-name/art.ts` maps each codec boost and episode to the key its icon is filed under, and uses `imageForKey` — which finds an entry's picture by its `key` rather than its wire id — to give each cookie power+ the faces of the cookies or pets it belongs to (`FairyCookie`, `MsDoReMi`, …) without the codec ever learning a cookie id. `art.test.ts` pins those keys to real icons, so a rename on the site that changes a key fails the suite.

`HIDDEN_TREASURE_FAMILIES` in `catalog.ts` is what `family` is for: `optionsFor("treasures")` leaves out a family it names (none today). A hidden or retired entry is still resolved by `nameFor`, `labelFor` and `hasId`, and the combi page appends a carried id the picker does not offer to that slot's own `options` before writing the pick, so opening a saved build never drops it. The page build inlines the JSON into the bundle like any other imported module, but the icons are too large to inline — see the `build-and-deploy` skill for how the combi page instead ships `dist/assets/` as a sibling folder. Read that skill before wiring a new icon into a page; it has a size consequence.

`assets/` is 10 MB (882 treasure icon files, 6.6 MB, shared across 1,179 treasure entries; the 13 episode icons are a further 808 KB, which is why an episode icon belongs in `dist/assets/` and not inlined) and, unlike `dist/`, is committed on purpose: `catalog.ts` reads it, so the sync output stays in the repository rather than being fetched per clone.

`biome.json` ignores `assets/` — reformatting generated sync output would bury every real diff.
