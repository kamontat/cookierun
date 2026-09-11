---
name: assets
description: Use when touching assets/, scripts/fetch-assets.ts or assets/index.json, or when planning to show a cookie, pet or treasure icon in a page — the build inlines every referenced asset, so wiring one in has a size consequence.
---

# Assets

`bun run fetch-assets` scrapes cookie, pet, and treasure icons from cookierundb.com into `assets/` and writes `assets/index.json`. It is idempotent for icons — those already on disk are skipped, so re-running only fills gaps — but it always re-reads the treasure evolution chains, which costs one request per evolved treasure (524 today) on every run.

`index.json` has one object per section, keyed by a PascalCase id derived from the display name:

```jsonc
{
  "cookies": {
    "GingerBrave": {
      "name": "GingerBrave",
      "url": "https://cookierundb.com/cookies/ch01",
      "image": "cookies/ch01.png" // relative to assets/, or null where the game has no sprite
    }
  },
  "treasures": {
    "DoubleBubbleSBestFriend": { /* …, */ "type": "N", "targets": ["ChewyCheeseBall", "BlessedChewyCheeseBall"] },
    "ChewyCheeseBall": { /* …, */ "type": "E", "source": "DoubleBubbleSBestFriend" },
    "BlessedChewyCheeseBall": { /* …, */ "type": "B", "source": "DoubleBubbleSBestFriend" }
  }
}
```

Treasures carry their chain: `type` is `N` (base), `E` (evolved) or `B` (blessed). A base lists `targets` as `[evolved, blessed]`, with either half `null` when that form does not exist — 358 of the 620 bases are `[null, null]`. An evolved or blessed treasure names its base as `source`. The two directions are inverses of each other, so either can be walked.

The chain comes from the detail pages, not the listing: a listing card's `data-evo` says only that a treasure is evolved. The `rc-sub` captions on the detail page carry the meaning — `Evolves from` names the base, and `Unblessed form` appears only on a blessed page. Both the sitemap check and the chain checks fail the run loudly rather than writing a partial index.

Two entries can share a display name, and therefore an id. When that happens every member of the colliding group is numbered from 1 in listing order — `SotdaeFlock1`, `SotdaeFlock2`, `SotdaeFlock3` — so no entry is silently overwritten and none keeps the bare name. Numbering follows the listing page, so an entry added upstream can renumber the ones after it; the run throws if a numbered id ever lands on one that already exists. Treat the keys as opaque.

Nothing consumes `assets/` yet. The codec deliberately does not model the cookie, relay, pet, or treasure: the game already stores those four in the combi, which is precisely why the 10 characters are spent on everything else. Don't add them to the code.

`assets/` is 14 MB (868 treasure icons account for 11 MB) and, unlike `dist/`, is committed on purpose: a planned feature reads it, so the scrape output stays in the repository rather than being fetched per clone. Since the page build inlines every referenced asset into one file, that feature needs either a curated subset or a non-standalone build that copies files alongside the HTML — 14 MB of data URIs in one page is not an option.

`biome.json` ignores `assets/` — reformatting 14 MB of generated scrape output would bury every real diff.
