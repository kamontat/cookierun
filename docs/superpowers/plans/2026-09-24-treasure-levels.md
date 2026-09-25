> Superseded by `docs/superpowers/plans/2026-09-25-treasure-level-sets.md` where they differ: the from/to selects and `{ id, min, max }` here were replaced by level sets.

# Treasure Upgrade Levels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let each treasure in a loadout carry an upgrade level (+0 to +9), either one level or a range, on the wire and in the page.

**Architecture:** The loadout grammar in `loadout.ts` gains an optional 0-2 digit suffix after each 3-character treasure id; `Loadout.treasures` becomes `TreasurePick[][]`. `describe.ts` prints the level. `<entry-tiles>` gains a `levels` property and two `<select>`s per pick row; `index.ts` zips `selected` and `levels` into picks and back.

**Tech Stack:** Bun (`bun test`, happy-dom preloaded), TypeScript, Lit, Biome.

**Spec:** `docs/superpowers/specs/2026-09-24-treasure-levels-design.md`

## Global Constraints

- No digits after a treasure id means +0. `LOADOUT_VERSION` stays `"1"`.
- Levels are integers 0-9 inclusive, `min <= max`.
- Canonical: `min === max === 0` writes nothing; `min === max` writes one digit; otherwise two digits `min` then `max`.
- Ids are sorted within a slot by id alone; unordered slots sort by their whole written string, levels included.
- Level text reads `+N` or `+min-max`, always shown, +0 included.
- Imports carry no file extension (except `lit/decorators.js`, `lit/directives/*.js`). Cross-directory imports use `#lib/*` / `#components/*`. `src/components/` never imports from `src/routes/`.
- Read the `combi-codec` skill before touching `src/routes/combi-name/`, and `ui-components` before `src/components/`.
- Commands: `bun run test <file>`, `bun run check` (tsc + biome). Commits end with `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.

## Review Focus

- A code written before this change (`1TU0FZ_0RB.0QQ`) decodes to +0 everywhere and re-encodes byte-identical. → Task 1, "codes without levels read as +0 and keep their code".
- Removing one alternative with ✕ keeps the other alternative's level. → Task 2, "dropping one pick keeps the other's level".
- Reopening the picker and adding a pick keeps existing picks' levels; a pick removed and re-added starts at +0. → Task 2, "Done keeps the levels of picks that stay, and a re-added pick starts at +0".
- A half-typed or reversed level in the code bar (`0FZ95`) leaves the selects untouched rather than half-applying. → Task 3, "a code with a backwards level range changes nothing".
- Two unordered slots holding the same id at different levels produce one code whichever order they arrive in. → Task 1, "slots differing only in level still sort to one code".

---

### Task 1: Level suffix in the loadout grammar, and its prose

**Files:**
- Modify: `src/routes/combi-name/loadout.ts`
- Modify: `src/routes/combi-name/describe.ts:110-112`
- Modify: `src/routes/combi-name/index.ts:135-192` (stopgap: ids only, levels land in Task 3)
- Test: `src/routes/combi-name/loadout.test.ts`, `src/routes/combi-name/full-code.test.ts`, `src/routes/combi-name/describe.test.ts`

**Interfaces:**
- Produces (from `loadout.ts`):
  - `export type TreasurePick = { id: string; min: number; max: number }`
  - `export const MAX_LEVEL = 9`
  - `export function treasurePick(id: string, min = 0, max = min): TreasurePick`
  - `Loadout.treasures: TreasurePick[][]`
- Produces (from `describe.ts`): treasure row value like `"Always Cute Acorn +0 or Chewy Cheese Ball +5-9; …"`.

- [ ] **Step 1: Update existing fixtures to the new type**

In `loadout.test.ts`, `full-code.test.ts` and `describe.test.ts`, import `treasurePick` from `./loadout` and wrap every treasure id in a fixture: `[["000"]]` becomes `[[treasurePick("000")]]`, `[["0RB", "0FZ"]]` becomes `[[treasurePick("0RB"), treasurePick("0FZ")]]`, and every `toEqual([["0QQ"], ["000"]])`-style expectation likewise. Add a local shorthand at the top of each test file:

```ts
const t = treasurePick;
```

so fixtures read `[[t("0RB"), t("0FZ")]]`. Encoded strings in expectations do not change — every existing fixture is +0.

Specific spots:
- `loadout.test.ts:45` — `[["___"]]` becomes `[[t("___")]]`.
- `loadout.test.ts:109-116` — the `decodeLoadout("1C00R01P02TO0QQ.000_0RB")` expectation becomes `treasures: [[t("0QQ")], [t("000"), t("0RB")]]`.
- `full-code.test.ts:104-112` — the sample builds `const slots: TreasurePick[][] = []` and pushes `[...ids].map((id) => t(id))` for now (Step 3 adds random levels).

- [ ] **Step 2: Write the failing tests for levels**

Append to `src/routes/combi-name/loadout.test.ts`:

```ts
test("a level is written after its id: none for +0, one digit, or a range", () => {
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ")]] }))).toBe("1TU0FZ");
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 5)]] }))).toBe(
		"1TU0FZ5",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 5, 8)]] }))).toBe(
		"1TU0FZ58",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 0, 9)]] }))).toBe(
		"1TU0FZ09",
	);
	expect(encodeLoadout(loadout({ treasures: [[t("0FZ", 9)]] }))).toBe(
		"1TU0FZ9",
	);
});

test("each alternative carries its own level", () => {
	const code = encodeLoadout(
		loadout({ treasures: [[t("0RB", 5, 9), t("0FZ")], [t("0QQ", 9)]] }),
	);

	expect(code).toBe("1TU0FZ_0RB59.0QQ9");
	expect(decodeLoadout(code).treasures).toEqual([
		[t("0FZ"), t("0RB", 5, 9)],
		[t("0QQ", 9)],
	]);
});

// Every code written before levels existed must keep its meaning and its code.
test("codes without levels read as +0 and keep their code", () => {
	const decoded = decodeLoadout("1TU0FZ_0RB.0QQ");

	expect(decoded.treasures).toEqual([[t("0FZ"), t("0RB")], [t("0QQ")]]);
	expect(encodeLoadout(decoded)).toBe("1TU0FZ_0RB.0QQ");
});

test("a non-canonical level decodes and re-encodes short", () => {
	expect(encodeLoadout(decodeLoadout("1TU0FZ00"))).toBe("1TU0FZ");
	expect(encodeLoadout(decodeLoadout("1TU0FZ0"))).toBe("1TU0FZ");
	expect(encodeLoadout(decodeLoadout("1TU0FZ55"))).toBe("1TU0FZ5");
});

// Same ids, different levels: two different slots, which must not tie in the
// sort or one build would have two codes.
test("slots differing only in level still sort to one code", () => {
	const one = encodeLoadout(
		loadout({ treasures: [[t("0FZ", 3)], [t("0FZ", 1)]] }),
	);
	const other = encodeLoadout(
		loadout({ treasures: [[t("0FZ", 1)], [t("0FZ", 3)]] }),
	);

	expect(one).toBe(other);
	expect(one).toBe("1TU0FZ1.0FZ3");
});

test("a malformed level is rejected", () => {
	expect(() => decodeLoadout("1TU0FZ123")).toThrow(
		'loadout group "T": "0FZ123" has level "123", expected at most two digits',
	);
	expect(() => decodeLoadout("1TU0FZX")).toThrow(
		'loadout group "T": "0FZX" has level "X", expected at most two digits',
	);
	expect(() => decodeLoadout("1TU0FZ95")).toThrow(
		'loadout group "T": "0FZ" level runs backwards, 9-5',
	);
});

test("encoding validates levels the same way", () => {
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 9, 5)]] })),
	).toThrow('loadout group "T": "0FZ" level runs backwards, 9-5');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 0, 10)]] })),
	).toThrow('loadout group "T": "0FZ" level 0-10 is outside 0-9');
	expect(() =>
		encodeLoadout(loadout({ treasures: [[t("0FZ", 1.5)]] })),
	).toThrow('loadout group "T": "0FZ" level 1.5-1.5 is outside 0-9');
});

test("a repeated id is rejected whatever levels the two copies carry", () => {
	expect(() => decodeLoadout("1TU0FZ1_0FZ2")).toThrow(
		'loadout group "T": slot 1 lists "0FZ" twice',
	);
});
```

Append to `src/routes/combi-name/describe.test.ts`:

```ts
test("each treasure reads with its level, +0 included", () => {
	const rows = describeLoadout({
		...emptyLoadout(),
		treasures: [[t("000"), t("001", 5, 9)], [t("002", 9)]],
	});

	const value = rows[3]?.value ?? "";
	const [first, second] = value.split("; ");
	expect(first).toMatch(/ \+0 or .+ \+5-9$/);
	expect(second).toMatch(/ \+9$/);
});
```

- [ ] **Step 3: Draw random levels in the seeded sample**

In `full-code.test.ts`, inside the sample loop, replace the slot push with:

```ts
			slots.push(
				[...ids].map((id) => {
					const min = random(10);
					return t(id, min, min + random(10 - min));
				}),
			);
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `bun run test src/routes/combi-name/loadout.test.ts src/routes/combi-name/describe.test.ts src/routes/combi-name/full-code.test.ts`
Expected: FAIL — `treasurePick` is not exported from `./loadout`.

- [ ] **Step 5: Implement in `loadout.ts`**

Update the file's header comment example to show a level:

```ts
 *     1C2LR0BP1ZTU0FZ_0RB59.0QQ9
 *     │└cookie      │ └ treasures: slot 1 accepts 0FZ at +0 or 0RB at +5-9,
 *     │  └relay     └pet            slot 2 wants 0QQ at +9
 *     └ this section's own version, independent of the combi section's
```

Replace the `Loadout.treasures` field and add the pick type above `Loadout`:

```ts
/** One acceptable treasure, and the upgrade levels it is accepted at. */
export type TreasurePick = {
	id: string;
	/** 0 to `MAX_LEVEL`, inclusive. */
	min: number;
	/** 0 to `MAX_LEVEL`, inclusive, never below `min`. */
	max: number;
};
```

```ts
	/** 0-3 slots, each holding one or more acceptable treasures. */
	treasures: TreasurePick[][];
```

Below `MAX_TREASURE_SLOTS`:

```ts
/** A treasure runs from +0, not upgraded, to +9. */
export const MAX_LEVEL = 9;

/** A pick at one level, or a range when `max` is given. +0 by default. */
export function treasurePick(id: string, min = 0, max = min): TreasurePick {
	return { id, min, max };
}
```

Below `ALTERNATIVE_SEPARATOR`:

```ts
/** The level suffix: nothing for +0, one digit for one level, two for a range. */
function writePick({ id, min, max }: TreasurePick): string {
	if (min !== max) return `${id}${min}${max}`;
	return min === 0 ? id : `${id}${min}`;
}

/** Shape only; the range itself is checked with the rest of the slot. */
function readPick(text: string): TreasurePick {
	const id = text.slice(0, TREASURE_WIDTH);
	const level = text.slice(TREASURE_WIDTH);
	if (!/^[0-9]{0,2}$/.test(level)) {
		fail(
			"T",
			`"${text}" has level "${level}", expected at most two digits`,
		);
	}
	const min = level.length === 0 ? 0 : Number(level[0]);
	const max = level.length === 2 ? Number(level[1]) : min;
	return { id, min, max };
}

function checkLevel({ id, min, max }: TreasurePick): void {
	const inRange = (n: number): boolean =>
		Number.isInteger(n) && n >= 0 && n <= MAX_LEVEL;
	if (!inRange(min) || !inRange(max)) {
		fail("T", `"${id}" level ${min}-${max} is outside 0-${MAX_LEVEL}`);
	}
	if (min > max) fail("T", `"${id}" level runs backwards, ${min}-${max}`);
}
```

Note: `readPick` must not throw for an id of the wrong width — `"00"` has to reach `checkId` so the existing `"00" is not 3 characters` message survives. It doesn't: a 2-character text gives `level === ""`.

Change `checkTreasures`'s signature to `(slots: TreasurePick[][])` and its inner loop to:

```ts
		for (const pick of slot) {
			checkId("T", "treasures", "treasure", TREASURE_WIDTH, pick.id);
			checkLevel(pick);
			if (seen.has(pick.id)) {
				fail("T", `slot ${position + 1} lists "${pick.id}" twice`);
			}
			seen.add(pick.id);
		}
```

In `encodeLoadout`, replace the slot sort and key:

```ts
	const byId = (a: TreasurePick, b: TreasurePick): number =>
		a.id === b.id ? 0 : a.id < b.id ? -1 : 1;
	const slots = loadout.treasures.map((slot) => [...slot].sort(byId));
	const ordered = slots.length > 1 && loadout.ordered;
	// Fixed-width uppercase base-36 sorts lexicographically in numeric order, so
	// comparing slots as strings is comparing their ids. It has to be the whole
	// slot, levels and all: two slots sharing their smallest id — or holding the
	// same ids at different levels — would otherwise tie, and a tie leaves the
	// caller's order in place — one build with two codes.
	const key = (slot: TreasurePick[]): string =>
		slot.map(writePick).join(ALTERNATIVE_SEPARATOR);
```

and the return:

```ts
	return `${out}T${ordered ? "O" : "U"}${arranged.map(key).join(SLOT_SEPARATOR)}`;
```

In `decodeLoadout`, the slot split becomes:

```ts
			.map((slot) =>
				slot === "" ? [] : slot.split(ALTERNATIVE_SEPARATOR).map(readPick),
			);
```

- [ ] **Step 6: Implement in `describe.ts`**

Import `TreasurePick` alongside `Loadout` from `./loadout`, and replace `slotName`:

```ts
function levelText({ min, max }: TreasurePick): string {
	return min === max ? `+${min}` : `+${min}-${max}`;
}

function slotName(slot: TreasurePick[]): string {
	return slot
		.map((pick) => `${entryName("treasures", pick.id)} ${levelText(pick)}`)
		.join(" or ");
}
```

- [ ] **Step 7: Stopgap in `index.ts` so the page keeps working**

Import `treasurePick` from `./loadout`. In `readLoadout`:

```ts
		treasures: treasureSlots
			.map((slot) => slot.selected.map((id) => treasurePick(id)))
			.filter((slot) => slot.length > 0),
```

In `writeLoadout`:

```ts
	treasureSlots.forEach((slot, index) => {
		const carried = (loadout.treasures[index] ?? []).map((pick) => pick.id);
		// Options before the picks: the two are separate writes, and a slot
		// prunes a pick its current options do not hold.
		slot.options = treasureOptions(carried);
		slot.selected = carried;
	});
```

- [ ] **Step 8: Run tests and checks**

Run: `bun run test && bun run check`
Expected: all PASS; tsc and biome clean. (If biome reformats, run `bun run check:biome --write` and re-run.)

- [ ] **Step 9: Commit**

```bash
git add src/routes/combi-name
git commit -m "feat: carry a level after each treasure in the loadout

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Level selects on each pick row of `<entry-tiles>`

**Files:**
- Modify: `src/components/entry-tiles.ts`
- Test: `src/components/entry-tiles.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 (a component never imports a route).
- Produces:
  - `export type Level = readonly [min: number, max: number]`
  - `EntryTiles.levels: Readonly<Record<string, Level>>` — getter returns one entry per value in `selected` (default `[0, 0]`), none for anything else; setter keeps entries only for values currently selected.
  - Each pick row renders `select.level-min` and `select.level-max`, options `+0`…`+9` with values `"0"`…`"9"`. A change dispatches one bubbling `input` on the host; the selects' own `input`/`change` events are stopped inside the shadow root.

- [ ] **Step 1: Write the failing tests**

Append to `src/components/entry-tiles.test.ts` (helpers `mount`, `tile`, `done`, `entries` already exist in the file):

```ts
function levelSelects(
	element: EntryTiles,
	value: string,
): [HTMLSelectElement, HTMLSelectElement] {
	const row = [
		...(element.shadowRoot?.querySelectorAll<HTMLElement>(".chip") ?? []),
	].find((chip) => chip.dataset.value === value);
	const min = row?.querySelector<HTMLSelectElement>("select.level-min");
	const max = row?.querySelector<HTMLSelectElement>("select.level-max");
	if (!min || !max) throw new Error(`no level selects for ${value}`);
	return [min, max];
}

async function setLevel(
	element: EntryTiles,
	select: HTMLSelectElement,
	to: number,
): Promise<void> {
	select.value = String(to);
	select.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
	await element.updateComplete;
}

test("each pick has a from and a to select, +0 through +9, starting at +0", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	await element.updateComplete;

	const [min, max] = levelSelects(element, "001");
	expect([...min.options].map((o) => o.textContent?.trim())).toEqual([
		"+0", "+1", "+2", "+3", "+4", "+5", "+6", "+7", "+8", "+9",
	]);
	expect(min.value).toBe("0");
	expect(max.value).toBe("0");
	expect(min.getAttribute("aria-label")).toBe("Always Cute Acorn lowest level");
	expect(max.getAttribute("aria-label")).toBe("Always Cute Acorn highest level");
	expect(element.levels).toEqual({ "001": [0, 0], "002": [0, 0] });
});

test("the levels setter shows on the selects and keeps only selected values", async () => {
	const element = await mount();
	element.selected = ["001"];
	element.levels = { "001": [5, 8], "003": [9, 9] };
	await element.updateComplete;

	const [min, max] = levelSelects(element, "001");
	expect(min.value).toBe("5");
	expect(max.value).toBe("8");
	expect(element.levels).toEqual({ "001": [5, 8] });
});

test("changing a level dispatches one input and nothing escapes from the select", async () => {
	const element = await mount();
	element.selected = ["001"];
	await element.updateComplete;

	let inputs = 0;
	let changes = 0;
	document.body.addEventListener("input", () => inputs++);
	document.body.addEventListener("change", () => changes++);

	const [, max] = levelSelects(element, "001");
	await setLevel(element, max, 9);

	expect(element.levels).toEqual({ "001": [0, 9] });
	expect(inputs).toBe(1);
	expect(changes).toBe(0);
});

test("the two selects cannot build a range that runs backwards", async () => {
	const element = await mount();
	element.selected = ["001"];
	element.levels = { "001": [3, 5] };
	await element.updateComplete;

	await setLevel(element, levelSelects(element, "001")[0], 7);
	expect(element.levels).toEqual({ "001": [7, 7] });

	await setLevel(element, levelSelects(element, "001")[1], 2);
	expect(element.levels).toEqual({ "001": [2, 2] });
});

test("dropping one pick keeps the other's level", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "001": [1, 1], "002": [4, 9] };
	await element.updateComplete;

	const remove = element.shadowRoot?.querySelector<HTMLButtonElement>(
		'.chip[data-value="001"] button.remove',
	);
	remove?.click();
	await element.updateComplete;

	expect(element.selected).toEqual(["002"]);
	expect(element.levels).toEqual({ "002": [4, 9] });
});

test("Done keeps the levels of picks that stay, and a re-added pick starts at +0", async () => {
	const element = await mount();
	element.selected = ["001", "002"];
	element.levels = { "001": [6, 6], "002": [9, 9] };
	await element.updateComplete;

	// Drop 002 and add 003 in one visit to the dialog.
	tile(element).click();
	await element.updateComplete;
	entries(element).find((cell) => cell.value === "002")?.click();
	entries(element).find((cell) => cell.value === "003")?.click();
	await element.updateComplete;
	done(element).click();
	await element.updateComplete;
	expect(element.levels).toEqual({ "001": [6, 6], "003": [0, 0] });

	// And 002 comes back at +0, not at the +9 it left with.
	tile(element).click();
	await element.updateComplete;
	entries(element).find((cell) => cell.value === "002")?.click();
	await element.updateComplete;
	done(element).click();
	await element.updateComplete;
	expect(element.levels["002"]).toEqual([0, 0]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/components/entry-tiles.test.ts`
Expected: FAIL — `no level selects for 001`.

- [ ] **Step 3: Implement**

In `src/components/entry-tiles.ts`, below the `Option` type:

```ts
/** An upgrade level, or a range of them: +0 to +9, `min` never above `max`. */
export type Level = readonly [min: number, max: number];

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const UNUPGRADED: Level = [0, 0];
```

Add state beside `chosen`:

```ts
	/**
	 * Each pick's level. Only picks that have left +0 have an entry, and an
	 * entry leaves with its pick: a treasure dropped and picked again starts
	 * over rather than coming back at a level nobody set this time.
	 */
	@state()
	private leveled: ReadonlyMap<string, Level> = new Map();
```

Add the property below the `selected` setter:

```ts
	/** One entry per pick, in pick order; a pick never levelled reads +0. */
	get levels(): Readonly<Record<string, Level>> {
		return Object.fromEntries(
			this.selected.map((value) => [
				value,
				this.leveled.get(value) ?? UNUPGRADED,
			]),
		);
	}

	set levels(levels: Readonly<Record<string, Level>>) {
		this.leveled = new Map(
			Object.entries(levels).filter(([value]) => this.chosen.has(value)),
		);
	}

	/** Levels travel with their picks, so a pick that leaves takes its level. */
	#prune(): void {
		const kept = [...this.leveled].filter(([value]) => this.chosen.has(value));
		if (kept.length !== this.leveled.size) this.leveled = new Map(kept);
	}

	/**
	 * The two selects cannot disagree: moving one past the other drags the other
	 * along, so the slot never holds a range the code would refuse to read.
	 */
	#setLevel(value: string, end: "min" | "max", to: number): void {
		const [min, max] = this.leveled.get(value) ?? UNUPGRADED;
		const next: Level =
			end === "min" ? [to, Math.max(max, to)] : [Math.min(min, to), to];
		this.leveled = new Map(this.leveled).set(value, next);
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}
```

Call `this.#prune();` at the end of `willUpdate` (after the `chosen` pruning), in `#commit` right after `this.chosen = new Set(this.draft);`, and in `#drop` right after `this.chosen = next;`.

Add a render helper beside `#art`:

```ts
	#levelSelect(value: string, name: string, end: "min" | "max", at: number) {
		// The select's own input and change are composed: left alone they would
		// leave the shadow root as a second, unexplained change. The host's input
		// is the one that says the slot moved.
		const stop = (event: Event): void => {
			event.stopPropagation();
		};
		return html`<select
			class=${`level level-${end}`}
			aria-label=${`${name} ${end === "min" ? "lowest" : "highest"} level`}
			@input=${stop}
			@change=${(event: Event) => {
				stop(event);
				this.#setLevel(
					value,
					end,
					Number((event.target as HTMLSelectElement).value),
				);
			}}
		>
			${LEVELS.map(
				(level) =>
					html`<option value=${level} ?selected=${level === at}>+${level}</option>`,
			)}
		</select>`;
	}
```

(`?selected` on each option rather than `.value` on the select: Lit commits the select's own bindings before its children exist on first render.)

In `render`, inside the `chosen.map` for the pick rows, read the level and add `data-value` plus the two selects between the name and the remove button:

```ts
							${chosen.map((value) => {
								const name = labels.get(value) ?? value;
								const [min, max] = this.leveled.get(value) ?? UNUPGRADED;
								return html`<li
									class="chip"
									data-value=${value}
									data-kind=${ifDefined(kinds.get(value))}
									>${this.#art(name, images.get(value) ?? null)}<span class="name"
										>${name}</span
									><span class="levels"
										>${this.#levelSelect(value, name, "min", min)}<span
											class="to"
											aria-hidden="true"
											>–</span
										>${this.#levelSelect(value, name, "max", max)}</span
									><button
```

(the `<button type="button" class="remove" …>` that follows is unchanged).

Add to the component's `css` block, after `.chip .name`:

```css
			/* Two narrow selects: a level is one character, and the name beside
			   them is what the row is read for. */
			.levels {
				display: inline-flex;
				flex: 0 0 auto;
				gap: 0.15rem;
				align-items: center;
			}

			.levels select {
				padding: 0 var(--cr-space-1);
				font-family: var(--cr-mono);
				font-size: 0.75rem;
			}

			.levels .to {
				color: var(--cr-muted);
				font-size: 0.75rem;
			}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test src/components/entry-tiles.test.ts && bun run check`
Expected: PASS, including every pre-existing test in the file.

- [ ] **Step 5: Commit**

```bash
git add src/components/entry-tiles.ts src/components/entry-tiles.test.ts
git commit -m "feat: pick a level for each treasure in its slot

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Wire levels between the slots and the code

**Files:**
- Modify: `src/routes/combi-name/index.ts` (`readLoadout`, `writeLoadout`)
- Test: `src/routes/combi-name/index.test.ts`

**Interfaces:**
- Consumes: `treasurePick(id, min, max)` and `TreasurePick` from Task 1; `EntryTiles.levels` / `Level` from Task 2.

- [ ] **Step 1: Write the failing tests**

Append to `src/routes/combi-name/index.test.ts` (`need`, `inside`, `settle`, `typeCode`, `reset`, `codeBar` already exist):

```ts
function levelOf(slotId: string, treasure: string): [string, string] {
	const row = inside(need(slotId)).querySelector<HTMLElement>(
		`.chip[data-value="${treasure}"]`,
	);
	const min = row?.querySelector<HTMLSelectElement>("select.level-min");
	const max = row?.querySelector<HTMLSelectElement>("select.level-max");
	if (!min || !max) throw new Error(`no level selects for ${treasure}`);
	return [min.value, max.value];
}

test("a code's treasure levels land on the selects", async () => {
	await typeCode("1TU0FZ_0RB58.0QQ9-1S00000000");

	expect(levelOf("treasure1", "0FZ")).toEqual(["0", "0"]);
	expect(levelOf("treasure1", "0RB")).toEqual(["5", "8"]);
	expect(levelOf("treasure2", "0QQ")).toEqual(["9", "9"]);
	await reset();
});

test("changing a level rewrites the code", async () => {
	await typeCode("1TU0FZ-1S00000000");
	(codeBar as HTMLElement & { editing: boolean }).editing = false;
	await settle();

	const max = inside(need("treasure1")).querySelector<HTMLSelectElement>(
		'.chip[data-value="0FZ"] select.level-max',
	);
	if (!max) throw new Error("no highest-level select");
	max.value = "9";
	max.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
	await settle();

	expect((codeBar as HTMLElement & { value: string }).value).toBe(
		"1TU0FZ09-1S00000000",
	);
	await reset();
});

// A reversed range does not decode, and a code that does not decode leaves the
// controls exactly where they were.
test("a code with a backwards level range changes nothing", async () => {
	await typeCode("1TU0FZ9-1S00000000");
	await typeCode("1TU0FZ95-1S00000000");

	expect(levelOf("treasure1", "0FZ")).toEqual(["9", "9"]);
	await reset();
});
```

If `0RB` or `0QQ` is not in the picker's offered list, `treasureOptions` appends it anyway (a carried id always gets a row), so the ids are safe; they are the ones `loadout.test.ts` already uses.

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test src/routes/combi-name/index.test.ts -t "level"`
Expected: FAIL — `0RB` reads `["0", "0"]` (levels are dropped by the Task 1 stopgap).

- [ ] **Step 3: Implement**

In `index.ts`, replace the stopgap in `readLoadout`:

```ts
		// Empty slots are not gaps in the wire format, so they drop out.
		treasures: treasureSlots
			.map((slot) => {
				const { levels } = slot;
				return slot.selected.map((id) => {
					const [min, max] = levels[id] ?? [0, 0];
					return treasurePick(id, min, max);
				});
			})
			.filter((slot) => slot.length > 0),
```

and in `writeLoadout`:

```ts
	treasureSlots.forEach((slot, index) => {
		const carried = loadout.treasures[index] ?? [];
		const ids = carried.map((pick) => pick.id);
		// Options, then picks, then levels: each is a separate write, a slot
		// prunes a pick its options do not hold, and a level its picks do not.
		slot.options = treasureOptions(ids);
		slot.selected = ids;
		slot.levels = Object.fromEntries(
			carried.map((pick) => [pick.id, [pick.min, pick.max] as const]),
		);
	});
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test && bun run check`
Expected: all PASS.

- [ ] **Step 5: Check it in the browser**

Run: `bun run dev`, open `http://localhost:3000/combi-name/#1TU0FZ_0RB58-1S00000000`. Confirm both rows show their selects at +0–+0 and +5–+8, the rows still fit at 400px width, raising "from" past "to" drags "to", and the code bar's tooltip on the `T` group names both levels.

- [ ] **Step 6: Commit**

```bash
git add src/routes/combi-name/index.ts src/routes/combi-name/index.test.ts
git commit -m "feat: write treasure levels into the code and read them back

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Document the level suffix

**Files:**
- Modify: `README.md` (loadout section)
- Modify: `.claude/skills/combi-codec/SKILL.md` ("The loadout section")

- [ ] **Step 1: README**

Change the `T` row of the loadout table to:

```markdown
| `T` | Treasures | An order flag (`U` any order, `O` exact order), then up to three slots of 3-character ids joined by `.`; alternatives within a slot are joined by `_`, and each id may be followed by its level |
```

Add after the paragraph about repeated ids:

```markdown
### Treasure levels

A treasure is upgraded from +0 to +9, and each treasure in a slot says which level it is accepted at. The level follows its id directly — ids are always three characters, so it needs no separator:

| Written | Level |
| --- | --- |
| `0FZ` | +0, not upgraded |
| `0FZ5` | +5 |
| `0FZ58` | +5 to +8 |
| `0FZ09` | +0 to +9, any level |

No digits means +0, which is also how every code written before levels existed reads. Encoding writes the shortest form: a range whose two ends match is one digit, and +0 is nothing. A range that runs backwards, like `95`, is rejected.
```

Add an example line to the examples block:

```
1TU0FZ_0RB59.0QQ9-1S00000000        slot 1: 0FZ at +0 or 0RB at +5-9; slot 2: 0QQ at +9
```

- [ ] **Step 2: Skill**

In `.claude/skills/combi-codec/SKILL.md`, append to the paragraph starting "Encoding a loadout always writes its canonical form":

```markdown
Each treasure id may be followed by a level: nothing for +0, one digit for one level, two for a range `min` then `max`. `Loadout.treasures` holds `TreasurePick { id, min, max }` for it, built with `treasurePick`. Canonical form writes +0 as nothing and a matching range as one digit; within a slot ids still sort by id alone (an id cannot repeat there), while unordered slots sort by their whole written string, levels included. No digits reading as +0 is what keeps every earlier code meaning what it did, which is why `LOADOUT_VERSION` stayed `1`. On the page, `<entry-tiles>`'s `levels` property carries the levels beside `selected`, and `writeLoadout` writes options, then picks, then levels, since each write prunes against the one before.
```

- [ ] **Step 3: Verify and commit**

Run: `bun run check && bun run test`
Expected: PASS.

```bash
git add README.md .claude/skills/combi-codec/SKILL.md
git commit -m "docs: describe treasure levels in the loadout

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
