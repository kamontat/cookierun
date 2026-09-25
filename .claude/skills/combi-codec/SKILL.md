---
name: combi-codec
description: Use when touching src/routes/combi-name/ — the codec, its character tables, labels, describe.ts, the loadout section (loadout.ts, catalog.ts, full-code.ts), or the combi page's form wiring. Required before adding or reordering a type, episode, boost, random boost, cookie power or action, since table order is the wire format.
---

# The combi codec

The character tables at the top of `src/routes/combi-name/codec.ts` are the single source of truth, and everything else derives from them:

- `TYPE_CHARS`, `EPISODE_CHARS`, `BOOST_BITS`, `RANDOM_BOOST_CHARS`, `COOKIE_POWER_BITS`, `ACTION_CHARS` define both the encoding and the set of valid values.
- `ALL_TYPES`, `ALL_EPISODES`, `ALL_BOOSTS`, `ALL_RANDOM_BOOSTS`, `ALL_COOKIE_POWERS`, `ALL_ACTIONS`, and `BOOST_LABELS` are computed from those tables — never hand-maintain a parallel list.
- `src/routes/combi-name/labels.ts` maps every value to a display name. A test asserts key-for-key parity with the `ALL_*` arrays, so a new value cannot ship unlabeled. Boost names live in `codec.ts` instead, because `decode`'s error messages quote them.
- `src/routes/combi-name/describe.ts` turns a `Combi` into display rows plus an auto/semi-auto verdict, and a `Loadout` into its own rows. It is the only place that decides how a combi or a loadout reads in prose. `hints.ts` reads `describeLoadout`'s rows, `index.ts` reads `describeCombi`'s verdict for the board header, and `entryName` — which appends a note to an entry the site has since dropped — stays private to the file: both `describeLoadout` and its own `treasureRow` helper call it, so that note reads the same wherever a loadout entry is named.
- `src/routes/combi-name/hints.ts` says what each character of a code means, one entry per character, for the tooltips on the built code. Slot numbers come from the codec's own tables and the values from `describe.ts`, so a table that grows cannot leave a stale hint behind. A code it cannot decode gets no hints at all rather than half a labelling, which would point at the wrong characters. Its `group` field carries a second job now: `<code-bar>` draws each run of one group as a single button and emits that group name when the run is clicked, and `index.ts`'s `OWNER` map turns the name into the control to focus. A group added here without an `OWNER` entry simply does not jump — it does not break.
- `src/routes/combi-name/art.ts` says which cookies or pets each cookie power+ belongs to, so the cards can wear their faces. Each entry is a list of `{ section, key }` against the catalog's own keys rather than wire ids — five powers name one cookie, Serenade of Love the two pets that sing it, EXP Party the four cookies that throw it. A test asserts key-for-key parity with `ALL_COOKIE_POWERS`, the same guard `labels.ts` has, so a new power cannot ship without the page deciding what face it wears. The codec still does not model a cookie — this mapping is the page's, not the format's. `BOOST_ART` and `EPISODE_ART` beside it do the same job for the boost cards and the episode picker's cells, naming the authored key each one's icon is filed under in `assets/index.json` and resolving it through `catalog.ts`'s `staticImage`. Both carry the same parity test, and both have entries the other end lacks in one direction or the other: `any` is the episode with no icon, while the index holds one boost and two episodes the codec has no character for. To add a boost or episode, that is the third table to fill in after the character table and the label table — and the test fails until you do.
- `src/routes/combi-name/index.ts` pairs each `ALL_*` array with its label table and hands the result to the form components as their `options` property. `src/routes/combi-name/index.html` declares those elements empty on purpose — do not hardcode options into the markup.

To add a boost, episode, or cookie power: add it to its character table, its label table, and its art table in `art.ts`. Nothing else needs touching, and tests fail until all three are done.

## Ordering is part of the wire format

`Object.keys` order determines the `ALL_*` order for the character tables, and `BOOST_BITS`'s array order determines `ALL_BOOSTS`. Reordering a character table silently changes what existing codes mean. The two mask tables — `BOOST_BITS` and `COOKIE_POWER_BITS` — write their bit values out rather than derive them from position, so reordering one of those moves the cards on the page without moving the wire format; changing a bit value moves the wire format. If the slot layout or a character mapping has to change, bump `VERSION` in `src/routes/combi-name/codec.ts` — `decode` rejects any other version outright. (`VERSION` is still `1` after the boosts moved from three flag slots into the slot 4 mask, because that happened before any code had been published.)

The form end of that guarantee is `<card-group>`'s `selected` getter: it filters the element's own `options` rather than reading DOM order, which is what keeps boosts in slot order and cookie powers in bit order.

## Semi-auto is derived, and the page says so by not offering it

`ALL_TYPES` carries `semiauto` and `TYPE_CHARS` maps it to `H`, because a code
carrying `H` has to decode — but the page's type chips are `ALL_TYPES` minus
that one. Semi-auto is what `normalizeType` makes of an auto run when Fast
Start, a random boost, a jump action or a relay cookie is in play, so a chip for
it could only disagree with the code those produce. `writeForm` lands a decoded
`semiauto` on the Auto chip, and the chip's own label follows the build: the
route rewrites it to `Semi-auto` whenever `isSemiAutoBuild` says so, which is
also what the board's badge and verdict sentence read.

The relay is the one reason that is not in the ten characters. `isSemiAuto` in
`codec.ts` answers for the combi's own three flags and knows nothing else;
`isSemiAutoBuild` in `full-code.ts` adds the loadout's relay, and it is the one
question whose answer needs both halves. `encode` and `decode` take a
`forcedSemiAuto` flag for it — the word "relay" never reaches the codec, so the
caller that knows the reason is also the one that names it in a warning.

That is a page decision, not a format one. Do not remove `semiauto` from
`codec.ts` to match the picker: it is slot 2's `H`, and dropping it would make
every semi-auto code ever written unreadable.

## Which characters a code may use

The separators are chosen for word-wise selection (double-click, Option+Shift+Arrow), which stops at `-` but not at `_` or `.`. So `-` appears exactly once, between the loadout and the combi, and the combi half is `[0-9A-Z]` only — `0` is its one "off" character (reserved slots, action none, random boost none) — so the ten characters the game takes select on their own. Inside the loadout, `.` separates treasure slots, `_` joins a slot's alternatives, and `__` is Any; none of them breaks a word, so the loadout selects whole. Do not put `-` anywhere but the section split, and do not bring a word-breaking character into either half.

## Hard errors vs soft warnings

`decode` throws only when a code is unreadable: wrong length, unknown version, an unknown character in a slot, or a cookie mask above `7F`. It returns `{ combi, warnings }` and never throws when slot 2 (`A` vs `H`) disagrees with the flag slots, because hand-typed codes can contradict themselves. `isSemiAuto` is always the authority; `encode` normalizes slot 2 to match it. Keep that split — the UI depends on being able to show a contradictory code rather than refusing it.

## The exhaustive test

`src/routes/combi-name/exhaustive.test.ts` round-trips all 3,538,944 combinations and asserts encoding yields exactly 2,949,120 distinct codes (the auto/semi-auto character is derived, so the auto family collapses). Both numbers are hardcoded; changing the configuration space means recomputing them, and a mismatch usually means a table changed size rather than that the test is stale. Both tests also carry an explicit 60s timeout: their runtime is the size of the format, and the 5s Bun allows by default was already tight on a CI runner at half this space.

It covers the combi section only. A loadout's alternative treasure slots make its space open-ended rather than a fixed count to enumerate, so the loadout is instead covered by a seeded round-trip sample in `full-code.test.ts` — encode 2,000 random loadouts, decode each back, and check the result re-encodes to the same code.

## The loadout section

`src/routes/combi-name/loadout.ts` owns the loadout grammar — `encodeLoadout`, `decodeLoadout`, the fixed `C R P T` group order, and its own `LOADOUT_VERSION` character, independent of the codec's `VERSION` above. `src/routes/combi-name/catalog.ts` resolves every cookie, relay, pet, and treasure id against `assets/index.json`. That file doubles as the wire-format table: its keys are the ids a loadout carries on the wire, so a key must never be renumbered once a code could have used it. The combi section protects the equivalent promise by bumping `VERSION` whenever a table's order changes; `assets/index.json` has no version character, so the same promise is kept by two guards instead: `reconcile` in `scripts/utils/asset-ids.ts` only ever appends an id, and `fetch-assets` fails the run rather than let a rescrape move one. `verifyStructure`, run over the committed file by the suite, adds a third partial one: it catches an id deleted or inserted anywhere but the end, since ids must sit dense from zero. A `url` swapped between two existing ids is caught by none of them — read `git diff assets/index.json` when a merge touches it. `src/routes/combi-name/full-code.ts` joins the two sections into `loadout-combi`, or just the bare combi when there is no loadout; `src/routes/combi-name/index.ts` encodes and decodes through `full-code.ts` exclusively, never calling `encodeLoadout`/`decodeLoadout` or `encode`/`decode` itself.

Encoding a loadout always writes its canonical form: ids sorted within a slot, whole slots sorted against each other whenever the order flag is `U` (order doesn't matter), and a single slot always written `U` since there is nothing to order. `decodeLoadout` does not have the codec's hard/soft split above — there is no warning path — but it is just as forgiving of a non-canonical code in its own way: it decodes one exactly as written rather than rejecting it, and only re-encoding snaps it back to canonical form.

Each treasure id may be followed by a level: nothing for +0, one digit for one level, two for a run `min` then `max`. `Loadout.treasures` holds `TreasurePick { id, levels }` for it, built with `treasurePick`, where `levels` is a set — any levels at all, never none. A set that is not one run goes on the wire as one copy of the id per run (`levelRuns` finds them), lowest first, so `0FZ02_0FZ59` is 0FZ at +0-2 or +5-9. Decoding merges every copy of an id in a slot back into one pick, overlapping or not; encoding rejects a slot that lists an id twice, since a `Loadout` holds each treasure once per slot. Canonical form writes maximal runs, +0 as nothing and a one-level run as one digit; within a slot picks still sort by id alone, while unordered slots sort by their whole written string, levels included. No digits reading as +0 is what keeps every earlier code meaning what it did, which is why `LOADOUT_VERSION` stayed `1`. On the page, `<entry-tiles>`'s `levels` property carries the sets beside `selected`, and `writeLoadout` writes options, then picks, then levels, since each write prunes against the one before.

## Scope

The combi section still does not model the cookie, relay, pet, or treasure: the game already stores those four in the combi, which is precisely why the 10 characters are spent on everything else. Don't add them to `codec.ts`. The loadout section is the exception — it exists to model exactly those four, for a code that needs to carry them anyway.

Route-only logic stays in the route. The codec is imported by exactly one page, so it lives at `src/routes/combi-name/codec.ts` rather than in `src/lib/`; the same is true of `loadout.ts`, `catalog.ts`, `full-code.ts`, `hints.ts`, `art.ts`, and `state.ts`.

## One code, one state

The page holds exactly one thing: a `FullCode`. Every control writes it and the code bar writes it, and everything on screen is rendered from it by the route's single `render`. There is no second copy of the code and no separate reader — building a code and reading one are the same screen, which is why `<code-bar>` is both the output and the input. The page is one board, not a summary beside a set of controls: every value it shows is the control that writes it, so there is no second rendering of the build for `render` to keep in step with the first.

A treasure slot's `legend` is one of those values: `render` writes it from `full.loadout.ordered`, the order flag the decoded code actually carries, not from the `treasureOrder` chip group beside the heading. The two can disagree — with fewer than two slots filled there is nothing to order, so canonical encoding always writes a single slot `U` regardless of what the switch asked for (see "The loadout section" below) — so the labels read `Slot 1` / `Slot 2` / `Slot 3` only once the code itself carries an order, and `Any slot` otherwise, even while the switch still reads "Exact order". The labels follow the code on purpose: the switch says what was asked for, the code says what got written, and a label is a claim about the code.

The treasure slots are the one place where what the page offers and what the format allows come apart. `optionsFor("treasures")` leaves out the consumable family — see the `assets` skill — but a code can still carry one, so `writeLoadout` appends any carried id the offered list lacks to that slot's own `options`, and writes the options before the picks. Both halves matter: a slot prunes a pick its options do not hold, and the two are separate writes. Without it, opening a saved link would quietly drop a treasure and rewrite the code in the address bar.

A treasure slot's options carry a fourth field, the entry's kind — `base`, `evolved` or `blessed` — which `catalog.ts`'s `kindFor` reads off the index's `N`/`E`/`B` and the picker draws as a badge, a coloured ring and a filter row. It is display only: no slot of the wire format holds it, and a code says which treasure, never which form of it, because the id already does. The route writes it in two places, `pickerOptions` for the offered list and `treasureOptions` for a carried id the picker hides, the same pair `labelFor` and `imageFor` are written in. The three `<entry-tile>` pickers take the plain triple through `tileOptions`: nothing a cookie or pet picker holds evolves. `tileOptions` also puts Any at the head of each of those three lists, under the tile's own None — `catalog.ts`'s `anyIdFor` is `_` repeated to the section's width, and `labelFor` names it "Any cookie" or "Any pet", so `describe.ts` and the tooltips read it without learning the sentinel. It is a value the wire format carries, not a display state: `encodeLoadout` and `decodeLoadout` skip `checkId` for it in the `C`, `R` and `P` groups only, and `isEmptyLoadout` counts a slot holding it as filled. `_` is outside the `[0-9A-Z]` alphabet `scripts/utils/asset-ids.ts` allocates from, so no guard is needed at that end and no growth of the catalog can collide with it. `LOADOUT_VERSION` stays `1` because the change is additive — every code written before it decodes to exactly what it did.

A code typed into the bar is decoded on every keystroke. A code that does not read yet is not an error to argue with: the controls are left exactly where they are, and the bar says how many of the ten characters have arrived. Only a code that decodes is applied. That distinction is the reason `readDraft` tests the length before it calls `decodeFull`, rather than letting the codec's own error speak for a half-typed code.

## Where the code lives between visits

`src/routes/combi-name/state.ts` holds it in two places, and neither is trusted on the way back in: the address bar, so a build is a link someone can send, and `localStorage`, so closing the tab does not throw the last build away. A link wins over the remembered code — someone who followed one asked for that code, and their own build is one Reset away. The page writes the hash with `history.replaceState`, since one history entry per keystroke would bury the page they arrived from, and every storage call is wrapped the way `theme-toggle`'s are. A code that arrives from either place is decoded through `decodeFull` inside a `try`; both outlive the page that wrote them, and a hash can be typed by hand.

`README.md` documents the slot format, and the loadout grammar, for humans.
