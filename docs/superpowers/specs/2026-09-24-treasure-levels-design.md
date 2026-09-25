# Treasure upgrade levels

## Goal

A treasure can be upgraded from +0 (not upgraded) to +9 (max). A build should be
able to say which levels each treasure it names is accepted at — one level
(`+5`), a run of them (`+8-9`, `+0-9`), or any set at all (`+0-2, +5-9`) — and
carry that in the loadout section of the code.

## Decisions

- A level belongs to one treasure, not to a slot. A slot holding alternatives
  gives each its own levels: "Treasure A +0-2, +5-9 or Treasure B +3".
- A treasure accepts a **set** of levels, never empty.
- A treasure written with no level is **+0**. That covers every code written
  before this change and every treasure picked without touching its levels.
- The levels are display and wire-format data only. They do not affect the
  combi section, `isSemiAutoBuild`, or anything else the page derives.

## Wire format

`loadout.ts` owns it. `LOADOUT_VERSION` stays `1`: the change is additive, and
every code written before it decodes to what it meant then (level +0 being
what it now reads as).

Treasure ids are fixed at 3 characters, so a level needs no separator. A
**copy** is an id followed by 0, 1 or 2 digits, naming one run of levels:

| Written | Levels |
| --- | --- |
| `0FZ` | +0 |
| `0FZ5` | +5 |
| `0FZ58` | +5 to +8 |
| `0FZ09` | +0 to +9, any level |
| `0FZ9` | +9 |

A treasure whose levels are not one run is written as several copies of its
id, one per run, joined by the alternative separator `_`:

| Written | Levels |
| --- | --- |
| `0FZ02_0FZ59` | +0 to +2, and +5 to +9 |
| `0FZ_0FZ9` | +0 and +9 |

Example: `1TU0FZ02_0FZ59_0RB3.0QQ9` — slot 1 accepts 0FZ at +0-2 or +5-9, or
0RB at +3; slot 2 wants 0QQ at +9.

Digits are `[0-9]` and the separators are unchanged, so the loadout still
selects as one word and `-` still appears only once.

### Canonical encoding

- Each pick's levels are sorted and de-duplicated, then split into maximal runs
  of consecutive levels. Each run is one copy: a run of one level is one digit,
  a longer run is two digits `min` then `max`, and a run of just +0 is written
  as the bare id.
- A pick's copies are written lowest run first, next to each other.
- Picks are still sorted within a slot by id alone.
- Slots are still sorted against each other when the order flag is `U`, by
  their whole written string — levels included.

### Decoding

Decoding accepts a non-canonical code as written and re-encoding snaps it to
canonical form, the same forgiveness the rest of the loadout already has:

- `00`, `0`, `55` are read as +0, +0, +5.
- Several copies of one id in one slot are merged into one pick whose levels
  are the union of theirs, whatever order they come in and whether or not they
  overlap or touch: `0FZ03_0FZ25` reads as +0-5 and re-encodes as `0FZ05`;
  `0FZ_0FZ` reads as +0.

It throws, naming the `T` group, when a copy:

- has more than 2 characters after its 3-character id;
- has a non-digit character after its id;
- writes a range whose first digit is greater than its second (`95`).

There is no warning path in the loadout, so these are hard errors like every
other malformed loadout.

## Types

```ts
export type TreasurePick = {
	id: string;
	/** Accepted levels, each 0 to 9. Never empty. */
	levels: number[];
};

export type Loadout = {
	// ...
	/** 0-3 slots, each holding one or more acceptable treasures. */
	treasures: TreasurePick[][];
	// ...
};
```

A slot holds each treasure at most once; the repeated copies exist only on the
wire. `encodeLoadout` throws when a slot lists one id twice, when a pick's
levels are empty, and when a level is not an integer within 0-9. It does not
throw on unsorted or repeated levels — it sorts and de-duplicates them, as it
already sorts ids.

## Consumers

- `describe.ts` names each treasure with its levels, always, including +0. Runs
  are joined by `, `, so " or " still only ever separates two treasures:
  `Treasure A +0-2, +5-9 or Treasure B +3; Treasure C +9`. A run reads `+n` or
  `+min-max`. The retired-entry note stays attached to the name, before the
  levels.
- `hints.ts` needs no change: the `T` span still runs to the end of the section
  and reads `describeLoadout`'s treasure row.
- `full-code.ts` needs no change beyond types.

## UI

`<entry-tiles>` (`src/components/entry-tiles.ts`):

- Each pick row in the closed slot shows the art, the name and the remove
  button on its first line, and a row of ten toggle buttons, `+0` through `+9`,
  under them. The row is a group labelled "<name> levels"; each button carries
  `aria-pressed`.
- A new pick starts with only `+0` pressed. A pick removed and later picked
  again starts at `+0` again.
- Pressing a button toggles that level. The last pressed button in a row cannot
  be released: it carries `aria-disabled="true"` and a press on it does nothing,
  since a treasure has to accept at least one level.
- The button row wraps. At 400px, ten buttons at the 44px coarse-pointer tap
  size do not fit on one line, and a wrap is better than shrinking the target.
- `selected` stays `string[]`, in option order, unchanged.
- A `levels` property, `Record<string, readonly number[]>`, holds the levels of
  each selected value, ascending. Reading it returns an entry for every selected
  value (defaulting to `[0]`) and none for anything else; writing it drops
  entries for values not selected. A toggle dispatches the same bubbling `input`
  event a commit does.
- The picker dialog is unchanged: it chooses which treasures are in the slot.
  Committing keeps the levels of every pick that stays.

No `<select>` is involved, so the happy-dom `<select>` shim in
`tests/happydom.ts` and the direct `happy-dom` devDependency added for it are
removed.

`src/routes/combi-name/index.ts`:

- `readLoadout` zips each slot's `selected` with its `levels` into
  `TreasurePick[]`.
- `writeLoadout` writes options, then `selected`, then `levels` — levels after
  picks, since a slot drops levels for values it does not hold.

## Testing

- `loadout.test.ts`: every row of both tables round-trips; canonical forms
  (`00`, `0`, `55` re-encode short; unsorted and repeated levels re-encode
  canonically); merging of repeated, overlapping and touching copies on decode;
  slot sort with same ids, different levels; each decode error; `encodeLoadout`
  rejecting empty and out-of-range levels and a repeated id; a pre-change code
  decoding to +0 everywhere.
- `full-code.test.ts`: the seeded 2,000-loadout sample draws random level sets.
- `describe.test.ts`: one level, one run, several runs, +0, with alternatives.
- `entry-tiles.test.ts`: ten buttons per pick, default +0 only, toggling, the
  last pressed button refusing release, `input` on toggle, `levels` pruned with
  the picks, levels kept across a dialog commit.
- `index.test.ts`: toggling a level updates the code; opening a code with
  levels, including several runs, presses the right buttons.
- The exhaustive test covers the combi section only and does not change.

## Docs

- `README.md`: the `T` row of the loadout table, a section on levels with both
  tables above, the rule on repeated ids, and a levelled example line.
- `.claude/skills/combi-codec/SKILL.md`: the loadout section describes the
  level suffix, runs and copies, canonical form, and that no digits means +0.
- `.claude/skills/ui-components/SKILL.md`: the `<entry-tiles>` contract and row
  description cover the level buttons and `levels`; the happy-dom `<select>`
  note goes with the shim.

## Out of scope

- Per-kind level caps (base, evolved and blessed all run 0-9 here).
- Levels on cookies, relays or pets.
