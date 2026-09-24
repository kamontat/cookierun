# Treasure upgrade levels

## Goal

A treasure can be upgraded from +0 (not upgraded) to +9 (max). A build should be
able to say which level each treasure it names is at — either one level
(`+5`) or a range it accepts (`+8-9`, `+0-9`) — and carry that in the loadout
section of the code.

## Decisions

- A level belongs to one treasure, not to a slot. A slot holding alternatives
  gives each its own level: "Treasure A +0 or Treasure B +5-9".
- A treasure written with no level is **+0**. That covers every code written
  before this change and every treasure picked without touching its level.
- The level is display and wire-format data only. It does not affect the
  combi section, `isSemiAutoBuild`, or anything else the page derives.

## Wire format

`loadout.ts` owns it. `LOADOUT_VERSION` stays `1`: the change is additive, and
every code written before it decodes to what it meant then (level +0 being
what it now reads as).

Treasure ids are fixed at 3 characters, so a level needs no separator. After
each id come 0, 1 or 2 digits:

| Written | Meaning |
| --- | --- |
| `0FZ` | +0 |
| `0FZ5` | +5 |
| `0FZ58` | +5 to +8 |
| `0FZ09` | +0 to +9, any level |
| `0FZ9` | +9 |

Example: `1TU0FZ_0RB59.0QQ9` — slot 1 accepts A at +0 or B at +5-9, slot 2 wants
C at +9.

Digits are `[0-9]`, which already sit inside the loadout's alphabet, and
neither `_` nor `.` changes meaning, so the loadout still selects as one word.

### Canonical encoding

- A range whose two ends are equal is written as one digit (`55` → `5`).
- Level +0 is written as nothing (`0` and `00` → nothing).
- Ids are still sorted within a slot. The level does not take part: an id cannot
  repeat within a slot, so the id alone orders it.
- Slots are still sorted against each other when the order flag is `U`, by their
  whole written string, levels included — two slots with the same ids and
  different levels are different slots and must not tie.

### Decoding

Decoding accepts a non-canonical level as written (`00`, `55`, `0`) and
re-encoding snaps it to the canonical form, the same forgiveness the rest of
the loadout already has. It throws, naming the `T` group, when an alternative:

- has more than 2 characters after its 3-character id;
- has a non-digit character after its id;
- writes a range whose first digit is greater than its second (`95`).

There is no warning path in the loadout, so these are hard errors like every
other malformed loadout.

## Types

```ts
export type TreasurePick = {
	id: string;
	/** 0-9, inclusive. */
	min: number;
	/** 0-9, inclusive, never below min. */
	max: number;
};

export type Loadout = {
	// ...
	/** 0-3 slots, each holding one or more acceptable treasures. */
	treasures: TreasurePick[][];
	// ...
};
```

An object per pick rather than a levels array beside the ids, so an id and its
level cannot be reordered apart. `encodeLoadout` validates `min`/`max` as
integers within 0-9 with `min <= max`, and throws otherwise.

## Consumers

- `describe.ts` names each treasure with its level, always, including +0:
  `Treasure A +0 or Treasure B +5-9; Treasure C +9`. A range reads `+min-max`.
  The retired-entry note stays attached to the name, before the level.
- `hints.ts` needs no change: the `T` span still runs to the end of the section
  and reads `describeLoadout`'s treasure row.
- `full-code.ts` needs no change beyond types.

## UI

`<entry-tiles>` (`src/components/entry-tiles.ts`):

- Each pick row in the closed slot gets two `<select>`s, from and to, each
  offering `+0` through `+9`, between the name and the remove button. Both have
  accessible names that include the treasure's name.
- A new pick starts at `+0` / `+0`. A pick removed and later picked again starts
  at `+0` again.
- The two selects cannot build a reversed range: raising "from" above "to" lifts
  "to" to match, and lowering "to" below "from" drops "from" to match.
- `selected` stays `string[]`, in option order, unchanged.
- A new `levels` property, `Record<string, readonly [min, max]>`, holds the level
  of each selected value. Reading it returns an entry for every selected value
  (defaulting to `[0, 0]`) and none for anything else; writing it drops entries
  for values not selected. Changing a select dispatches the same bubbling
  `input` event a commit does.
- The picker dialog is unchanged: it chooses which treasures are in the slot.
  Committing keeps the level of every pick that stays.

`src/routes/combi-name/index.ts`:

- `readLoadout` zips each slot's `selected` with its `levels` into
  `TreasurePick[]`.
- `writeLoadout` writes options, then `selected`, then `levels` — levels after
  picks, since a slot drops levels for values it does not hold.

## Testing

- `loadout.test.ts`: every row of the table above round-trips; canonical forms
  (`00`, `55`, `0` re-encode short); slot sort with same ids, different levels;
  each decode error; `encodeLoadout` rejecting out-of-range and reversed levels;
  a pre-change code decoding to +0 everywhere.
- `full-code.test.ts`: the seeded 2,000-loadout sample draws random levels too.
- `describe.test.ts`: static, range, and +0 wording, with alternatives.
- `entry-tiles.test.ts`: selects render per pick, default +0, the two clamping
  rules, `input` on change, `levels` pruned with the picks, levels kept across a
  dialog commit.
- `index.test.ts`: changing a level updates the code; opening a code with levels
  sets the selects.
- The exhaustive test covers the combi section only and does not change.

## Docs

- `README.md`: the `T` row of the loadout table, a paragraph on levels with the
  table above, and a levelled example line.
- `.claude/skills/combi-codec/SKILL.md`: the loadout section describes the level
  suffix, its canonical form, and that no digits means +0.

## Out of scope

- Per-kind level caps (base, evolved and blessed all run 0-9 here).
- Levels on cookies, relays or pets.
