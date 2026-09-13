# The loadout section: cookie, relay, pet, and treasures in a code

Date: 2026-09-12

## Purpose

Today a combi code is exactly the ten characters the game's combi name field holds, and it deliberately carries none of the four things the game already stores in a combi — cookie, relay, pet, treasure. That was the right trade while the code had to *be* the combi name: ten characters are better spent on the run configuration the game forgets.

Sharing a build needs more than the game remembers. A guide that says "this combi, with these treasures, and any of these three in the last slot" cannot be written as a ten-character name. This design adds a second section to the code — the loadout — that carries the cookie, the relay, the pet, and up to three treasure slots, each treasure slot able to list acceptable alternatives.

The two sections are separated by `.`:

```
1C2LR0BP1ZTU0FZ_0RB-0QQ.1H3H-F400J
└───────── loadout ────┘ └─ combi ┘
```

The right-hand section is the existing ten-character code, unchanged and still typeable into the game. The left-hand section is new, variable length, and lives outside the game — in a guide, a spreadsheet, a chat message. A code with no `.` is a bare combi code and decodes exactly as it does today.

## Goals

- Carry cookie, relay, pet, and 0-3 treasure slots in a new section, with alternatives allowed per treasure slot.
- One ordered/unordered marker for the treasure section as a whole.
- Every code that is valid today stays valid and keeps its meaning.
- `routes/combi-name/codec.ts` is not modified, so `exhaustive.test.ts` and its two hardcoded counts keep passing untouched.
- Entry identifiers are stable for the life of the project: a rescrape, a rename, or new game content must never change what an existing code means.
- One build has exactly one canonical code, so two codes for the same build compare equal as strings.
- The picker shows the game's icons for all three sections, including treasures.

## Non-goals

- No change to the ten-character section. `VERSION` stays `1`, the character tables keep their key order, and the slot layout is untouched.
- No per-slot treasure pinning. Ordering is one flag for the whole treasure section; a build that needs one treasure fixed in place and the rest floating is not representable. See Decisions.
- No alternatives on cookie, relay, or pet. Those are single values.
- No treasure evolution features. `index.json` now carries evolution chains (`type`, `targets`, `source`); this design keeps those fields correct but builds nothing on them.
- No URL sharing, no deep links, no state in the address bar.

## The loadout grammar

```
FULL   := LOADOUT "." COMBI | COMBI
COMBI  := the existing ten-character code, unchanged
LOADOUT := "1" GROUP*
GROUP  := "C" ID2 | "R" ID2 | "P" ID2 | "T" ORDER SLOT ("-" SLOT){0,2}
SLOT   := ID3 ("_" ID3)*
ORDER  := "U" | "O"
ID2    := [0-9A-Z]{2}
ID3    := [0-9A-Z]{3}
```

`1` is the loadout section's own format version. The two sections version independently: the combi section keeps its `1` because nothing about it changes, and the loadout section starts its own count at `1`. Neither version number covers the other.

Group tags:

| Tag | Field | ID width | Capacity | In use |
| --- | --- | --- | --- | --- |
| `C` | Cookie | 2 | 1,296 | 94 |
| `R` | Relay cookie | 2 | 1,296 | 94 |
| `P` | Pet | 2 | 1,296 | 103 |
| `T` | Treasure slots | 3 each | 46,656 | 1,144 |

`C` and `R` read from the same cookie catalog, so a relay ID and a cookie ID with the same characters name the same cookie.

Inside the treasure group, `U` means slot position does not matter and `O` means it does, `-` separates slots, and `_` separates alternatives within one slot. `TU0FZ_0RB-0QQ` is two slots: the first accepts `0FZ` or `0RB`, the second wants `0QQ`.

Rules:

- Each group appears at most once, and groups appear in the order `C R P T`.
- An absent group means that field is unset. A cookie-only loadout is `1C2L`, so the full code is `1C2L.1H3H-F400J`.
- Zero to three treasure slots, no gaps, and every slot holds at least one ID. Zero treasures means no `T` group at all, which also means the ordered flag is absent — it carries no information with nothing to order.
- An ID must not repeat within one slot; the same ID may appear in two different slots, which is how overlapping alternatives are written.
- A loadout with every field unset is not written: `encodeFull` emits the bare ten-character code, with no `.`.

### Canonical form

`encodeLoadout` canonicalizes so that one build has one code:

- IDs within a slot are sorted ascending.
- When the flag is `U`, the slots themselves are sorted ascending, comparing each slot whole — every ID in it, in order — not just its first. Comparing first IDs alone ties whenever two slots share their smallest ID, and a tie leaves the caller's order in place, which is one build with two codes. When the flag is `O`, slot order is the build's own and is preserved.
- A single treasure slot is always written `U`. With one slot there is nothing to order, so `O` would be a second code for the same build.

`decodeLoadout` accepts a non-canonical code as written and does not warn. The round-trip property is therefore `encodeFull(decodeFull(code)) === canonical(code)`, not string equality with the input.

### Errors

The loadout section throws — it is unreadable, not merely self-contradictory — on:

- a missing or unrecognized version character
- an unknown group tag
- a duplicate group, or groups out of `C R P T` order
- an ID of the wrong width, or one containing a character outside `[0-9A-Z]`
- an ID absent from the catalog
- more than three treasure slots, or a slot with no IDs
- an order flag that is neither `U` nor `O`
- more than one `.` in the full code

The loadout section contributes no soft warnings. The existing slot-2 contradiction warning is unchanged, and `decodeFull` returns the same `warnings` array the current `decode` does.

## `assets/index.json` becomes the ID table

`index.json` is keyed today by a PascalCase identifier derived from the display name, numbered from 1 when two entries collapse onto the same name. `scripts/fetch-assets.ts` says what is wrong with that in its own comment: *"Numbering follows the listing, so inserting an entry upstream can renumber the ones after it."* A key that moves is a code that changes meaning, which is exactly what a wire format cannot tolerate.

The key becomes the wire ID, and the old key moves into a `key` field:

```json
{
  "cookies": {
    "00": {
      "key": "GingerBrave",
      "name": "GingerBrave",
      "url": "https://cookierundb.com/cookies/ch01",
      "image": "cookies/ch01.png"
    }
  },
  "treasures": {
    "000": {
      "key": "AlwaysCuteAcorn",
      "name": "Always Cute Acorn",
      "url": "https://cookierundb.com/treasures/always-cute-acorn",
      "image": "treasures/tr_ga034.png",
      "type": "N",
      "targets": ["00B", "00C"]
    }
  }
}
```

- The key is fixed-width base-36 — two characters for cookies and pets, three for treasures — and is character-for-character what appears in a code. Encoding is a lookup with no arithmetic, and the file doubles as the legend for reading a code by eye.
- `key` keeps the old PascalCase identifier. Nothing derives an ID from it; it stays because it is the readable handle the project already had, and because a diff of a rescrape is unreadable without it.
- `targets` and `source` hold the new IDs. They hold PascalCase keys today.
- `name`, `url`, `image`, `type` are unchanged in meaning.

### ID assignment is append-only

`assignIds` and `toId` are deleted. In their place, the scrape reconciles against the `index.json` already on disk:

1. Read the existing `index.json`. For each entry, recover its slug from the last path segment of `url`. That map — slug to ID — is authoritative and never rewritten.
2. For each scraped card, look up its slug. A hit reuses that ID. A miss takes the next free ID in the section, which is one past the highest ID in use, counted in base-36.
3. An entry whose slug no longer appears in the scrape keeps its entry with `"retired": true` added. Its ID is never reused. A code naming it still decodes — the entry is still in the catalog, so the code still means what it meant — and only the pickers and the prose treat it differently.
4. A retired slug that reappears drops the flag and keeps its original ID.
5. The run fails, printing every offender, if any existing slug would land on a different ID, or if a section would exceed its capacity.

Slug is the identity because it is the one stable field: the site's own URL segment. Display names change, and the current disambiguation scheme rewrites the key of an *existing* entry when a new entry collides with its name — so a name-derived identity can be changed by content that has nothing to do with it.

A first run against an empty or absent `index.json` assigns IDs in listing order, which is a normal case, not a special one.

### Catalog module

`routes/combi-name/catalog.ts` is the typed reader over `index.json`, reached through a new `#assets/*` entry in `package.json`'s `imports` field alongside `#lib/*` and `#components/*`:

- ID to entry, per section.
- Display name for an ID. Two live entries can share a `name`; the picker disambiguates by appending the `key` for names that appear more than once, computed from the index rather than stored.
- Retired-entry predicate, used to keep retired entries out of the pickers and to mark them in prose.
- Section capacity and ID width, so the codec and the capacity test read the same constants.

It lives in the route rather than `lib/`, like the codec, because exactly one page imports it.

## Codec files

`codec.ts` is untouched. Two new files sit beside it:

```ts
// routes/combi-name/loadout.ts
export type Loadout = {
  cookie: string | null;   // wire ID, e.g. "2L"
  relay: string | null;
  pet: string | null;
  treasures: string[][];   // 0-3 slots, each holding 1+ alternative IDs
  ordered: boolean;
};

export const EMPTY_LOADOUT: Loadout;
export function isEmptyLoadout(loadout: Loadout): boolean;
export function encodeLoadout(loadout: Loadout): string;
export function decodeLoadout(section: string): Loadout;
```

```ts
// routes/combi-name/full-code.ts
export type FullCode = { loadout: Loadout; combi: Combi };

export function encodeFull(full: FullCode): string;
export function decodeFull(code: string): { full: FullCode; warnings: string[] };
```

`encodeFull` emits `loadout + "." + combi`, or just the combi section when the loadout is empty. `decodeFull` splits on `.`, routes each half to its own decoder, and merges the warnings — of which only the combi half produces any.

The model holds wire IDs, not slugs or display names. The ID is now a stable first-class field of the index, so a second identifier in the model would only be something to keep in sync. Tests read `"2L"` and reach for the catalog when they need a name.

`describe.ts` gains `describeLoadout`, and keeps deciding all prose in one place. Rows: Cookie, Relay, Pet, and Treasures, where a slot with alternatives reads `A or B` and the section notes whether order matters. An unset field reads `None`, matching the existing rows. A retired entry reads with a `(no longer listed)` suffix, since the code is still readable and the reader deserves to know why they cannot find it in the game. The loadout rows come before the combi rows.

## Page and components

Two new components, following the contracts the existing five already follow — light DOM, no shadow root, styles in `routes/base.css` scoped by element name and including a `display` rule, `customElements.define` guarded by `customElements.get`, attributes for markup-authored configuration and properties for structured data, and no imports from `routes/`:

| Element | Attributes | Properties |
| --- | --- | --- |
| `<entry-picker>` | `label` | `options`, `value` |
| `<entry-set>` | `legend` | `options`, `selected` |

`<entry-picker>` is a type-to-filter list that resolves to one pick; cookie, relay, and pet each get one. `<entry-set>` is a single treasure slot holding its alternatives, with add and remove; the page declares three. An existing `<labelled-select>` carries Any order / Exact order.

`options` is a list of `[id, name, icon]` triples, prepared by `routes/combi-name/index.ts` from the catalog, the same way the current form pairs each `ALL_*` array with its label table. `index.html` declares all of them empty, as the current elements are.

Like `<check-group>`, `<entry-set>`'s `selected` getter filters the element's own `options` rather than reading DOM order, which is what keeps a slot's alternatives in ID order.

Icons render as `<img loading="lazy">` against `../assets/<section>/<file>.png`. Native lazy loading and search filtering are enough; 1,144 rows in the DOM do not need virtualization.

## Build and assets

`scripts/build.ts` copies `assets/cookies`, `assets/pets`, and `assets/treasures` into `dist/assets/` after the page build. The page itself stays a single HTML file with its JavaScript and CSS inlined; only the icons sit beside it. `file://` still works from an intact `dist/`, so what the project gives up is the single-file property for this page, not offline use.

`wrangler.jsonc` needs no change: it already serves all of `dist/`. Roughly 1,350 icon files is far inside Cloudflare's 20,000-file limit.

The page imports `index.json`, which the build inlines, taking the built page from about 150KB to about 500KB, or 120KB gzipped. Trimming `url` and `key` out of what ships would need a build-time slim index; not worth it until the page weight is a real complaint.

## Tests

- `exhaustive.test.ts` is untouched and keeps both hardcoded counts. It covers the combi section, which has not changed.
- `loadout.test.ts` covers the grammar, the canonical form, and each error in the list above by name.
- `full-code.test.ts` covers the `.` split, the bare-code path, and that every code valid today decodes to the same combi with an empty loadout.
- A seeded round-trip fuzz over random loadouts asserts `encodeFull(decodeFull(code)) === canonical(code)`. It replaces exhaustive coverage of the loadout, whose space is unbounded once alternatives exist: 1,769,472 combi configurations times 95 cookies times 95 relays times 104 pets times every subset of 1,144 treasures in up to three slots is not enumerable.
- `catalog.test.ts` asserts every ID is unique, of the right width for its section, and within capacity; that no live entry shares an ID with a retired one; and that every `targets`/`source` reference resolves.
- DOM tests for `<entry-picker>` and `<entry-set>`, beside the components, as the other five have.
- A scraper test covers reconciliation: an existing slug keeps its ID, a new slug appends, a vanished slug is retired rather than dropped, a reappearing slug recovers its ID, and a renumbering attempt fails the run.

## Documentation

- `README.md` gains the loadout grammar, the ID widths, and the two-section examples, next to the existing slot table.
- The `combi-codec` skill loses its "the codec deliberately does not model the cookie, relay, pet, or treasure — don't add them to the code" rule, which this design reverses, and gains the loadout grammar, the canonical-form rule, and the append-only ID rule.
- The `assets` skill is stale — it describes the `Name [slug]` disambiguation scheme that commit `d17bd81` already replaced — and gets rewritten for the ID-keyed shape, the append-only reconciliation, and the sibling-asset build.
- The `build-and-deploy` skill notes that the combi page's icons ship beside the HTML rather than inlined, and why.

## Decisions

**A second section rather than a wider code.** The ten-character section still has to fit the game's combi name field, so the loadout cannot be packed into it. Keeping the two apart means the right-hand side stays copy-pasteable into the game and every existing code keeps working.

**Tagged groups with absent fields omitted, over fixed positions or a bitpack.** Tags make a sparse loadout short — `1C2L` for a cookie alone — and make a hand-typed mistake diagnosable, since a decoder can say which group is malformed. Fixed positions would need placeholders for every unset field and would still need separators for alternatives, ending up a hybrid with none of the readability. A dense bitpack over cookie, relay, pet, and the flag would be shortest and completely opaque, which contradicts the project's stated choice of legibility over packing.

**Position in an append-only index, over a hashed identifier.** A hash was measured on the real data. A single-seed FNV hash of the index key, mod 36^width, is collision-free today at two characters for cookies (seed 3) and pets (seed 12) and at three characters for treasures (seed 11573); two characters for 1,144 treasures in 1,296 slots found no clean seed in three million tries. The scheme fails on growth, not on today's data: 1,144 of 46,656 slots are taken, so each new treasure collides with probability 2.45%, and a patch adding twenty treasures collides at about 39%. Resolving a collision means either an exception table or a reseed that rewrites every existing code. Since uniqueness is a property of the whole set, any guarantee of it requires a committed record of the set — and the committed record that never collides and survives renames is the better one. A four-character hash of the slug is clean today at seed 1 and risks 0.07% per new entry, but costs a character per treasure and still cannot promise uniqueness.

**One ordering flag, not per-slot pinning.** Per-slot pinned/floating flags would express a mixed build — one treasure locked to a position, the rest free — which one flag cannot. They cost three bits, a toggle per slot, per-slot prose, and canonical sorting of only the floating slots. Rejected as YAGNI: in these builds, slot position is guide priority rather than a hard requirement.

**Icons beside the page, not inlined.** Treasure icons are 11MB on disk, about 15MB as data URIs, which is not a page. Shipping them as sibling files keeps the page at about 500KB and keeps `file://` working; it costs the single-file property for this page alone.

**IDs in the model, slugs only in the scraper.** The scraper needs slug identity to reconcile, and nothing else does. Carrying both through the codec and the components would be two identifiers to keep in step for no gain.

## Risks

- **The index and the codes are now coupled.** A hand edit to `index.json` that reorders or renumbers anything silently changes what existing codes mean. `catalog.test.ts` catches duplicates and width errors but cannot know an ID *moved*. The scraper's reconciliation check is the real guard, and it only runs on a scrape.
- **Retired entries are forever.** Every entry the site ever published stays in `index.json`, so the file grows monotonically and the page ships every entry that ever existed. That is the price of a code never changing meaning.
- **A rename changes what the picker shows for an existing code.** IDs survive renames, so the code stays valid, but the prose a reader sees changes. That is the correct trade and worth stating.
- **The page's weight is now in a data file.** 339KB of JSON inlined into the page will grow with every game update, and nothing currently warns when it crosses a threshold.
