---
name: assets
description: Use when touching assets/, assets/index.json, assets/fingerprint.json, scripts/fetch-assets.ts, scripts/verify-assets.ts or scripts/utils/asset-ids.ts, or when planning to show a cookie, pet or treasure icon in a page — an icon is inlined as a data URI by default, so wiring a new one in has a size consequence (the combi page's own icons are the one deliberate exception, see the `build-and-deploy` skill).
---

# Assets

Two commands own this directory. `bun run fetch:assets` scrapes cookierundb.com and rewrites the index; `bun run verify:assets` checks the index offline and touches nothing. Everything either one knows lives in `scripts/utils/asset-ids.ts`, so they cannot disagree.

`bun run fetch:assets` scrapes cookie, pet, and treasure icons into `assets/` and writes `assets/index.json`. It is idempotent for icons — those already on disk are skipped, so re-running only fills gaps — but it always re-reads the treasure evolution chains, which costs one request per evolved or blessed treasure (524 today) on every run. It verifies what it wrote before exiting.

`index.json` has one object per section, keyed by the entry's **wire id**: a fixed-width, uppercase base-36 string, 2 characters for a cookie or pet and 3 for a treasure. That id is what a loadout code carries, so it is assigned once and never reused — see below. Every entry also carries a `key`, the old PascalCase handle the id replaced; nothing resolves it, it survives only so a diff or a person reading the file has something readable to search for.

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

Treasures carry their chain: `type` is `N` (base), `E` (evolved) or `B` (blessed). A base lists `targets` as `[evolved, blessed]` ids, with either half `null` when that form does not exist — 358 of the 620 bases are `[null, null]`. An evolved or blessed treasure names its base's id as `source`. The two directions are inverses of each other, so either can be walked — `verify:assets` checks that they agree, since a reference that merely resolves can still point somewhere the other side does not point back from. `ordered()` in `scripts/utils/asset-ids.ts` fixes one field order for every entry regardless of whether `migrate` or the scraper's own writer built it, so a rescrape that changes nothing rewrites nothing.

The chain comes from the detail pages, not the listing: a listing card's `data-evo` says only that a treasure is evolved. The `rc-sub` captions on the detail page carry the meaning — `Evolves from` names the base, and `Unblessed form` appears only on a blessed page. Both the sitemap check and the chain checks fail the run loudly rather than writing a partial index.

## Ids are assigned once, and never move

`reconcile` in `scripts/utils/asset-ids.ts` assigns every id, matching each scraped card against what is already on disk by the **slug** recovered from its `url` (the page's last path segment), not by name — two entries can share a display name, but never a slug. A slug already known keeps its id; a new slug takes one past the highest id currently in use for that section, never the entry count, so a gap left by a retirement is never refilled. `fetch-assets.ts` then checks the assembled index against what was on disk before the run: if an id that already existed would now point at a different `url`, the run fails rather than silently moving it — a moved id is a published code that now means something else.

An entry that disappears from the site is not deleted — it is marked `"retired": true` and keeps its id forever, since that id may already be sitting in someone's published code. `src/routes/combi-name/catalog.ts` and `describe.ts` still resolve a retired entry, and the page shows its name with a `(no longer listed)` suffix rather than refusing to read the code.

`migrate` (also in `asset-ids.ts`) turns an old-shape file — PascalCase keys, no `key` field, ids implied by object order — into the current id-keyed shape. It is a fixed point on a file already in the current shape, so `fetch-assets` calls it unconditionally on whatever is on disk before reconciling; there is no separate "is this migrated?" branch in the scraper itself; a scrape can equally be pointed at a fresh clone's file or a not-yet-migrated one from before this change. A section whose keys are *partly* ids is refused rather than migrated, because re-deriving ids from object order would move every id in it.

## The fingerprint, and what it is for

`fetch:assets` can only catch a moved id during a scrape, by comparing against what was on disk before the run. A hand edit, a bad merge resolution or a rebase that drops a hunk never runs the scraper, and those are the likelier ways this file breaks. `assets/fingerprint.json` closes that gap:

```json
{ "cookies": { "through": 94, "identity": "35d7a11c190e6e64", "display": "dfc1d68883c56e94" }, "…": {} }
```

Two hashes, because two very different things can change. **`identity`** covers the `id → url` pairs: which entry each id names. Nothing legitimate moves it — `reconcile` only appends — so a mismatch is corruption, and every code already published for that id now means something else. **`display`** covers `name`, `image` and `key`, which a scrape rewrites whenever the site renames something; a mismatch there is a prompt to read the diff, not proof of damage. Hashing the two together would have made every upstream rename look like corruption and taught everyone to reach for `--update` without looking. Both are SHA-256 truncated to 16 hex characters.

`through` is how many of the section's ids the hashes cover, counting from the lowest — and `verifyIndex` requires it to be *all* of them. An id past the coverage is an id no guard protects: the fingerprint never saw it, and the scraper's own moved-id check compares against what is on disk, where a dropped entry no longer appears — so a later scrape would hand that id to a different entry and nothing would notice. Which is why an append must land with its `--update` in the same commit.

`bun run verify:assets` checks the index against the fingerprint and against everything checkable on its own — that the file parses, that `migrate` leaves it alone, that it is byte-identical to what the writer would produce, that every id is the right shape and sits where its position says, that no two entries claim one slug, that every treasure's `type` is `N`, `E` or `B`, and that every chain reference both resolves and points back. `scripts/utils/asset-ids.test.ts` runs the same `verifyIndex` over the committed files, so `bun run test` fails on a broken index without anyone remembering the script.

`bun run verify:assets --update` is the only thing that may rewrite `fingerprint.json`. It refuses while any covered id has changed identity — a fingerprint blessing corruption is worse than no fingerprint — but it will happily extend coverage to appended ids and record display fields a scrape rewrote, which is the whole reason it exists. **An identity mismatch is never a stale fingerprint: it means an id changed meaning.** Read `git diff assets/index.json` first.

A `fingerprint.json` whose *shape* is wrong — a missing section, a hash that is not 16 hex characters — stops everything, including `--update`, since the likeliest cause is the same bad merge the fingerprint exists to catch. Recreating it is deliberate: delete the file, then `--update`, which falls back to a structural gate when there is nothing to compare against.

Counts as of this writing: 94 cookies, 103 pets, 1,144 treasures, against capacities of 1,296 (`36^2`) for a 2-character id and 46,656 (`36^3`) for a 3-character one — there is no pressure to widen an id any time soon.

## What consumes it

`src/routes/combi-name/catalog.ts` reads `assets/index.json` through the `#assets/*` import mapping (`package.json`'s `imports` field) to resolve every id a loadout carries and to build the picker options. The page build inlines that JSON straight into the bundle like any other imported module, but the icons themselves are too large to inline — see the `build-and-deploy` skill for how the combi page instead ships `dist/assets/` as a sibling folder. Read that skill before wiring a new icon into a page; it has a size consequence.

`assets/` is 14 MB (868 treasure icon files, shared across 1,144 treasure entries, account for 11 MB of it — 8 entries have no icon) and, unlike `dist/`, is committed on purpose: `catalog.ts` reads it, so the scrape output stays in the repository rather than being fetched per clone.

`biome.json` ignores `assets/` — reformatting 14 MB of generated scrape output would bury every real diff.
