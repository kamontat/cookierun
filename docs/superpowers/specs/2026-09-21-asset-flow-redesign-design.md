# Asset flow redesign

**Date:** 2026-09-21

Rework `bun run fetch:assets` and `bun run verify:assets` around a simpler
contract: the scrape reconciles the index against cookierundb.com and records
when it last succeeded; the verifier asks cookierundb.com whether the index is
still complete. The fingerprint that guarded the index offline is removed.

## Why

`verify:assets` today answers "has this file been tampered with since the last
`--update`?" That is a narrow question, and the `--update` ritual it requires —
an appended id must land with its fingerprint refresh in the same commit, or the
suite fails — costs more attention than the class of bug it catches.

The question actually worth asking is "is the index still complete against the
site?", and that needs the network. So `verify:assets` goes online and compares
counts, `fingerprint.json` is deleted, and the offline structural checks it
shared a script with move entirely into the test suite, where they already run.

## Decisions

These were settled before the design and are not open in implementation:

1. **The fingerprint is deleted entirely** — `assets/fingerprint.json`, the
   hashing code, `verifyCovered`, `verifyIndex`, and the `--update` flag.
   Structural checking stays, but only in `scripts/utils/asset-ids.test.ts`.
2. **One global timestamp**, at the top of `assets/index.json`. No per-entry
   `fetchedAt`.
3. **Treasure detail pages are re-read every run**, as today. The timestamp does
   not gate fetching; there is no TTL and no `--force`.
4. **`verify:assets` compares non-retired counts per section** against the
   site's listing count, and exits non-zero on any mismatch.
5. **`verify:assets` runs on a schedule in CI**, not on push.

### Accepted consequence: the swap gap

With the fingerprint gone, a hand edit or a bad merge that *swaps* two entries'
`url` values between two ids passes every remaining check. `verifyStructure`'s
position check catches only an insertion or a deletion, and `fetch-assets`'
moved-id check compares against what is on disk — which the bad merge already
changed. This is a knowing trade: the ritual the fingerprint demanded was paid
on every append, while the corruption it caught has never occurred.

### Accepted consequence: the index is rewritten every run

`ordered()` and `serializeIndex` exist so that a rescrape changing nothing
rewrites nothing. A timestamp written on every successful run ends that: each
run produces at least a one-line diff. That is the point of the field — a
"last successful fetch" that moved only when data changed would not answer the
question — so the property is deliberately given up.

## Data shape

`assets/index.json` gains one top-level key, written first so the diff stays
readable:

```jsonc
{
  "fetchedAt": "2026-09-21T08:11:04.000Z",  // or null: never fetched
  "cookies": { "00": { "name": "GingerBrave", "url": "…", "image": "…", "key": "…" } },
  "pets": { /* … */ },
  "treasures": { /* … */ }
}
```

Entry shapes are unchanged — `key`, `name`, `url`, `image`, optional `retired`,
and for treasures `type` with `targets` or `source`.

`src/routes/combi-name/catalog.ts` reads only `DATA.cookies`, `DATA.pets` and
`DATA.treasures`; it never enumerates the top level, so the new key is invisible
to it. `catalog.test.ts` likewise touches only `index.treasures`. No route change
is needed.

## Modules

### `scripts/utils/asset-ids.ts`

Removed: `Fingerprint`, `Fingerprints`, `fingerprintOf`, `hashLines`,
`fingerprintsFor`, `fingerprintProblems`, `verifyCovered`, `verifyIndex`.

Changed:

- `AssetIndex` becomes `{ fetchedAt: string | null; cookies; pets; treasures }`.
- `migrate` carries a valid ISO 8601 string through to the output and yields
  `null` for a missing or malformed one, so an index from before this change
  migrates without failing.
- `serializeIndex` writes `fetchedAt` first, then the three sections as today.
- `verifyStructure` reports a `fetchedAt` that is neither `null` nor a
  parseable ISO 8601 instant. It reads the value off the **parsed** input, not
  off `migrate`'s output: `migrate` has already normalised a malformed one to
  `null`, so a check downstream of it could never fire. Without the explicit
  check the fault would still be caught — `serializeIndex(migrate(text))` would
  write `null` where the file says something else, failing the byte-identity
  check — but as generic drift rather than as the specific problem.

Unchanged: `Section`, `SECTIONS`, `ID_WIDTH`, `CAPACITY`, `Entry`,
`TreasureEntry`, `toId`, `fromId`, `slugOf`, `ordered`, `reconcile`,
`chainProblems`.

The file drops from 593 lines to roughly 420.

### `scripts/utils/cookierundb.ts` (new)

`verify:assets` needs the listing pages, but `fetch-assets.ts` runs its entire
scrape as top-level module code — importing anything from it would run a scrape.
The site client therefore moves into its own module:

- `ORIGIN`
- `get(path)` — the existing three-attempt retry with backoff
- `unescapeHtml(text)`
- `parseListing(html): Card[]` and `fetchListing(section)`
- `parseEvolution(html): { source, type } | null` and `fetchEvolution(slug)`
- `parseSitemap(xml)` and `fetchSitemap()`
- the `Card` type and the `CARD_RE`, `REL_RE`, `LOC_RE` patterns

Parsing is split from fetching so the three regexes can be tested against
fixture HTML. They are untested today.

`fetch-assets.ts` keeps only orchestration.

## `fetch-assets.ts`

The flow — sitemap → listings → sitemap cross-check → reconcile → chains →
entries → retirement → moved-id check → icons → structure check → write — is
unchanged. Four edits:

1. Delete the fingerprint block and its "run `--update` in the same commit"
   warning.
2. Compute `fetchedAt`:

   ```ts
   const fetchedAt = failures.length === 0
     ? new Date().toISOString()
     : previous.fetchedAt;
   ```

   Icon downloads are the only partial-success path in the script: sitemap
   drift, chain problems and a failed structure check all `bail` before the
   write. So an icon that did not arrive means the run was not a success, and
   the previous timestamp stands while the index itself is still written.

3. Write through `serializeIndex({ fetchedAt, ...index })`.
4. Print a change report after `index written`, computed by comparing
   `previous` against the assembled index:

   ```
   cookies:   94 total — 0 added, 0 updated, 0 retired, 0 restored, 94 unchanged
   pets:      103 total — 0 added, 0 updated, 0 retired, 0 restored, 103 unchanged
   treasures: 1144 total — 2 added, 1 updated, 0 retired, 1 restored, 1140 unchanged
   ```

   - **added** — an id in the new index and not in `previous`.
   - **retired** — an id now carrying `retired: true` that did not before.
   - **restored** — an id that carried `retired: true` and no longer does.
     This is already the behaviour: `reconcile` matches by slug, so a returning
     entry keeps its id and `entryFor` rebuilds it without the flag. The report
     only makes it visible.
   - **updated** — present in both, neither retired nor restored, and
     `JSON.stringify(ordered(before)) !== JSON.stringify(ordered(after))`.
   - **unchanged** — the remainder.

## `verify-assets.ts`

Rewritten, roughly 60 lines. `--update` is gone.

1. Read `assets/index.json`. Missing, unparseable, or refused by `migrate` →
   report and exit 1.
2. Fetch the three listing pages through `cookierundb.ts`. A network failure
   reports the section and exits 1.
3. Per section, compare `cards.length` from the site against the number of
   entries without `retired: true`.
4. Print the timestamp and one line per section:

   ```
   fetched 2026-09-21T08:11:04.000Z
   cookies:   94 on site, 94 listed (0 retired) — ok
   pets:      103 on site, 103 listed (0 retired) — ok
   treasures: 1145 on site, 1144 listed (0 retired) — 1 missing, run `bun run fetch:assets`
   ```

   A `fetchedAt` of `null` prints `never fetched`.
5. Exit 1 if any section mismatches.

No structural checking. That is the suite's job now, and duplicating it here
would mean two places to keep in step — the thing the shared
`scripts/utils/asset-ids.ts` exists to prevent.

## Tests

`scripts/utils/asset-ids.test.ts`:

- Remove the four fingerprint tests: the committed-fingerprint check, the
  coverage round-trip, the append-past-coverage case, and the malformed
  fingerprint case.
- Collapse the parameterised `verify` helper to `verifyStructure`.
- Add: the committed `assets/index.json` passes `verifyStructure`.
- Add: `fetchedAt` round-trips through `migrate` and `serializeIndex`, and a
  malformed one is reported rather than thrown on.

`scripts/utils/cookierundb.test.ts` (new), all against fixture HTML strings:

- `parseListing` — an entry with an icon, a spriteless entry (placeholder
  `<span>`, no `<img>`), `data-evo="1"`, and an HTML-escaped display name.
- `parseEvolution` — an evolved page (`Evolves from`), a blessed page
  (`Evolves from` plus `Unblessed form`), and a page naming no base, which
  yields `null`.
- `parseSitemap` — section slugs collected, `/th/` translations ignored.

Implementation follows TDD: the test for each pure function lands before the
function it covers.

## CI

New `.github/workflows/assets.yml`, reusing the action SHAs already pinned in
`main.yml`:

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

Scheduled rather than on push: `verify:assets` fails whenever cookierundb.com
gains an entry, and `main.yml` gates the deploys. On push, the day the site adds
a cookie every open branch would go red for a reason unrelated to its own diff.
A weekly run reports drift on its own cadence instead.

## Documentation

- `README.md` — the `verify:assets` line in the command list.
- `AGENTS.md` — both script descriptions in the command block, and the sentence
  describing what `verify-assets.ts` checks.
- `.claude/skills/assets/SKILL.md` — the frontmatter description (drop
  `assets/fingerprint.json`); the opening paragraph calling `verify:assets`
  offline; the idempotence claim, now qualified by `fetchedAt`; the sentence
  crediting `verify:assets` with the chain checks, which the suite now owns; and
  the whole "The fingerprint, and what it is for" section, replaced by a shorter
  "What guards the ids now" naming the two remaining guards — `reconcile` only
  appends, `fetch-assets` fails rather than move an id — and the swap gap above.
- `.claude/skills/repo-scripts/SKILL.md` — the description of what each script
  does.
- `.claude/skills/combi-codec/SKILL.md` — the three id guards become two.
- `.claude/skills/build-and-deploy/SKILL.md` — `fingerprint.json` no longer
  exists to be excluded from `dist/`, and `assets.yml` joins the workflows the
  skill covers.

## Order of work

1. Extract `scripts/utils/cookierundb.ts` with its tests. No behaviour change;
   `bun run check && bun run test` stays green.
2. Thread `fetchedAt` through `asset-ids.ts` with its tests.
3. Strip the fingerprint from `asset-ids.ts` and the test file; delete
   `assets/fingerprint.json`.
4. Rewrite `verify-assets.ts`.
5. Add the change report to `fetch-assets.ts`.
6. Run `bun run fetch:assets` against the live site, so the committed index
   gains a real `fetchedAt` and the whole flow is proven. If the site is
   unreachable, hand-write `"fetchedAt": null` instead and say so.
7. Add `.github/workflows/assets.yml`.
8. Update the documentation listed above.
