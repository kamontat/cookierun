---
name: assets
description: Use when touching assets/, scripts/fetch-assets.ts or assets/index.json, or when planning to show a cookie, pet or treasure icon in a page — the build inlines every referenced asset, so wiring one in has a size consequence.
---

# Assets

`bun run fetch-assets` scrapes cookie, pet, and treasure icons from cookierundb.com into `assets/` and writes `assets/index.json`, mapping each entry's display name to its icon path relative to `assets/`. It is idempotent — icons already on disk are skipped, so re-running only fills gaps.

Two things about `index.json` that matter to whatever consumes it. A display name can cover several entries; when their icons differ the key is disambiguated as `Name [slug]`, and when they share an icon the duplicate collapses into one key. So treat the keys as opaque strings rather than assuming one name means one entry.

Nothing consumes `assets/` yet. The codec deliberately does not model the cookie, relay, pet, or treasure: the game already stores those four in the combi, which is precisely why the 10 characters are spent on everything else. Don't add them to the code.

`assets/` is 14 MB (868 treasure icons account for 11 MB) and, unlike `dist/`, is committed on purpose: a planned feature reads it, so the scrape output stays in the repository rather than being fetched per clone. Since the page build inlines every referenced asset into one file, that feature needs either a curated subset or a non-standalone build that copies files alongside the HTML — 14 MB of data URIs in one page is not an option.

`biome.json` ignores `assets/` — reformatting 14 MB of generated scrape output would bury every real diff.
