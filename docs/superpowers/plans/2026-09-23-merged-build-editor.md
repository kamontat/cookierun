# Merged Build Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the combi page's summary card and its four control panels with one board where every value shown is the control that writes it, and the catalog pickers open as modal dialogs.

**Architecture:** `<entry-tile>` and `<entry-tiles>` keep all their logic and swap their inline `<details>` for a modal `<dialog>`, their closed line becoming a tile button. `<chip-group>` and `<card-group>` are reused unchanged for the run rows and the toggle grids. `<build-summary>` shrinks to the board's header — badge and verdict sentence. The page still holds exactly one `FullCode`, read off the same controls by the same `readForm`/`readLoadout`.

**Tech Stack:** Bun, TypeScript, Lit 3 (decorators as class fields, not `accessor`), happy-dom via `tests/happydom.ts`, Biome, `bun test`.

**Spec:** `docs/superpowers/specs/2026-09-23-merged-build-editor-design.md`

## Global Constraints

- Runtime is Bun. `bun test`, `bun run check:type`, `bun run check:biome`; never npm/yarn/pnpm/jest/vitest.
- Components are `LitElement` with their own shadow root. Reactive properties use `@property()` / `@state()` from `lit/decorators.js` as plain class fields — **never** the `accessor` keyword (`experimentalDecorators: true` is set; `accessor` does not survive Bun's transpiler).
- `noImplicitOverride` is on: `static styles`, `render`, `connectedCallback`, `disconnectedCallback`, `willUpdate` all need `override`.
- `exactOptionalPropertyTypes: true` and `noUncheckedIndexedAccess: true`. Do not assign `undefined` to an optional property — omit the key (`...(cond ? { note: x } : {})`).
- Colour and sizing come only from `--cr-*` custom properties defined in `src/routes/tokens.css`. A component never hardcodes a colour.
- A CSS comment inside a `css` tagged template must not contain a backtick.
- Every `customElements.define` stays guarded by `customElements.get` — one `bun test` process shares one registry.
- Components import from `src/lib/` and `src/components/` only, never from `src/routes/`.
- Imports carry no file extension except `lit/decorators.js` and `#assets/index.json`.
- A control dispatches an untargeted `input` from its host; the page listens on the form. A native `input` inside a shadow root is stopped rather than allowed to escape.
- Run `bun run format:biome` before each commit and read the diff; `bun run check` must be clean at every commit.
- Commit messages end with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

---

## File Structure

| File | Responsibility after this plan |
| --- | --- |
| `src/components/entry-tile.ts` | One-pick catalog control: tile button on the host, grid in a modal dialog. |
| `src/components/entry-tile.test.ts` | Its tests, driven through the dialog. |
| `src/components/entry-tiles.ts` | Slot control: tile button, dialog with kind filter, draft selection, Done/Clear. |
| `src/components/entry-tiles.test.ts` | Its tests, including draft-and-cancel. |
| `src/components/build-summary.ts` | The board's header only: title, auto badge, verdict sentence. |
| `src/components/build-summary.test.ts` | Its tests, groups removed. |
| `src/routes/combi-name/index.html` | The board: header, Loadout, Treasures, Run, Cookie power+. No panels. |
| `src/routes/combi-name/index.css` | Board layout: groups, tile rows, labelled run rows, the order switch. |
| `src/routes/combi-name/index.ts` | Wiring: options in, one `render`, slot legends following the order switch. |
| `src/routes/combi-name/index.test.ts` | Route tests through the board and the dialogs. |
| `.claude/skills/ui-components/SKILL.md` | The element contracts, updated for the dialog. |
| `.claude/skills/combi-codec/SKILL.md` | The page's form wiring, updated for the board. |

---

### Task 1: `<entry-tile>` opens a modal dialog

**Files:**
- Modify: `src/components/entry-tile.ts`
- Test: `src/components/entry-tile.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `<entry-tile>` with unchanged public API — `label` attribute, `options: readonly Option[]`, `value: string | null`, an untargeted `input` event. The `open` property is **removed**. Shadow DOM shape: `button.tile` on the host, `dialog` containing `input[type=search]` and `div.entries > button.entry`.

- [ ] **Step 1: Write the failing tests**

Replace the `open`/`details` tests in `src/components/entry-tile.test.ts` with these. Keep every existing test that covers filtering, the 50-match cap, pruning and the `input` event — only the way the grid is reached changes.

```ts
function tile(element: EntryTile): HTMLButtonElement {
	const node = element.shadowRoot?.querySelector<HTMLButtonElement>("button.tile");
	if (node === null || node === undefined) throw new Error("no tile button");
	return node;
}

function dialog(element: EntryTile): HTMLDialogElement {
	const node = element.shadowRoot?.querySelector("dialog");
	if (node === null || node === undefined) throw new Error("no dialog");
	return node;
}

test("the tile says what the control holds", async () => {
	const element = await mount();
	element.options = [["0O", "Fairy Cookie", null]];
	element.value = "0O";
	await settle(element);

	expect(tile(element).textContent).toContain("Fairy Cookie");
	expect(dialog(element).open).toBe(false);
});

test("clicking the tile opens the dialog", async () => {
	const element = await mount();
	element.options = [["0O", "Fairy Cookie", null]];
	await settle(element);

	tile(element).click();
	await settle(element);

	expect(dialog(element).open).toBe(true);
});

test("picking a cell writes the value, dispatches input and closes", async () => {
	const element = await mount();
	element.options = [["0O", "Fairy Cookie", null]];
	await settle(element);
	let heard = 0;
	element.addEventListener("input", () => {
		heard += 1;
	});

	tile(element).click();
	await settle(element);
	cell(element, "0O").click();
	await settle(element);

	expect([element.value, heard, dialog(element).open]).toEqual(["0O", 1, false]);
});

test("closing the dialog puts focus back on the tile", async () => {
	const element = await mount();
	element.options = [["0O", "Fairy Cookie", null]];
	await settle(element);

	tile(element).click();
	await settle(element);
	cell(element, "0O").click();
	await settle(element);
	await settle(element);

	expect(element.shadowRoot?.activeElement).toBe(tile(element));
});
```

`cell(element, value)` is the existing helper that finds `button.entry` by its `.value`; `settle(element)` is the existing `updateComplete` + `Bun.sleep(0)` helper. If either is missing from the file, add:

```ts
async function settle(element: EntryTile): Promise<void> {
	await element.updateComplete;
	await Bun.sleep(0);
}

function cell(element: EntryTile, value: string): HTMLButtonElement {
	const found = [
		...(element.shadowRoot?.querySelectorAll<HTMLButtonElement>("button.entry") ?? []),
	].find((button) => button.value === value);
	if (found === undefined) throw new Error(`no cell for ${value}`);
	return found;
}
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `bun run test src/components/entry-tile.test.ts`
Expected: FAIL — "no tile button" / "no dialog", because the component still renders a `<details>`.

- [ ] **Step 3: Rewrite the component's shell**

In `src/components/entry-tile.ts`:

Delete the `open` property, `#closeOnOutside`, `connectedCallback` and `disconnectedCallback` entirely (nothing else in them).

Add a dialog handle and the open/close pair:

```ts
	#dialog(): HTMLDialogElement | null {
		return this.shadowRoot?.querySelector("dialog") ?? null;
	}

	#tile(): HTMLButtonElement | null {
		return this.shadowRoot?.querySelector("button.tile") ?? null;
	}

	/**
	 * A modal rather than an inline list: the grid wants the width of the page,
	 * and six inline grids was a page you had to tidy up after. The platform
	 * takes care of the backdrop, the focus trap and Escape.
	 */
	async #openPicker(): Promise<void> {
		this.filter = "";
		await this.updateComplete;
		this.#dialog()?.showModal();
		this.#search()?.focus();
	}

	#closePicker(): void {
		this.#dialog()?.close();
		this.#tile()?.focus();
	}
```

Change `#pick` so a pick commits and closes:

```ts
	/**
	 * A click is the commit: one pick, one value, and the dialog has nothing
	 * left to ask. Focus goes back to the tile, which is where it came from.
	 */
	#pick(value: string): void {
		this.picked = value === "" ? null : value;
		this.dispatchEvent(new Event("input", { bubbles: true }));
		this.#closePicker();
	}
```

Update the cell's handler to `@click=${() => { this.#pick(value); }}`.

- [ ] **Step 4: Rewrite `render`**

```ts
	override render() {
		const { shown, total } = this.#matches();
		const tabbableValue = this.picked ?? "";
		const picked = this.#pickedOption();

		return html`<button
				type="button"
				class="tile"
				@click=${() => {
					void this.#openPicker();
				}}
			>
				<span class="label">${this.label}</span>
				<span class=${picked === undefined ? "pick empty" : "pick"}>
					${
						picked === undefined
							? NONE
							: html`${this.#art(picked[1], picked[2])}${picked[1]}`
					}
				</span>
			</button>
			<dialog
				@close=${() => {
					this.#tile()?.focus();
				}}
			>
				<div class="sheet">
					<header>
						<h2>${this.label}</h2>
						<button
							type="button"
							class="close"
							@click=${() => {
								this.#closePicker();
							}}
						>
							Close
						</button>
					</header>
					<input
						type="search"
						autocomplete="off"
						placeholder="Type to filter"
						aria-label=${`Filter ${this.label}`}
						.value=${this.filter}
						@input=${(event: Event) => {
							event.stopPropagation();
							this.filter = (event.target as HTMLInputElement).value;
						}}
					/>
					<div
						class="entries"
						role="listbox"
						aria-label=${this.label}
						@keydown=${(event: KeyboardEvent) => {
							this.#walk(event);
						}}
					>
						${this.#cell(["", NONE, null], tabbableValue === "")}
						${shown.map((option) => this.#cell(option, option[0] === tabbableValue))}
					</div>
					<small class="more"
						>${
							total > LIMIT
								? `Showing ${LIMIT} of ${total}. Type to narrow the list.`
								: ""
						}</small
					>
				</div>
			</dialog>`;
	}
```

- [ ] **Step 5: Move the shared styles from `details` to the tile and the dialog**

In `tileStyles` (exported from this file, also used by `<entry-tiles>`), replace the `details` and `summary` rules with:

```css
	button.tile {
		display: flex;
		gap: var(--cr-space-3);
		align-items: center;
		width: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
		box-shadow: none;
		padding: var(--cr-space-2);
		color: inherit;
		font-family: var(--cr-font);
		font-size: 0.9rem;
		text-align: left;
		text-transform: none;
		letter-spacing: normal;
	}

	button.tile:active {
		transform: none;
	}

	dialog {
		width: min(52rem, 94vw);
		max-height: 85vh;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
		padding: 0;
		color: var(--cr-text);
	}

	dialog::backdrop {
		background: rgb(0 0 0 / 55%);
	}

	.sheet {
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr) auto;
		gap: var(--cr-space-2);
		max-height: 85vh;
		padding: var(--cr-space-3);
	}

	.sheet header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--cr-space-2);
	}

	.sheet h2 {
		margin: 0;
		font-family: var(--cr-mono);
		font-size: 1rem;
	}

	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		gap: var(--cr-space-1);
		overflow-y: auto;
	}
```

Keep `.label`, `.pick`, `.art`, `.glyph`, `.entry`, `.more` exactly as they are. Delete the `max-height: 18rem` from `.entries` (the sheet's grid row bounds it now) and the `@media (pointer: coarse) { summary { … } }` block — the tile is a `<button>`, so the shared `controls` chunk already gives it the 44px hit area.

- [ ] **Step 6: Run the tests**

Run: `bun run test src/components/entry-tile.test.ts`
Expected: PASS, all of them.

- [ ] **Step 7: Run the checks**

Run: `bun run format:biome && bun run check`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/entry-tile.ts src/components/entry-tile.test.ts
git commit -m "$(cat <<'EOF'
feat: open the cookie picker as a modal rather than inline

The grid wants the width of the page, and the closed line it hung under
is about to become a tile on the build board. The platform's own modal
brings the backdrop, the focus trap and Escape, so the outside-click
closer goes, and `open` stops reflecting: nothing widens a row for a
dialog.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `<entry-tiles>` opens a modal dialog with a draft selection

**Files:**
- Modify: `src/components/entry-tiles.ts`
- Test: `src/components/entry-tiles.test.ts`

**Interfaces:**
- Consumes: `tileStyles`, `glyphFor` from `src/components/entry-tile.ts` (Task 1's rewritten styles).
- Produces: `<entry-tiles>` with unchanged public API — `legend` attribute, `options: readonly Option[]` (4-tuple with kind), `selected: string[]`, one untargeted `input` per commit. `open` is **removed**. Shadow DOM: `button.tile`, `dialog` with `.kinds`, `input[type=search]`, `div.entries`, and a footer holding `button.done` and `button.clear`.

- [ ] **Step 1: Write the failing tests**

Add to `src/components/entry-tiles.test.ts` (keep the existing option-pruning, id-order and kind-filter tests; they do not care where the grid lives):

```ts
test("picks inside the dialog do not change the slot until Done", async () => {
	const element = await mount();
	element.options = [
		["000", "Always Cute Acorn", null, "base"],
		["007", "Blessed Stretched Acorn", null, "blessed"],
	];
	await settle(element);
	let heard = 0;
	element.addEventListener("input", () => {
		heard += 1;
	});

	tile(element).click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);

	expect([element.selected, heard]).toEqual([[], 0]);
});

test("Done writes every pick and dispatches one input", async () => {
	const element = await mount();
	element.options = [
		["000", "Always Cute Acorn", null, "base"],
		["007", "Blessed Stretched Acorn", null, "blessed"],
	];
	await settle(element);
	let heard = 0;
	element.addEventListener("input", () => {
		heard += 1;
	});

	tile(element).click();
	await settle(element);
	cell(element, "007").click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);
	done(element).click();
	await settle(element);

	// Id order, not click order: a slot's alternatives are written in id order.
	expect([element.selected, heard, dialog(element).open]).toEqual([
		["000", "007"],
		1,
		false,
	]);
});

// A slot is a set. Half a set applied on the way out is worse than none.
test("closing without Done leaves the slot as it was", async () => {
	const element = await mount();
	element.options = [["000", "Always Cute Acorn", null, "base"]];
	element.selected = ["000"];
	await settle(element);

	tile(element).click();
	await settle(element);
	cell(element, "000").click();
	await settle(element);
	dialog(element).close();
	await settle(element);

	expect(element.selected).toEqual(["000"]);
});

test("Clear empties the draft without closing or committing", async () => {
	const element = await mount();
	element.options = [["000", "Always Cute Acorn", null, "base"]];
	element.selected = ["000"];
	await settle(element);

	tile(element).click();
	await settle(element);
	clear(element).click();
	await settle(element);

	expect([
		cell(element, "000").getAttribute("aria-checked"),
		element.selected,
		dialog(element).open,
	]).toEqual(["false", ["000"], true]);
});

test("the tile wears every alternative the slot holds", async () => {
	const element = await mount();
	element.options = [
		["000", "Always Cute Acorn", null, "base"],
		["007", "Blessed Stretched Acorn", null, "blessed"],
	];
	element.selected = ["000", "007"];
	await settle(element);

	expect(tile(element).textContent).toContain("Always Cute Acorn");
	expect(tile(element).textContent).toContain("Blessed Stretched Acorn");
});
```

With these helpers at the top of the file (alongside the existing `mount`, `settle`, `cell`):

```ts
function tile(element: EntryTiles): HTMLButtonElement {
	const node = element.shadowRoot?.querySelector<HTMLButtonElement>("button.tile");
	if (node === null || node === undefined) throw new Error("no tile button");
	return node;
}

function dialog(element: EntryTiles): HTMLDialogElement {
	const node = element.shadowRoot?.querySelector("dialog");
	if (node === null || node === undefined) throw new Error("no dialog");
	return node;
}

function done(element: EntryTiles): HTMLButtonElement {
	const node = element.shadowRoot?.querySelector<HTMLButtonElement>("button.done");
	if (node === null || node === undefined) throw new Error("no Done button");
	return node;
}

function clear(element: EntryTiles): HTMLButtonElement {
	const node = element.shadowRoot?.querySelector<HTMLButtonElement>("button.clear");
	if (node === null || node === undefined) throw new Error("no Clear button");
	return node;
}
```

Delete the existing tests that click a chip's remove button — that affordance is gone.

- [ ] **Step 2: Run the tests and watch them fail**

Run: `bun run test src/components/entry-tiles.test.ts`
Expected: FAIL — "no tile button" / "no Done button".

- [ ] **Step 3: Add the draft state and the open/close pair**

In `src/components/entry-tiles.ts`, delete the `open` property, `#closeOnOutside`, `connectedCallback`, `disconnectedCallback` and `#drop` (with its `summary button.remove` focus recovery). Add:

```ts
	/**
	 * What the dialog is showing, which is not yet what the slot holds. A slot is
	 * a set: applying half of one on the way out would leave a code nobody built,
	 * so the draft is committed by Done and thrown away by everything else.
	 */
	@state()
	private draft: ReadonlySet<string> = new Set();

	#dialog(): HTMLDialogElement | null {
		return this.shadowRoot?.querySelector("dialog") ?? null;
	}

	#tile(): HTMLButtonElement | null {
		return this.shadowRoot?.querySelector("button.tile") ?? null;
	}

	async #openPicker(): Promise<void> {
		this.draft = new Set(this.chosen);
		this.filter = "";
		await this.updateComplete;
		this.#dialog()?.showModal();
		this.#search()?.focus();
	}

	#commit(): void {
		this.chosen = new Set(this.draft);
		this.dispatchEvent(new Event("input", { bubbles: true }));
		this.#dialog()?.close();
	}
```

Rewrite `#toggle` to move the draft rather than the value:

```ts
	/** Focus follows the toggled cell into its replacement, as in `<entry-tile>`. */
	async #toggle(value: string): Promise<void> {
		const next = new Set(this.draft);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		this.draft = next;
		await this.updateComplete;
		(
			this.#cells().find((cell) => cell.value === value) ?? this.#search()
		)?.focus();
	}
```

Every `this.chosen.has(value)` inside the grid's rendering becomes `this.draft.has(value)`; the tile's summary of what is held keeps reading `this.selected`.

- [ ] **Step 4: Rewrite `render`**

The tile replaces the `<summary>`; the grid, the kind row and the footer go in the dialog. `chosen`, `offered`, `narrowing`, `matching`, `shown` and `tabbableValue` are computed exactly as today, except `tabbableValue` reads the draft:

```ts
		const tabbableValue =
			shown.find(([value]) => this.draft.has(value))?.[0] ?? shown[0]?.[0];

		return html`<button
				type="button"
				class="tile"
				@click=${() => {
					void this.#openPicker();
				}}
			>
				<span class="label">${this.legend}</span>
				<span class=${chosen.length === 0 ? "pick empty" : "pick"}>
					${
						chosen.length === 0
							? NONE
							: chosen.map((value, index) => {
									const name = labels.get(value) ?? value;
									return html`${index === 0 ? "" : html`<span class="or">or</span>`}<span
										class="chip"
										data-kind=${ifDefined(kinds.get(value))}
										>${this.#art(name, images.get(value) ?? null)}<span class="name"
											>${name}</span
										></span
									>`;
								})
					}
				</span>
			</button>
			<dialog
				@close=${() => {
					this.#tile()?.focus();
				}}
			>
				<div class="sheet">
					<header>
						<h2>${this.legend}</h2>
						<button
							type="button"
							class="close"
							@click=${() => {
								this.#dialog()?.close();
							}}
						>
							Close
						</button>
					</header>
					${
						offered.length === 0
							? nothing
							: html`<div
									class="kinds"
									role="group"
									aria-label=${`Filter ${this.legend} by kind`}
								>
									${[ANY_KIND, ...offered].map(
										(kind) => html`<button
											type="button"
											data-kind=${kind}
											aria-pressed=${String(kind === narrowing)}
											@click=${() => {
												this.kind = kind;
											}}
										>
											${kind === ANY_KIND ? "All" : KINDS[kind]?.name}
										</button>`,
									)}
								</div>`
					}
					<input
						type="search"
						autocomplete="off"
						placeholder="Type to filter"
						aria-label=${`Filter ${this.legend}`}
						.value=${this.filter}
						@input=${(event: Event) => {
							event.stopPropagation();
							this.filter = (event.target as HTMLInputElement).value;
						}}
					/>
					<div
						class="entries"
						role="listbox"
						aria-multiselectable="true"
						aria-label=${this.legend}
						@keydown=${(event: KeyboardEvent) => {
							this.#walk(event);
						}}
					>
						${shown.map((option) => {
							const [value, label, image] = option;
							const kind = kindOf(option);
							return html`<button
								type="button"
								class="entry"
								.value=${value}
								role="option"
								data-kind=${ifDefined(kind)}
								tabindex=${value === tabbableValue ? 0 : -1}
								aria-checked=${String(this.draft.has(value))}
								aria-selected=${String(this.draft.has(value))}
								aria-label=${kind === undefined ? label : `${label}, ${KINDS[kind]?.name}`}
								@click=${() => {
									void this.#toggle(value);
								}}
							>
								${this.#art(label, image, kind)}<span class="name">${label}</span>
							</button>`;
						})}
					</div>
					<footer>
						<span class="picked"
							>${this.draft.size} picked — alternatives for one slot</span
						>
						<span class="buttons">
							<button
								type="button"
								class="clear"
								@click=${() => {
									this.draft = new Set();
								}}
							>
								Clear
							</button>
							<button
								type="button"
								class="done"
								@click=${() => {
									this.#commit();
								}}
							>
								Done
							</button>
						</span>
					</footer>
					<small class="more"
						>${
							matching.length > LIMIT
								? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
								: ""
						}</small
					>
				</div>
			</dialog>`;
```

- [ ] **Step 5: Adjust this component's own styles**

Delete the `.remove` rules and the `@media (pointer: coarse) { .remove { … } }` block — that button is gone. Add the footer:

```css
			footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--cr-space-2);
			}

			footer .picked {
				color: var(--cr-muted);
				font-size: 0.78rem;
			}

			footer .buttons {
				display: flex;
				gap: var(--cr-space-2);
			}

			footer button.done {
				border-color: var(--cr-accent);
				background: var(--cr-accent);
				color: var(--cr-bg);
			}
```

The `.chip` rules stay: the tile still draws one chip per alternative, just without a remove button inside it.

- [ ] **Step 6: Run the tests**

Run: `bun run test src/components/entry-tiles.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the checks**

Run: `bun run format:biome && bun run check`
Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add src/components/entry-tiles.ts src/components/entry-tiles.test.ts
git commit -m "$(cat <<'EOF'
feat: pick a treasure slot's alternatives in a modal

The slot's grid moves into a dialog, and what you click there is a draft
until Done: a slot is a set, and half a set applied on the way out is a
code nobody built. Escape and the backdrop cancel it whole.

The per-chip remove button goes with the closed line that carried it - a
tile is a button, and a button inside a button is not markup. Unpicking a
cell, or Clear, does that job where the rest of the slot is visible.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `<build-summary>` shrinks to the board's header

**Files:**
- Modify: `src/components/build-summary.ts`
- Test: `src/components/build-summary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `<build-summary>` with one property, `verdict: Verdict | null`. `groups`, `SummaryFace`, `SummaryItem` and `SummaryGroup` are deleted. Shadow DOM: `header > h2 + span.badge`, and `p.verdict`.

- [ ] **Step 1: Cut the group tests, keep the verdict ones**

In `src/components/build-summary.test.ts`, delete every test that sets `groups` (the group heading test, the faces test, the no-faces test) and the `LOADOUT` constant. Keep and adjust the rest so they no longer assign `groups`:

```ts
test("a semi-auto verdict wears a badge and names what forces the work", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start", "Jump at start"] };
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Semi-auto");
	expect(text(element, ".verdict")).toBe(
		"Fast Start, Jump at start need manual work each run.",
	);
});

test("a full-auto verdict says nothing needs manual work", async () => {
	const element = await mount();

	element.verdict = { semi: false, reasons: [] };
	await element.updateComplete;

	expect(text(element, ".badge")).toBe("Full auto");
	expect(text(element, ".verdict")).toBe("Nothing needs manual work each run.");
});

// The board's own heading stands with or without a verdict; only the badge and
// the sentence are the verdict's.
test("a cleared verdict takes the badge and the line with it", async () => {
	const element = await mount();

	element.verdict = { semi: true, reasons: ["Fast Start"] };
	await element.updateComplete;
	element.verdict = null;
	await element.updateComplete;

	expect(element.shadowRoot?.querySelector(".badge")).toBe(null);
	expect(element.shadowRoot?.querySelector(".verdict")).toBe(null);
	expect(text(element, "h2")).toBe("Your build");
});
```

- [ ] **Step 2: Run the tests and watch the last one fail**

Run: `bun run test src/components/build-summary.test.ts`
Expected: FAIL on "a cleared verdict…" — `render` currently returns `nothing` when there are no groups and no verdict, so `h2` is absent.

- [ ] **Step 3: Cut the component down**

Delete `SummaryFace`, `SummaryItem`, `SummaryGroup`, the `groups` property, `#faces`, `#item`, and every style rule for `.group`, `.items`, `.item`, `.faces`, `.face`, `img`, `.note`, `.or`, `h3`. Keep `:host`, `header`, `h2`, `.badge`, `.verdict`. Rewrite `render`:

```ts
	override render() {
		return html`<header>
				<h2>Your build</h2>
				${
					this.verdict === null
						? nothing
						: html`<span class="badge"
							>${this.verdict.semi ? "Semi-auto" : "Full auto"}</span
						>`
				}
			</header>
			${this.#verdict()}`;
	}
```

Update the class doc comment to say what it is now: the board's header — the title, the auto badge, and the sentence naming what forces manual work.

- [ ] **Step 4: Run the tests**

Run: `bun run test src/components/build-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** (the route still assigns `groups`; that is Task 4's job, and `check:type` will fail until then — so commit only after Task 4 if you are keeping every commit green. If you prefer green commits, fold Steps 1-4 into Task 4's commit and skip this step.)

---

### Task 4: The board replaces the panels

**Files:**
- Modify: `src/routes/combi-name/index.html`
- Modify: `src/routes/combi-name/index.css`
- Modify: `src/routes/combi-name/index.ts`
- Test: `src/routes/combi-name/index.test.ts`

**Interfaces:**
- Consumes: Task 1's `<entry-tile>`, Task 2's `<entry-tiles>`, Task 3's `<build-summary verdict>`.
- Produces: a page with `#build` holding the board's groups; no `<details class="panel">` except the reference table at the foot; `summaryCard.verdict` written by `render`.

- [ ] **Step 1: Write the failing route tests**

In `src/routes/combi-name/index.test.ts`, delete the three panel tests added by the collapsible-panels commit ("the loadout panel is the first of the build panels", "every build panel folds, and starts open", "jumping to a control unfolds the panel holding it") and the two card tests that read `.face` / `img` out of `#summary`. Add:

```ts
// One board: what the code says is the control that writes it, so there is no
// second copy of the build to keep in step.
test("the page has no build panels left", () => {
	expect(need("build").querySelectorAll("details.panel").length).toBe(0);
});

test("picking a cookie in its dialog writes the loadout section", async () => {
	const tile = need("cookie");
	const button = inside(tile).querySelector<HTMLButtonElement>("button.tile");
	button?.click();
	await settle();

	const cell = [
		...inside(tile).querySelectorAll<HTMLButtonElement>("button.entry"),
	].find((entry) => entry.value === "0O");
	cell?.click();
	await settle();

	expect(await codeText()).toBe("1C0O.1S00--000-");
	await reset();
});

test("the verdict still follows the flag slots", async () => {
	await choose("type", "auto");
	await choose("boosts", "fastStart");

	expect(shown(summary)).toContain("Semi-auto");
	expect(shown(summary)).toContain("Fast Start");
	await reset();
});
```

- [ ] **Step 2: Run them and watch them fail**

Run: `bun run test src/routes/combi-name/index.test.ts`
Expected: FAIL — the panels are still there and `button.tile` does not exist in the page's markup yet.

- [ ] **Step 3: Rewrite the page's markup**

Replace the whole `<form id="build">` block in `src/routes/combi-name/index.html` with the board. `<build-summary id="summary">` moves inside it, as the board's header:

```html
      <!-- One board: every value it shows is the control that writes it, so
           reading a code and building one are the same surface. -->
      <form id="build" class="board" novalidate>
        <build-summary id="summary"></build-summary>

        <div class="group">
          <h3>Loadout</h3>
          <div class="tiles">
            <entry-tile id="cookie" label="Cookie"></entry-tile>
            <entry-tile id="relay" label="Relay"></entry-tile>
            <entry-tile id="pet" label="Pet"></entry-tile>
          </div>
        </div>

        <div class="group">
          <div class="grouphead">
            <h3 id="treasures-heading">Treasures</h3>
            <chip-group
              id="treasureOrder"
              label="Order"
              class="switch"
            ></chip-group>
          </div>
          <div class="tiles">
            <entry-tiles id="treasure1"></entry-tiles>
            <entry-tiles id="treasure2"></entry-tiles>
            <entry-tiles id="treasure3"></entry-tiles>
          </div>
        </div>

        <div class="group">
          <h3>Run</h3>
          <chip-group id="type" label="Type"></chip-group>
          <chip-group id="episode" label="Episode"></chip-group>
          <card-group id="boosts" legend="Boosts"></card-group>
          <chip-group id="randomBoost" label="Random boost"></chip-group>
          <chip-group id="action" label="Action"></chip-group>
        </div>

        <div class="group">
          <h3>Cookie power+</h3>
          <card-group
            id="cookiePowers"
            legend="Cookies whose power+ is on"
          ></card-group>
        </div>
      </form>
```

Delete the standalone `<build-summary id="summary">` that sat above `.readout`, and the paragraph of loadout prose that lived in the old Loadout panel.

- [ ] **Step 4: Style the board**

In `src/routes/combi-name/index.css`, delete `.panel > summary`, `.panel[open] > summary`, `.panel > summary h2` (keep `.reference > summary h2` and `.reference summary`), `.tiles > [open]`, and the `.panel > chip-group` / `.panel > card-group` / `.panel > .tiles` / `.panel > :last-child` block. Add:

```css
/* The board is one box holding five groups, in the order the code reads. */
#build {
	display: block;
	min-width: 0;
	border: var(--cr-border) solid var(--cr-line);
	border-radius: var(--cr-radius);
	background: var(--cr-surface);
	box-shadow: var(--cr-block);
	padding: var(--cr-space-3) var(--cr-space-4) var(--cr-space-4);
}

.group {
	margin-top: var(--cr-space-4);
	border-top: 1px solid var(--cr-line);
	padding-top: var(--cr-space-3);
}

.group h3 {
	margin: 0 0 var(--cr-space-2);
	color: var(--cr-muted);
	font-family: var(--cr-mono);
	font-size: 0.7rem;
	font-weight: 500;
	letter-spacing: var(--cr-tracking);
	text-transform: uppercase;
}

/* The order switch rides on the Treasures heading, because it is what the slot
   labels under it are saying. */
.grouphead {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	justify-content: space-between;
	gap: var(--cr-space-2);
	margin-bottom: var(--cr-space-2);
}

.grouphead h3 {
	margin: 0;
}

.group > chip-group,
.group > card-group {
	display: block;
	margin-bottom: var(--cr-space-3);
}

.group > :last-child {
	margin-bottom: 0;
}

.tiles {
	display: grid;
	grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
	gap: var(--cr-space-2);
	align-items: start;
}
```

- [ ] **Step 5: Wire the route**

In `src/routes/combi-name/index.ts`:

- delete `summaryGroups`, `runItems`, `treasureItems`, `entryItem`, `faceFor` and the `SummaryFace` / `SummaryGroup` / `SummaryItem` type imports
- delete the unfolding lines in `jumpTo` (`const panel = owner.closest("details"); if (panel !== null) panel.open = true;`) and its comment
- in `render`, replace the two summary writes with one:

```ts
	summaryCard.verdict = describeCombi(full.combi).auto;
```

- drop the now-unused imports: `CatalogSection`, `entryName`, `FullCode`, `boostArt`, `cookiePowerArt`, `episodeArt` stay only if still used by the chip and card options (they are — `episodeArt`, `boostArt` and `cookiePowerArt` feed `options`; `CatalogSection`, `entryName` and `FullCode` do not, so remove those three).

- [ ] **Step 6: Run the route tests**

Run: `bun run test src/routes/combi-name/index.test.ts`
Expected: PASS.

- [ ] **Step 7: Run the whole suite and the checks**

Run: `bun run test && bun run format:biome && bun run check`
Expected: green, clean.

- [ ] **Step 8: Look at it in a browser**

Run: `bun run dev`, open `http://localhost:3000/combi-name/`, and check the three things the suite cannot:

1. a picker dialog opens above the sticky code panel, not behind it (the top layer should win; if it does not, the fix is removing `z-index` from `.codepanel`, not raising the dialog's)
2. the board's groups and tiles are laid out in both themes, light and dark
3. at 400px wide the tiles stack and nothing scrolls sideways

- [ ] **Step 9: Commit**

```bash
git add src/routes/combi-name src/components/build-summary.ts src/components/build-summary.test.ts
git commit -m "$(cat <<'EOF'
feat: merge the summary and the panels into one board

The page said the build twice: the card drew it, and the four panels
below held the controls that wrote it, each showing its pick again a
screen away. One board now does both - every value on it is the control
that writes it - and `<build-summary>` shrinks to the board's header,
since everything else it drew is a live control.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: The slot labels follow the order switch

**Files:**
- Modify: `src/routes/combi-name/index.ts`
- Test: `src/routes/combi-name/index.test.ts`

**Interfaces:**
- Consumes: Task 4's board.
- Produces: `<entry-tiles>`'s `legend` written by the route on every render — `Slot 1`/`Slot 2`/`Slot 3` when the order is exact, `Any slot` three times when it is not.

- [ ] **Step 1: Write the failing test**

```ts
// The switch says what the slots mean, so the slots say it too: a numbered
// slot claims a position the code only carries when the order is exact.
test("the order switch relabels the treasure slots", async () => {
	await choose("treasureOrder", "ordered");

	expect(need("treasure1").getAttribute("legend")).toBe("Slot 1");
	expect(need("treasure3").getAttribute("legend")).toBe("Slot 3");

	await choose("treasureOrder", "any");

	expect(need("treasure1").getAttribute("legend")).toBe("Any slot");
	expect(need("treasure3").getAttribute("legend")).toBe("Any slot");
	await reset();
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `bun run test src/routes/combi-name/index.test.ts -t "relabels"`
Expected: FAIL — the legends are empty, since nothing writes them.

- [ ] **Step 3: Write the legends in `render`**

In `src/routes/combi-name/index.ts`, inside `render`, after the code is decoded back:

```ts
	// A numbered slot claims a position, and the code only carries one when the
	// order is exact. The switch above the slots is what they are agreeing with.
	treasureSlots.forEach((slot, index) => {
		slot.setAttribute(
			"legend",
			full.loadout.ordered ? `Slot ${index + 1}` : "Any slot",
		);
	});
```

`legend` is an attribute-backed property on `<entry-tiles>`, and the route test harness cannot see an attribute the markup shipped — writing it here from the route is what makes it observable and what keeps the markup free of a label that is not always true.

- [ ] **Step 4: Run the test**

Run: `bun run test src/routes/combi-name/index.test.ts -t "relabels"`
Expected: PASS.

- [ ] **Step 5: Run the suite and the checks**

Run: `bun run test && bun run format:biome && bun run check`
Expected: green, clean.

- [ ] **Step 6: Commit**

```bash
git add src/routes/combi-name/index.ts src/routes/combi-name/index.test.ts
git commit -m "$(cat <<'EOF'
feat: let the treasure slots say whether their order counts

Slot 1, Slot 2, Slot 3 when the order is exact; three Any slots when it
is not. A numbered slot claims a position the code only carries one way,
and the switch on the heading is what the labels are agreeing with.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Bring the documentation up to the code

**Files:**
- Modify: `.claude/skills/ui-components/SKILL.md`
- Modify: `.claude/skills/combi-codec/SKILL.md`

**Interfaces:**
- Consumes: every earlier task.
- Produces: nothing code depends on.

- [ ] **Step 1: Update the element table and the prose in `ui-components`**

In the table, `<entry-tile>` loses `open` from its properties and `<entry-tiles>` loses it too; `<build-summary>` reads `| `<build-summary>` | — | `verdict` |`.

Replace the paragraph describing the two catalog controls' `<details>`, their `open` reflection and their outside-`pointerdown` closers with one describing the modal: each renders a tile button on its host and a `<dialog>` opened with `showModal()`; the platform supplies the backdrop, the focus trap and Escape, so nothing in the component closes it from outside; `<entry-tiles>` holds a draft selection that only Done commits, which is why Escape leaves a slot untouched; and the per-chip remove button is gone, because a tile is a button.

Rewrite the `<build-summary>` paragraph: it is the board's header now — title, auto badge, verdict sentence — and the groups it used to draw are the board's own live controls.

- [ ] **Step 2: Update the page description in `combi-codec`**

In the "One code, one state" section, say that the page is one board: the controls are what it shows, so there is no second rendering of the build to keep in step. Note that the treasure slots' legends are written by `render` from the order flag.

- [ ] **Step 3: Check the docs against the code**

Run: `bun run test && bun run check`
Expected: green, clean (docs do not affect either, but this is the last gate before the branch is done).

- [ ] **Step 4: Commit**

```bash
git add .claude/skills
git commit -m "$(cat <<'EOF'
docs: describe the board and the modal pickers

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
| --- | --- |
| The board's five parts | 4 |
| `<entry-tile>` details to dialog | 1 |
| `<entry-tiles>` details to dialog, draft, Done/Clear/Escape | 2 |
| Per-chip remove button removed | 2 |
| `open` reflection and `.tiles > [open]` deleted | 1, 2, 4 |
| `<chip-group>` / `<card-group>` unchanged, Action stays two chips | 4 (markup only) |
| `<build-summary>` shrinks to the header | 3 |
| Data flow unchanged; `jumpTo` keeps `OWNER`, loses the unfolding | 4 |
| Order switch on the heading, slot labels following it | 4 (switch), 5 (labels) |
| Deletions list | 3, 4 |
| Accessibility: tile names, native modal, aria-live header | 1, 2, 4 |
| Testing plan | 1, 2, 3, 4, 5 |
| Risk: dialog above the sticky panel | 4, Step 8 |

**Placeholder scan:** none — every step carries the code or the exact edit.

**Type consistency:** `Verdict` is the only type crossing a task boundary (Task 3 keeps it exported, Task 4's route assigns `describeCombi(...).auto` to it, structurally assignable as today). `Option` stays each component's own. `legend` and `label` are attribute-backed strings in both directions.
