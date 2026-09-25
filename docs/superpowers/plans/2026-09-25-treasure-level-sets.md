# Treasure Level Sets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a treasure accept any set of upgrade levels (e.g. +0-2 and +5-9), not only one continuous range, on the wire and in the page.

**Architecture:** This revises the already-built one-range levels on branch `feat/treasure-levels` (PR #11). `TreasurePick` becomes `{ id, levels: number[] }`. On the wire a pick is written as one copy of its id per maximal run of consecutive levels (`0FZ02_0FZ59`); decode merges copies of one id in a slot. `<entry-tiles>` replaces its two `<select>`s with ten toggle buttons, which also retires the happy-dom `<select>` shim.

**Tech Stack:** Bun (`bun test`, happy-dom preloaded), TypeScript, Lit, Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-treasure-levels-design.md` (rewritten for level sets)

## Global Constraints

- No digits after a treasure id means +0. `LOADOUT_VERSION` stays `"1"`.
- A pick's `levels` are integers 0-9, never empty. Decoded picks hold them ascending and distinct; `encodeLoadout` sorts and de-duplicates rather than rejecting unsorted input.
- One copy per maximal run of consecutive levels: bare id for a run of only +0, one digit for a one-level run, two digits `min` `max` otherwise. A pick's copies are written lowest run first, adjacent. Picks sort within a slot by id alone; unordered slots sort by their whole written string.
- Decode merges every copy of one id in a slot into one pick (union of levels, any order, overlapping or touching). Encode rejects a slot listing one id twice.
- Level text: runs read `+n` or `+min-max`, joined by `, `; " or " only separates treasures.
- UI: ten buttons `+0`…`+9` per pick, group labelled `<name> levels`, `aria-pressed` on each; a new pick is `[0]`; the last pressed button carries `aria-disabled="true"` and ignores presses; the row wraps.
- Imports carry no file extension (except `lit/decorators.js`, `lit/directives/*.js`). `src/components/` never imports from `src/routes/`.
- Read the `combi-codec` skill before touching `src/routes/combi-name/`, and `ui-components` before `src/components/`.
- Commands: `bun run test <file>`, `bun run check` (tsc + biome). Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- A code from before levels (`1TU0FZ_0RB.0QQ`) still decodes to +0 everywhere and re-encodes byte-identical. → Task 5, "codes without levels read as +0 and keep their code" (existing, must stay green).
- A code built on this PR's earlier one-range format (`1TU0FZ_0RB59.0QQ9`) still decodes to the same levels. → Task 5, "each alternative carries its own level" (existing, must stay green).
- Two unordered slots with the same id, one split and one not, produce one code whichever order they arrive in. → Task 5, "a slot with split runs still sorts to one code among unordered slots".
- The last pressed level can't be released, so the page never builds a pick with no level. → Task 6, "the last pressed level cannot be released".
- A typed code with a backwards copy (`0FZ95`) leaves the buttons untouched. → Task 7, "a code with a backwards level range changes nothing".

---

### Task 5: Level sets in the loadout grammar, and their prose

**Files:**
- Modify: `src/routes/combi-name/loadout.ts`
- Modify: `src/routes/combi-name/describe.ts` (`levelText`)
- Modify: `src/routes/combi-name/index.ts` (`readLoadout`, `writeLoadout` — stopgap until Task 7)
- Test: `src/routes/combi-name/loadout.test.ts`, `src/routes/combi-name/describe.test.ts`, `src/routes/combi-name/full-code.test.ts`

**Interfaces:**
- Produces (from `loadout.ts`):
  - `export type TreasurePick = { id: string; levels: number[] }`
  - `export function treasurePick(id: string, levels: readonly number[] = [0]): TreasurePick`
  - `export function levelRange(min: number, max = min): number[]` — every level min..max inclusive; empty when max < min.
  - `export function levelRuns(levels: readonly number[]): [number, number][]` — sorted, de-duplicated, maximal runs, lowest first.
  - `MAX_LEVEL` unchanged.

- [ ] **Step 1: Point the test helpers at the new type**

In each of `loadout.test.ts`, `describe.test.ts` and `full-code.test.ts`, replace `const t = treasurePick;` with:

```ts
const t = (id: string, min = 0, max = min): TreasurePick =>
	treasurePick(id, levelRange(min, max));
```

and add `levelRange` and `type TreasurePick` to that file's import from `./loadout`. Every existing fixture (`t("0FZ", 5, 8)` etc.) keeps its meaning.

- [ ] **Step 2: Change the existing tests whose rule changed**

In `loadout.test.ts`:

Replace the body of `test("encoding validates levels the same way", …)` with:

```ts
	expect(() =>
		encodeLoadout(loadout({ treasures: [[treasurePick("0FZ", [])]] })),
	).toThrow('loadout group "T": "0FZ" accepts no level');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 0, 10)]] })),
	).toThrow('loadout group "T": "0FZ" level 10 is outside 0-9');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 1.5)]] })),
	).toThrow('loadout group "T": "0FZ" level 1.5 is outside 0-9');
```

Replace `test("a repeated id is rejected whatever levels the two copies carry", …)` with:

```ts
test("copies of one id in a slot merge on decode", () => {
	expect(decodeLoadout("1TU0FZ1_0FZ2").treasures).toEqual([[t("0FZ", 1, 2)]]);
	expect(encodeLoadout(decodeLoadout("1TU0FZ1_0FZ2"))).toBe("1TU0FZ12");
});
```

Replace `test("a repeated id within one slot is rejected, across slots is allowed", …)` with:

```ts
// On the wire an id repeats within a slot to list another run of its levels,
// so decoding merges the copies. A Loadout holds each treasure once per slot,
// so encoding one that lists an id twice is still an error.
test("a repeated id within one slot merges on decode, is rejected on encode, and may repeat across slots", () => {
	expect(decodeLoadout("1TU000_000").treasures).toEqual([[t("000")]]);
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("000"), t("000", 3)]] })),
	).toThrow('loadout group "T": slot 1 lists "000" twice');
	expect(decodeLoadout("1TU000.000").treasures).toEqual([
		[t("000")],
		[t("000")],
	]);
});
```

- [ ] **Step 3: Write the failing tests for level sets**

Append to `loadout.test.ts`:

```ts
const SPLIT = [0, 1, 2, 5, 6, 7, 8, 9];

test("a treasure whose levels are not one run is written as one copy per run", () => {
	expect(
		encodeLoadout(loadout({ treasures: [[treasurePick("0FZ", SPLIT)]] })),
	).toBe("1TU0FZ02_0FZ59");
	expect(
		encodeLoadout(loadout({ treasures: [[treasurePick("0FZ", [9, 0])]] })),
	).toBe("1TU0FZ_0FZ9");
	expect(decodeLoadout("1TU0FZ02_0FZ59").treasures).toEqual([
		[treasurePick("0FZ", SPLIT)],
	]);
});

test("a pick's copies sit together among the other alternatives", () => {
	const code = encodeLoadout(
		loadout({
			treasures: [[t("0RB", 3), treasurePick("0FZ", SPLIT)], [t("0QQ", 9)]],
		}),
	);

	expect(code).toBe("1TU0FZ02_0FZ59_0RB3.0QQ9");
	expect(decodeLoadout(code).treasures).toEqual([
		[treasurePick("0FZ", SPLIT), t("0RB", 3)],
		[t("0QQ", 9)],
	]);
});

test("unsorted or repeated levels encode canonically", () => {
	expect(
		encodeLoadout(loadout({ treasures: [[treasurePick("0FZ", [7, 5, 6, 5])]] })),
	).toBe("1TU0FZ57");
});

test("copies merge whether they overlap, touch or arrive out of order", () => {
	expect(encodeLoadout(decodeLoadout("1TU0FZ03_0FZ25"))).toBe("1TU0FZ05");
	expect(encodeLoadout(decodeLoadout("1TU0FZ02_0FZ35"))).toBe("1TU0FZ05");
	expect(encodeLoadout(decodeLoadout("1TU0FZ59_0FZ02"))).toBe(
		"1TU0FZ02_0FZ59",
	);
	expect(decodeLoadout("1TU0FZ_0FZ").treasures).toEqual([[t("0FZ")]]);
});

// "0FZ18" sorts before "0FZ_0FZ9" because "1" (0x31) is below "_" (0x5F).
test("a slot with split runs still sorts to one code among unordered slots", () => {
	const split = treasurePick("0FZ", [0, 9]);
	const run = t("0FZ", 1, 8);
	const one = encodeLoadout(loadout({ treasures: [[split], [run]] }));
	const other = encodeLoadout(loadout({ treasures: [[run], [split]] }));

	expect(one).toBe(other);
	expect(one).toBe("1TU0FZ18.0FZ_0FZ9");
});

test("levelRuns reads a level set as its runs", () => {
	expect(levelRuns([0, 1, 2, 5, 6, 7, 8, 9])).toEqual([
		[0, 2],
		[5, 9],
	]);
	expect(levelRuns([9, 0, 0])).toEqual([
		[0, 0],
		[9, 9],
	]);
	expect(levelRuns([])).toEqual([]);
});
```

(add `levelRuns` to the file's import from `./loadout`).

Append to `describe.test.ts`:

```ts
test("a treasure's runs read with commas, so 'or' only separates treasures", () => {
	const rows = describeLoadout({
		...emptyLoadout(),
		treasures: [[treasurePick("000", [0, 1, 2, 5, 6, 7, 8, 9]), t("001", 3)]],
	});

	expect(rows[3]?.value).toMatch(/ \+0-2, \+5-9 or .+ \+3$/);
});
```

In `full-code.test.ts`, replace the sample's per-id pick with a random level set:

```ts
			slots.push(
				[...ids].map((id) => {
					const levels = levelRange(0, 9).filter(() => random(2) === 0);
					return treasurePick(id, levels.length > 0 ? levels : [random(10)]);
				}),
			);
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun run test src/routes/combi-name/loadout.test.ts src/routes/combi-name/describe.test.ts src/routes/combi-name/full-code.test.ts`
Expected: FAIL — `levelRange` / `levelRuns` are not exported from `./loadout`.

- [ ] **Step 5: Implement in `loadout.ts`**

Update the header comment example:

```ts
 *     1C2LR0BP1ZTU0FZ02_0FZ59_0RB3.0QQ9
 *     │└cookie      │ └ treasures: slot 1 accepts 0FZ at +0-2 or +5-9, or 0RB
 *     │  └relay     └pet            at +3; slot 2 wants 0QQ at +9
 *     └ this section's own version, independent of the combi section's
```

Replace `TreasurePick` and `treasurePick`:

```ts
/** One acceptable treasure, and the upgrade levels it is accepted at. */
export type TreasurePick = {
	id: string;
	/** Accepted levels, each 0 to `MAX_LEVEL`. Never empty. */
	levels: number[];
};
```

```ts
/** A pick at the given levels; +0 alone by default. */
export function treasurePick(
	id: string,
	levels: readonly number[] = [0],
): TreasurePick {
	return { id, levels: [...levels] };
}

/** Every level from `min` to `max`, inclusive; empty when `max` is below `min`. */
export function levelRange(min: number, max = min): number[] {
	const levels: number[] = [];
	for (let level = min; level <= max; level++) levels.push(level);
	return levels;
}

/**
 * A level set as its maximal runs of consecutive levels, lowest first —
 * `[0, 1, 2, 5]` is `[[0, 2], [5, 5]]`. Each run is one copy on the wire and
 * one `+min-max` in prose.
 */
export function levelRuns(levels: readonly number[]): [number, number][] {
	const runs: [number, number][] = [];
	for (const level of [...new Set(levels)].sort((a, b) => a - b)) {
		const last = runs.at(-1);
		if (last !== undefined && level === last[1] + 1) last[1] = level;
		else runs.push([level, level]);
	}
	return runs;
}
```

Replace `writePick`, `readPick` and `checkLevel` with:

```ts
/**
 * One copy of the id per run of levels, lowest first: the bare id for a run of
 * only +0, one digit for a one-level run, two for a longer one.
 */
function writePick({ id, levels }: TreasurePick): string {
	return levelRuns(levels)
		.map(([min, max]) => {
			if (min !== max) return `${id}${min}${max}`;
			return min === 0 ? id : `${id}${min}`;
		})
		.join(ALTERNATIVE_SEPARATOR);
}

/** One copy off the wire: its id and the run of levels its digits name. */
function readCopy(text: string): TreasurePick {
	const id = text.slice(0, TREASURE_WIDTH);
	const level = text.slice(TREASURE_WIDTH);
	if (!/^[0-9]{0,2}$/.test(level)) {
		fail("T", `"${text}" has level "${level}", expected at most two digits`);
	}
	const min = level.length === 0 ? 0 : Number(level[0]);
	const max = level.length === 2 ? Number(level[1]) : min;
	if (min > max) fail("T", `"${id}" level runs backwards, ${min}-${max}`);
	return treasurePick(id, levelRange(min, max));
}

/**
 * Every copy of one id in a slot merges into one pick, so a code that splits a
 * treasure's levels — or overlaps them, written by hand — reads as the one
 * treasure it names. First appearance keeps each pick's place.
 */
function readSlot(text: string): TreasurePick[] {
	if (text === "") return [];
	const merged = new Map<string, number[]>();
	for (const copy of text.split(ALTERNATIVE_SEPARATOR).map(readCopy)) {
		merged.set(copy.id, [...(merged.get(copy.id) ?? []), ...copy.levels]);
	}
	return [...merged].map(([id, levels]) =>
		treasurePick(
			id,
			[...new Set(levels)].sort((a, b) => a - b),
		),
	);
}

function checkLevels({ id, levels }: TreasurePick): void {
	if (levels.length === 0) fail("T", `"${id}" accepts no level`);
	for (const level of levels) {
		if (!Number.isInteger(level) || level < 0 || level > MAX_LEVEL) {
			fail("T", `"${id}" level ${level} is outside 0-${MAX_LEVEL}`);
		}
	}
}
```

Note `readCopy` on a too-short text (`"00"`) yields `level === ""`, so the existing `"00" is not 3 characters` message from `checkId` survives. `readSlot("")` returns `[]`, so the existing `slot 2 is empty` message survives.

In `checkTreasures`, replace `checkLevel(pick);` with `checkLevels(pick);`.

In `encodeLoadout`, the `key` stays `slot.map(writePick).join(ALTERNATIVE_SEPARATOR)` — `writePick` now returns a pick's copies already joined. Update the comment above it to say "levels and all" still holds for split picks. `byId` is unchanged.

In `decodeLoadout`, the slot split becomes:

```ts
		loadout.treasures = rest.slice(1).split(SLOT_SEPARATOR).map(readSlot);
```

- [ ] **Step 6: Implement in `describe.ts`**

Import `levelRuns` from `./loadout` and replace `levelText`:

```ts
/** Runs joined by commas: " or " is what separates two treasures. */
function levelText({ levels }: TreasurePick): string {
	return levelRuns(levels)
		.map(([min, max]) => (min === max ? `+${min}` : `+${min}-${max}`))
		.join(", ");
}
```

- [ ] **Step 7: Stopgap in `index.ts`**

`<entry-tiles>` still reports `[min, max]` until Task 6/7. Import `levelRange`; in `readLoadout`:

```ts
				return slot.selected.map((id) => {
					const [min, max] = levels[id] ?? [0, 0];
					return treasurePick(id, levelRange(min, max));
				});
```

and in `writeLoadout`:

```ts
		slot.levels = Object.fromEntries(
			carried.map((pick) => [
				pick.id,
				[pick.levels[0] ?? 0, pick.levels.at(-1) ?? 0] as const,
			]),
		);
```

(lossy on purpose — Task 7 replaces both).

- [ ] **Step 8: Run tests and checks**

Run: `bun run test && bun run check`
Expected: all PASS. If Biome reformats, run `bun run check:biome --write` and re-run.

- [ ] **Step 9: Commit**

```bash
git add src/routes/combi-name
git commit -m "feat: let a treasure accept any set of levels

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Level buttons on each pick row of `<entry-tiles>`

**Files:**
- Modify: `src/components/entry-tiles.ts`
- Modify: `tests/happydom.ts` (restore to the three lines it had on `main`)
- Modify: `package.json`, `bun.lock` (drop the direct `happy-dom` devDependency)
- Modify: `.claude/skills/ui-components/SKILL.md` (only: delete the paragraph about the happy-dom `<select>` shim — the rest of that skill is Task 8)
- Test: `src/components/entry-tiles.test.ts`

**Interfaces:**
- Consumes: nothing from Task 5 (a component never imports a route).
- Produces:
  - `export type Levels = readonly number[]` (replaces `Level`)
  - `EntryTiles.levels: Readonly<Record<string, Levels>>` — getter returns one ascending entry per selected value (default `[0]`), none for anything else; setter keeps entries only for selected values with at least one level, stored ascending and distinct.
  - Each pick row is `li.chip[data-value="<id>"]` holding `div.levels[role="group"]` with ten `button.level[data-level="<n>"]`, text `+n`, `aria-pressed`. A toggle dispatches one bubbling `input` on the host.

- [ ] **Step 1: Replace the select tests with button tests**

In `src/components/entry-tiles.test.ts`, delete the `levelSelects` and `setLevel` helpers and every test that uses them. Append:

```ts
function levelButtons(element: EntryTiles, value: string): HTMLButtonElement[] {
	const row = [
		...(element.shadowRoot?.querySelectorAll<HTMLElement>(".chip") ?? []),
	].find((chip) => chip.getAttribute("data-value") === value);
	return [...(row?.querySelectorAll<HTMLButtonElement>("button.level") ?? [])];
}

function pressed(element: EntryTiles, value: string): number[] {
	return levelButtons(element, value)
		.filter((button) => button.getAttribute("aria-pressed") === "true")
		.map((button) => Number(button.getAttribute("data-level")));
}

async function press(
	element: EntryTiles,
	value: string,
	level: number,
): Promise<void> {
	levelButtons(element, value)[level]?.click();
	await element.updateComplete;
}

test("each pick has ten level buttons, +0 through +9, with only +0 pressed", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	await element.updateComplete;

	expect(
		levelButtons(element, "001").map((button) => button.textContent?.trim()),
	).toEqual(["+0", "+1", "+2", "+3", "+4", "+5", "+6", "+7", "+8", "+9"]);
	expect(pressed(element, "001")).toEqual([0]);
	const group = element.shadowRoot?.querySelector(
		'.chip[data-value="001"] .levels',
	);
	expect(group?.getAttribute("role")).toBe("group");
	expect(group?.getAttribute("aria-label")).toBe("Always Cute Acorn levels");
	expect(element.levels).toEqual({ "001": [0], "002": [0] });
});

test("the levels setter shows on the buttons and keeps only selected values", async () => {
	const element = await mount();
	element.selected = ["001"];
	element.levels = { "001": [9, 0, 2, 1, 5, 5], "003": [9] };
	await element.updateComplete;

	expect(pressed(element, "001")).toEqual([0, 1, 2, 5, 9]);
	expect(element.levels).toEqual({ "001": [0, 1, 2, 5, 9] });
});

test("pressing a level toggles it and dispatches one input each time", async () => {
	const element = await mount();
	element.selected = ["001"];
	await element.updateComplete;

	let inputs = 0;
	const count = (): void => {
		inputs++;
	};
	element.addEventListener("input", count);

	await press(element, "001", 9);
	expect(element.levels).toEqual({ "001": [0, 9] });
	expect(inputs).toBe(1);

	await press(element, "001", 0);
	expect(element.levels).toEqual({ "001": [9] });
	expect(inputs).toBe(2);

	element.removeEventListener("input", count);
});

test("the last pressed level cannot be released", async () => {
	const element = await mount();
	element.selected = ["001"];
	await element.updateComplete;

	let inputs = 0;
	const count = (): void => {
		inputs++;
	};
	element.addEventListener("input", count);

	expect(levelButtons(element, "001")[0]?.getAttribute("aria-disabled")).toBe(
		"true",
	);
	await press(element, "001", 0);
	expect(element.levels).toEqual({ "001": [0] });
	expect(inputs).toBe(0);

	await press(element, "001", 3);
	expect(levelButtons(element, "001")[0]?.hasAttribute("aria-disabled")).toBe(
		false,
	);

	element.removeEventListener("input", count);
});

test("dropping one pick keeps the other's levels", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "001": [1], "002": [4, 5, 6, 7, 8, 9] };
	await element.updateComplete;

	element.shadowRoot
		?.querySelector<HTMLButtonElement>('.chip[data-value="001"] button.remove')
		?.click();
	await element.updateComplete;

	expect(element.selected).toEqual(["002"]);
	expect(element.levels).toEqual({ "002": [4, 5, 6, 7, 8, 9] });
});

test("Done keeps the levels of picks that stay, and a re-added pick starts at +0", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "001": [6], "002": [9] };
	await element.updateComplete;

	tile(element).click();
	await element.updateComplete;
	entries(element).find((cell) => cell.value === "002")?.click();
	entries(element).find((cell) => cell.value === "003")?.click();
	await element.updateComplete;
	done(element).click();
	await element.updateComplete;
	expect(element.levels).toEqual({ "001": [6], "003": [0] });

	tile(element).click();
	await element.updateComplete;
	entries(element).find((cell) => cell.value === "002")?.click();
	await element.updateComplete;
	done(element).click();
	await element.updateComplete;
	expect(element.levels["002"]).toEqual([0]);
});

test("toggling one pick's level leaves the other pick's buttons alone", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "002": [3, 4] };
	await element.updateComplete;

	await press(element, "001", 7);

	expect(pressed(element, "001")).toEqual([0, 7]);
	expect(pressed(element, "002")).toEqual([3, 4]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/entry-tiles.test.ts`
Expected: FAIL — no `button.level` in the rows (`pressed` returns `[]`).

- [ ] **Step 3: Implement in `entry-tiles.ts`**

- Remove the `live` import, the `Level` type, `#levelSelect`, `#setLevel`, and the `.levels select` / `.levels .to` CSS.
- Replace the level declarations near the top with:

```ts
/** The levels a pick accepts, ascending: each +0 to +9, never none. */
export type Levels = readonly number[];

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const UNUPGRADED: Levels = [0];
```

- Retype `leveled` as `ReadonlyMap<string, Levels>` and update its doc comment ("Each pick's levels…"). `#prune` is unchanged.
- The getter's type becomes `Readonly<Record<string, Levels>>` (body unchanged). The setter becomes:

```ts
	set levels(levels: Readonly<Record<string, Levels>>) {
		this.leveled = new Map(
			Object.entries(levels)
				.filter(([value, set]) => this.chosen.has(value) && set.length > 0)
				.map(([value, set]) => [
					value,
					[...new Set(set)].sort((a, b) => a - b),
				]),
		);
	}
```

- Add, where `#setLevel` was:

```ts
	/**
	 * A treasure accepts at least one level, so the last one pressed stays
	 * pressed: releasing it would leave a pick that fits no run at all.
	 */
	#toggleLevel(value: string, level: number): void {
		const current = this.leveled.get(value) ?? UNUPGRADED;
		const on = current.includes(level);
		if (on && current.length === 1) return;
		const next = on
			? current.filter((held) => held !== level)
			: [...current, level].sort((a, b) => a - b);
		this.leveled = new Map(this.leveled).set(value, next);
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}
```

- Add, where `#levelSelect` was:

```ts
	#levelButtons(value: string, name: string, levels: Levels) {
		return html`<div class="levels" role="group" aria-label=${`${name} levels`}>
			${LEVELS.map((level) => {
				const on = levels.includes(level);
				return html`<button
					type="button"
					class="level"
					data-level=${level}
					aria-pressed=${String(on)}
					aria-disabled=${ifDefined(on && levels.length === 1 ? "true" : undefined)}
					@click=${() => {
						this.#toggleLevel(value, level);
					}}
				>
					+${level}
				</button>`;
			})}
		</div>`;
	}
```

- In `render`'s pick row, read `const levels = this.leveled.get(value) ?? UNUPGRADED;` in place of `[min, max]`, drop the `<span class="levels">…</span>` holding the two selects, and put `${this.#levelButtons(value, name, levels)}` after the remove button (last child of the `li`), so art, name and ✕ keep the first line.
- CSS, replacing the old `.levels` rules:

```css
			/* The row wraps so the level buttons take a line of their own under
			   the name and ✕. At 400px ten buttons at the coarse-pointer tap size
			   do not fit on one line, and a wrap beats shrinking the target. */
			.chip {
				flex-wrap: wrap;
			}

			.levels {
				display: flex;
				flex: 1 0 100%;
				flex-wrap: wrap;
				gap: 0.15rem;
				padding-bottom: var(--cr-space-1);
			}

			.levels button {
				min-width: 2rem;
				padding: 0 var(--cr-space-1);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
			}

			.levels button[aria-pressed="true"] {
				border-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
				font-weight: 600;
			}
```

(`.chip` already has a rule — add `flex-wrap: wrap;` to it rather than a second `.chip` block.)

- [ ] **Step 4: Retire the `<select>` shim**

Restore `tests/happydom.ts` to exactly:

```ts
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();
```

Remove `"happy-dom": "20.14.3",` from `package.json` devDependencies, run `bun install`, and confirm `git diff bun.lock` only removes that one workspace devDependency line (if anything else changes, stop and report). Confirm `bun install --frozen-lockfile` succeeds.

In `.claude/skills/ui-components/SKILL.md`, delete the paragraph about happy-dom 20's `<select>` and the `tests/happydom.ts` shim.

- [ ] **Step 5: Run tests and checks**

Run: `bun run test src/components/entry-tiles.test.ts && bun run test && bun run check`
Expected: PASS. (Route tests that read `select.level-*` belong to Task 7; if any fail here, they are the three `index.test.ts` level tests — leave them for Task 7 and say so in the report.)

- [ ] **Step 6: Commit**

```bash
git add src/components tests/happydom.ts package.json bun.lock .claude/skills/ui-components/SKILL.md
git commit -m "feat: toggle each level of a treasure on its own

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Wire level sets between the slots and the code

**Files:**
- Modify: `src/routes/combi-name/index.ts` (`readLoadout`, `writeLoadout`)
- Test: `src/routes/combi-name/index.test.ts`

**Interfaces:**
- Consumes: `treasurePick(id, levels)`, `TreasurePick` from Task 5; `EntryTiles.levels` (`Record<string, Levels>`), `button.level[data-level]` from Task 6.

- [ ] **Step 1: Replace the select-based route tests**

In `index.test.ts`, delete the `levelOf` helper and its three tests ("a code's treasure levels land on the selects", "changing a level rewrites the code", "a code with a backwards level range changes nothing"). Append:

```ts
function levelsOf(slotId: string, treasure: string): string[] {
	const row = inside(need(slotId)).querySelector<HTMLElement>(
		`.chip[data-value="${treasure}"]`,
	);
	if (row === null) throw new Error(`no row for ${treasure}`);
	return [
		...row.querySelectorAll<HTMLButtonElement>(
			'button.level[aria-pressed="true"]',
		),
	].map((button) => button.getAttribute("data-level") ?? "");
}

test("a code's treasure levels land on the level buttons", async () => {
	await typeCode("1TU0FZ02_0FZ59_0RB58.0QQ9-1S00000000");

	expect(levelsOf("treasure1", "0FZ")).toEqual([
		"0", "1", "2", "5", "6", "7", "8", "9",
	]);
	expect(levelsOf("treasure1", "0RB")).toEqual(["5", "6", "7", "8"]);
	expect(levelsOf("treasure2", "0QQ")).toEqual(["9"]);
	await reset();
});

test("toggling a level rewrites the code", async () => {
	await typeCode("1TU0FZ-1S00000000");
	(codeBar as HTMLElement & { editing: boolean }).editing = false;
	await settle();

	inside(need("treasure1"))
		.querySelector<HTMLButtonElement>(
			'.chip[data-value="0FZ"] button.level[data-level="9"]',
		)
		?.click();
	await settle();

	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1TU0FZ_0FZ9-1S00000000",
	);
	await reset();
});

// A reversed copy does not decode, and a code that does not decode leaves the
// controls exactly where they were.
test("a code with a backwards level range changes nothing", async () => {
	await typeCode("1TU0FZ9-1S00000000");
	await typeCode("1TU0FZ95-1S00000000");

	expect(levelsOf("treasure1", "0FZ")).toEqual(["9"]);
	await reset();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/routes/combi-name/index.test.ts -t "level"`
Expected: FAIL — the Task 5 stopgap collapses `0FZ02_0FZ59` to one range, so `levelsOf("treasure1", "0FZ")` reads all ten.

- [ ] **Step 3: Implement**

In `index.ts`, `readLoadout`'s slot map becomes:

```ts
			.map((slot) => {
				const { levels } = slot;
				return slot.selected.map((id) => treasurePick(id, levels[id] ?? [0]));
			})
```

and `writeLoadout`'s levels write becomes:

```ts
		slot.levels = Object.fromEntries(
			carried.map((pick) => [pick.id, pick.levels]),
		);
```

Drop the `levelRange` import if nothing else in the file uses it.

- [ ] **Step 4: Run tests and checks**

Run: `bun run test && bun run check`
Expected: all PASS.

- [ ] **Step 5: Check it in the browser**

Run `bun run dev`, open `http://localhost:3000/combi-name/#1TU0FZ02_0FZ59_0RB3-1S00000000`. Confirm: 0FZ shows +0,+1,+2,+5…+9 pressed; 0RB shows +3; toggling +3 on 0FZ rewrites the code to `1TU0FZ03_0FZ59_0RB3-…`; the last pressed button won't release; at 400px width the buttons wrap within the row and nothing overflows the chip; the code bar tooltip on the `T` group reads `… +0-2, +5-9 or … +3`. Stop the dev server afterwards.

- [ ] **Step 6: Commit**

```bash
git add src/routes/combi-name/index.ts src/routes/combi-name/index.test.ts
git commit -m "feat: write treasure level sets into the code and read them back

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Document level sets

**Files:**
- Modify: `README.md` (loadout section)
- Modify: `.claude/skills/combi-codec/SKILL.md` ("The loadout section")
- Modify: `.claude/skills/ui-components/SKILL.md` (`<entry-tiles>` row paragraph)

- [ ] **Step 1: README**

- `T` row of the loadout table: end it with "…joined by `_`, and each id may be followed by a level — a treasure whose levels are not one run is listed once per run".
- Rewrite the "Treasure levels" subsection to say: a treasure is upgraded from +0 to +9 and each treasure in a slot says which levels it is accepted at; the level follows the id with no separator; then this table:

```markdown
| Written | Levels |
| --- | --- |
| `0FZ` | +0, not upgraded |
| `0FZ5` | +5 |
| `0FZ58` | +5 to +8 |
| `0FZ09` | +0 to +9, any level |
| `0FZ9` | +9 |
| `0FZ02_0FZ59` | +0 to +2, and +5 to +9 |
| `0FZ_0FZ9` | +0 and +9 |
```

followed by: no digits means +0, which is how every code written before levels existed reads; a treasure whose levels are not one run repeats its id once per run, lowest first; encoding writes the shortest form (runs merged, a one-level run as one digit, +0 as nothing); a backwards range like `95` is rejected.

- Rewrite the repeated-id paragraph (currently "An id must not repeat within one treasure slot — `TU0FZ_0FZ` is invalid…"): within one slot an id repeats only to list another run of its levels, and reading a code merges every copy of an id in a slot into one treasure — so `TU0FZ_0FZ` is simply 0FZ at +0, and `TU0FZ03_0FZ25` is 0FZ at +0-5. The same id may also repeat across two different slots: that is how overlapping alternatives are written.
- Replace the levelled example line with:

```
1TU0FZ02_0FZ59_0RB3.0QQ9-1S00000000 slot 1: 0FZ at +0-2 or +5-9, or 0RB at +3; slot 2: 0QQ at +9
```

(align the comment column with the other lines in that block).

- [ ] **Step 2: combi-codec skill**

Replace the treasure-levels sentences appended to the "Encoding a loadout always writes its canonical form" paragraph with:

```markdown
Each treasure id may be followed by a level: nothing for +0, one digit for one level, two for a run `min` then `max`. `Loadout.treasures` holds `TreasurePick { id, levels }` for it, built with `treasurePick`, where `levels` is a set — any levels at all, never none. A set that is not one run goes on the wire as one copy of the id per run (`levelRuns` finds them), lowest first, so `0FZ02_0FZ59` is 0FZ at +0-2 or +5-9. Decoding merges every copy of an id in a slot back into one pick, overlapping or not; encoding rejects a slot that lists an id twice, since a `Loadout` holds each treasure once per slot. Canonical form writes maximal runs, +0 as nothing and a one-level run as one digit; within a slot picks still sort by id alone, while unordered slots sort by their whole written string, levels included. No digits reading as +0 is what keeps every earlier code meaning what it did, which is why `LOADOUT_VERSION` stayed `1`. On the page, `<entry-tiles>`'s `levels` property carries the sets beside `selected`, and `writeLoadout` writes options, then picks, then levels, since each write prunes against the one before.
```

- [ ] **Step 3: ui-components skill**

In the `<entry-tiles>` row paragraph, replace the description of the two level selects and their clamping with: each row's art, name and remove button share its first line, and under them a group of ten buttons, +0 to +9, labelled "<name> levels", each toggling one level with `aria-pressed`; the row wraps because ten buttons at `--cr-tap` do not fit a 400px line; the last pressed button carries `aria-disabled` and ignores a press, since a treasure has to accept at least one level. Keep the sentences on a level leaving with its pick and on `levels` (now "defaulting to `[0]`", and entries ascending). The contract table row (`options`, `selected`, `levels`) needs no change.

- [ ] **Step 4: Verify and commit**

Run: `bun run check && bun run test`
Expected: PASS.

```bash
git add README.md .claude/skills/combi-codec/SKILL.md .claude/skills/ui-components/SKILL.md
git commit -m "docs: describe treasure level sets

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
