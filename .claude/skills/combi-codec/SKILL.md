---
name: combi-codec
description: Use when touching routes/combi-name/ — the codec, its character tables, labels, describe.ts, the loadout section (loadout.ts, catalog.ts, full-code.ts), or the combi page's form wiring. Required before adding or reordering a type, episode, boost, random boost, cookie power or action, since table order is the wire format.
---

# The combi codec

The character tables at the top of `routes/combi-name/codec.ts` are the single source of truth, and everything else derives from them:

- `TYPE_CHARS`, `EPISODE_CHARS`, `BOOST_SLOTS`, `RANDOM_BOOST_CHARS`, `COOKIE_POWER_BITS`, `ACTION_CHARS` define both the encoding and the set of valid values.
- `ALL_TYPES`, `ALL_EPISODES`, `ALL_BOOSTS`, `ALL_RANDOM_BOOSTS`, `ALL_COOKIE_POWERS`, `ALL_ACTIONS`, and `BOOST_LABELS` are computed from those tables — never hand-maintain a parallel list.
- `routes/combi-name/labels.ts` maps every value to a display name. A test asserts key-for-key parity with the `ALL_*` arrays, so a new value cannot ship unlabeled. Boost names live in `codec.ts` instead, because `decode`'s error messages quote them.
- `routes/combi-name/describe.ts` turns a `Combi` into display rows plus an auto/semi-auto verdict. It is the only place that decides how a combi reads in prose.
- `routes/combi-name/index.ts` pairs each `ALL_*` array with its label table and hands the result to the form components as their `options` property. `routes/combi-name/index.html` declares those elements empty on purpose — do not hardcode options into the markup.

To add a boost, episode, or cookie power: add it to its character table and its label table. Nothing else needs touching, and tests fail until both are done.

## Ordering is part of the wire format

`Object.keys` order determines the `ALL_*` order, which determines the boost slot order (slots 4-6) and the cookie power+ bit values. Reordering a table silently changes what existing codes mean. If the slot layout or a character mapping has to change, bump `VERSION` in `routes/combi-name/codec.ts` — `decode` rejects any other version outright.

The form end of that guarantee is `<check-group>`'s `selected` getter: it filters the element's own `options` rather than reading DOM order, which is what keeps boosts in slot order and cookie powers in bit order.

## Hard errors vs soft warnings

`decode` throws only when a code is unreadable: wrong length, unknown version, an unknown character in a slot, or a cookie mask above `7F`. It returns `{ combi, warnings }` and never throws when slot 2 (`A` vs `H`) disagrees with the flag slots, because hand-typed codes can contradict themselves. `isSemiAuto` is always the authority; `encode` normalizes slot 2 to match it. Keep that split — the UI depends on being able to show a contradictory code rather than refusing it.

## The exhaustive test

`routes/combi-name/exhaustive.test.ts` round-trips all 1,769,472 combinations and asserts encoding yields exactly 1,474,560 distinct codes (the auto/semi-auto character is derived, so the auto family collapses). Both numbers are hardcoded; changing the configuration space means recomputing them, and a mismatch usually means a table changed size rather than that the test is stale.

It covers the combi section only. A loadout's alternative treasure slots make its space open-ended rather than a fixed count to enumerate, so the loadout is instead covered by a seeded round-trip sample in `full-code.test.ts` — encode 2,000 random loadouts, decode each back, and check the result re-encodes to the same code.

## The loadout section

`routes/combi-name/loadout.ts` owns the loadout grammar — `encodeLoadout`, `decodeLoadout`, the fixed `C R P T` group order, and its own `LOADOUT_VERSION` character, independent of the codec's `VERSION` above. `routes/combi-name/catalog.ts` resolves every cookie, relay, pet, and treasure id against `assets/index.json`. That file doubles as the wire-format table: its keys are the ids a loadout carries on the wire, so a key must never be renumbered once a code could have used it. The combi section protects the equivalent promise by bumping `VERSION` whenever a table's order changes; `assets/index.json` has no version character, so the same promise is kept entirely by convention instead — `reconcile` in `scripts/utils/asset-ids.ts` only ever appends an id, and `fetch-assets` fails the run rather than let a rescrape move one. `routes/combi-name/full-code.ts` joins the two sections into `loadout.combi`, or just the bare combi when there is no loadout; `routes/combi-name/index.ts` encodes and decodes through `full-code.ts` exclusively, never calling `encodeLoadout`/`decodeLoadout` or `encode`/`decode` itself.

Encoding a loadout always writes its canonical form: ids sorted within a slot, whole slots sorted against each other whenever the order flag is `U` (order doesn't matter), and a single slot always written `U` since there is nothing to order. `decodeLoadout` does not have the codec's hard/soft split above — there is no warning path — but it is just as forgiving of a non-canonical code in its own way: it decodes one exactly as written rather than rejecting it, and only re-encoding snaps it back to canonical form.

## Scope

The combi section still does not model the cookie, relay, pet, or treasure: the game already stores those four in the combi, which is precisely why the 10 characters are spent on everything else. Don't add them to `codec.ts`. The loadout section is the exception — it exists to model exactly those four, for a code that needs to carry them anyway.

Route-only logic stays in the route. The codec is imported by exactly one page, so it lives at `routes/combi-name/codec.ts` rather than in `lib/`; the same is true of `loadout.ts`, `catalog.ts`, and `full-code.ts`.

`README.md` documents the slot format, and the loadout grammar, for humans.
