# Combi workbench layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-lay the combi-name page as the owner's workbench, with a top bar
in place of the sidebar on every page. The combi page reads, top to bottom:

- the top bar, with Saved and Help on the right,
- a sticky code panel (a bottom dock on phones),
- warnings,
- the note,
- a clickable summary,
- tabs (Main | Cookies | Treasures | Boosts) holding the controls,
- Saved codes and Help in modal side drawers.

**Architecture:**
- The page keeps its one `render` over one `FullCode`.
- New components: `<tab-strip>` and `<entry-grid>`.
- A rewritten `<build-summary>` draws rows the route builds.
- `<site-nav>` becomes a top bar.
- `<code-bar>` gains inert runs.
- A pure route module, `summary.ts`, builds those rows from the decoded code.
- Everything else is moved markup and rewiring in `index.html`, `index.ts` and
  `index.css`.

**Tech Stack:** Bun, Lit 3 (`lit/decorators.js`, plain fields, `override`), happy-dom tests via `bun test`, Biome, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-23-combi-workbench-layout-design.md`

## Global Constraints

- No change to `codec.ts`, `loadout.ts`, `full-code.ts`, `describe.ts`, `hints.ts`, `labels.ts`, `saved.ts` storage, or the share-link format.
- Every control keeps its id.
- Episode, cookie, relay and pet move to `<entry-grid>`, and random boost to `<chip-group>`.
- Treasures stay `<entry-tiles>`. Boosts and powers stay `<card-group>`.
- Components never import from `src/routes/`, and declare their own types.
- Colours come only from `--cr-*` tokens.
- Every `customElements.define` is guarded, and the tag is augmented in `HTMLElementTagNameMap`.
- Every `localStorage` access is wrapped in try/catch.
- New tab key: `combi-name:tab`, with values `main | cookies | treasures | boosts`.
- Breakpoint: phone is `width < 48rem`.
- Copy, verbatim:
  - Note label: "Note · new code" / "Note · editing a saved code".
  - Warning banner title: "Read with changes".
  - Summary hint: "Nothing else picked yet. Choose a cookie, boosts or treasures in the tabs below."
  - Disabled reasons: "`<Episode label>` takes no boosts." / "`<Episode label>` takes no treasures."
- Conventional, lower-case commits scoped `combi-name` or `components`, ending with the attribution line from the session.
- Before every commit: `bun run format && bun run check && bun run test`.

## Review Focus

1. **The stored tab becomes disabled, then the episode changes back.**
   - Expected: Main shows while the stored tab is disabled. Picking an episode
     that has it reopens the stored tab, and storage never holds "main" because
     of the fallback.
   - Test: Task 7.
2. **A saved code that no longer decodes is loaded.**
   - Expected: the drawer stays open and the error shows in `#saved-status`
     inside the drawer, not behind the modal.
   - Test: Task 9.
3. **A relay is held but the episode takes none** (special1/2/Exp).
   - Expected: the summary's Cookies row shows no `→` relay, and the Cookies
     badge doesn't count it.
   - Test: Tasks 6 and 7.
4. **A code carries a hidden (consumable) treasure.**
   - Expected: the summary still shows its picture and its name in the title,
     through `imageFor` / `labelFor`.
   - Test: Task 6.
5. **A code letter for slots 5–9 on a special episode.**
   - Expected: the letter is not a button at all, so there's nothing to click.
   - Test: Task 7.

---

### Task 1: Tab memory in `state.ts`

**Files:**
- Modify: `src/routes/combi-name/state.ts`. Remove `BOARD_KEY`, `boardCollapsed` and `rememberBoardCollapsed`, and add the tab functions.
- Test: `src/routes/combi-name/state.test.ts`. Remove the board tests and add tab tests.

**Interfaces:**
- Produces:
  - `export const TAB_KEY = "combi-name:tab"`
  - `export type TabName = "main" | "cookies" | "treasures" | "boosts"`
  - `export const TAB_NAMES: readonly TabName[]`, in that order.
  - `export function storedTab(storage: Storage): TabName`, which returns `"main"` for missing, unknown or throwing storage.
  - `export function rememberTab(storage: Storage, tab: TabName): void`, which swallows throws.

- [ ] **Step 1: Write failing tests.**
  - `"a remembered tab is read back"`: `rememberTab(s, "treasures")` then `storedTab(s) === "treasures"`.
  - `"an unknown or missing tab reads as main"`: stored `"nope"` reads `"main"`, and empty storage reads `"main"`.
  - `"a storage that throws reads main and remembers nothing"`: use a Storage stub whose methods throw. Neither call throws.
- [ ] **Step 2:** Run `bun run test src/routes/combi-name/state.test.ts`. Expected: FAIL, `storedTab` is not exported.
- [ ] **Step 3:** Implement the functions, and delete the board functions and their tests. The route still imports the board functions, so `check:type` fails until Task 7. That is expected; only this file's tests need to pass at this point.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(combi-name): remember the open tab`. If the route's type errors block the hook, fold this commit into Task 7's.

### Task 2: `<tab-strip>` component

**Files:**
- Create: `src/components/tab-strip.ts`
- Test: `src/components/tab-strip.test.ts`

**Interfaces:**
- Produces:
  - `export type TabOption = readonly [value: string, label: string, badge: string, disabled: string | null]`. `disabled` is the reason, or null.
  - `export class TabStrip extends LitElement`, registered as `tab-strip`. Properties: `options: readonly TabOption[]` and `value: string`. It renders whatever `value` says, and the route decides what is shown.
  - It fires `new CustomEvent<string>("tab-change", { detail: value, bubbles: true })` on a user pick only, never `input` and never on a property write.
  - Markup in the shadow root:
    - `<div role="tablist" part="list">`.
    - One `<button role="tab" aria-selected aria-disabled title=reason>` per option.
    - Each button shows its label, then `<span class="badge">` when the badge is non-empty.
    - Roving tabindex: only the selected tab has `tabindex=0`.

- [ ] **Step 1: Write failing tests.** Use the `settle()` helper pattern from `chip-group.test.ts`.
  - `"draws a tab per option with its badge"`: there are 4 tabs, and the Treasures tab's text includes `2/3`.
  - `"marks the value selected"`: `aria-selected="true"` is set on the value's tab only.
  - `"a click on a tab fires tab-change with its value and no input"`: a listener on `input` is never called.
  - `"a disabled tab says why and cannot be picked"`: it has `aria-disabled="true"` and its `title` is the reason. Clicking it fires nothing.
  - `"arrow keys move the pick and skip disabled tabs; Home and End go to the ends"`. ArrowRight from `main`, with `treasures` disabled, fires `tab-change` for `cookies`, then for `boosts`. The walk is clamped, not wrapped.
  - `"setting value fires nothing"`.
- [ ] **Step 2:** Run `bun run test src/components/tab-strip.test.ts`. Expected: FAIL, the module is not found.
- [ ] **Step 3:** Implement it.
  - Styles: `base` and `controls` from `./theme`.
  - Tabs: mono uppercase with a bottom border line. The selected tab is on `--cr-surface`. The badge is a small box, and on the selected tab it sits on `--cr-accent`.
  - Arrow handling: copy `<chip-group>`'s clamped walk, then focus the new tab after `updateComplete`.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(components): add tab-strip`.

### Task 3: Inert runs in `<code-bar>`

**Files:**
- Modify: `src/components/code-bar.ts`
- Test: `src/components/code-bar.test.ts`

**Interfaces:**
- Produces: `CharHint` gains `inert?: boolean`. Runs are grouped as today. A run whose first hint is `inert` renders as a `<span class="run inert">` that keeps the run's `data-tooltip`, takes no tabindex and fires no `slot-jump`.

- [ ] **Step 1:** Write the failing test `"an inert run is drawn as text and does not jump"`. Hints for `"1HM3"` with the version run inert give 1 `span.inert` and 3 buttons. Clicking the span fires no `slot-jump`.
- [ ] **Step 2:** Run `bun run test src/components/code-bar.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement it. Match the button run's look minus the hover, pointer and focus styles.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(components): code-bar runs that do not jump`.

### Task 4: `<entry-grid>`, an inline single-pick grid

**Files:**
- Create: `src/components/entry-grid.ts`
- Test: `src/components/entry-grid.test.ts`

**Interfaces:**
- Consumes: `tileStyles` and `glyphFor` from `./entry-tile`.
- Produces:
  - `export type Option = readonly [value: string, label: string, image: string | null]`.
  - `class EntryGrid`, registered as `entry-grid`. Properties:
    - `options: readonly Option[]`;
    - `value: string | null`, with a getter that returns null when the value is not among the options;
    - `required = false`, which drops the None cell;
    - `searchable = false`;
    - `label = ""`, the aria-label of the `role="listbox"` grid.
  - Each cell is `<button role="option" aria-selected>` whose `.value` is the option value, and `""` for None.
  - A pick sets `value` and dispatches `new Event("input", { bubbles: true })` from the host.
  - The search `<input>`'s own `input` event is stopped at the shadow root.

- [ ] **Step 1: Write failing tests.**
  - `"draws every option inline with None first"`, with 60 options: 61 cells and no 50 cap.
  - `"required drops the None cell"`.
  - `"a pick sets value and fires input"`.
  - `"typing in the search narrows the cells and fires no input"`.
  - `"a value its options lack reads as null"`.
  - `"arrow keys, Home and End move focus across the cells, clamped"`. Copy `entry-tile.test.ts`'s roving test, without the dialog.
- [ ] **Step 2:** Run `bun run test src/components/entry-grid.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Implement it. Cells use `tileStyles`' grid-cell look: art, then name. The grid is `grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr))` with `grid-auto-rows: max-content`, the WebKit note in the `ui-components` skill.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(components): entry-grid`.

### Task 5: `<site-nav>` as a top bar

**Files:**
- Modify: `src/components/site-nav.ts` and `src/components/site-nav.test.ts`.
- Modify: `src/routes/base.css` (body grid) and `src/routes/index.html` (the home pane, if its markup assumes the rail).

**Interfaces:**
- Produces: `<site-nav>` renders, in order:
  - `<a class="brand" href=home>` with the Fairy Cookie icon and "Cookie Run tools". The text is hidden under 48rem.
  - `<details class="switcher">` with a `<summary>` reading the current tool's `name`, or "All tools" when `current` is empty, then ▾.
  - Inside it, `<nav aria-label="Tools">` holding:
    - an "All tools" link to home;
    - a "Tools" divider;
    - one link per `TOOLS` entry, holding its name and tagline, through `hrefFor`.
  - The current link carries `aria-current="page"`. The menu closes on a link click, on Escape (focus back to the summary) and on a click outside the host.
  - `<slot>`, then `<theme-toggle>`.
  - The icon is an `<img>` with `src` taken from a new optional `icon` attribute or property, set by the page. The home page uses the same `ch26.png` its favicon uses. Without one, the brand is drawn as text only.
  - The host is `display: flex; align-items: center` with a bottom border on `--cr-surface`, at every width. Remove the rail rules.
- `base.css`: `body` becomes `grid-template-columns: minmax(0, 1fr)` with rows `auto auto 1fr`. Remove the `< 48rem` override and the footer comment about the rail.

- [ ] **Step 1: Write failing tests.**
  - `"renders the brand, the tool menu and the theme toggle in one bar"`.
  - `"the tool menu names the current tool, and All tools on the home pane"`.
  - `"the menu lists All tools then every registered tool with its tagline, the current one marked"`.
  - `"the menu closes on Escape and returns focus to its button"`.
  - `"slotted page actions render inside the bar"`. Append a `<button>` to `<site-nav>`. It is assigned to the slot: `shadowRoot.querySelector("slot").assignedElements()` includes it.
- [ ] **Step 2:** Run `bun run test src/components/site-nav.test.ts src/lib/tools.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run the same command. Expected: PASS.
- [ ] **Step 5:** Commit `feat(components): site-nav is a top bar with a slot for page actions`.

### Task 6: `<build-summary>` rewrite and the route's `summary.ts`

**Files:**
- Rewrite: `src/components/build-summary.ts` and `src/components/build-summary.test.ts`. The old verdict and fold contract goes.
- Create: `src/routes/combi-name/summary.ts` and `src/routes/combi-name/summary.test.ts`.

**Interfaces:**
- Produces, in the component:
  - `export type SummaryItem`, a union:
    - `{ kind: "text"; text: string; muted?: boolean }`
    - `{ kind: "pill"; text: string; tone?: "semi" }`
    - `{ kind: "image"; src: string | null; text?: string; title?: string; badge?: string; note?: string }`. A `src` of null draws only the text. `badge` is drawn as the `+N` corner badge. `note` is the small level text.
    - `{ kind: "stack"; srcs: readonly string[]; text: string }`, for at most two overlapping faces.
    - `{ kind: "sep"; text: "·" | "→" }`
    - `{ kind: "tag"; text: string }`
  - `export type SummaryRow = { label: string; target: string; items: readonly SummaryItem[] }`
  - `class BuildSummary`. Properties: `rows: readonly SummaryRow[]`, `compact: readonly SummaryItem[]` and `hint: string | null`. Private state: `expanded = false`.
  - Each row is `<button class="row" data-target>` with `<span class="label">` and `<span class="value">`. A click fires `new CustomEvent<string>("summary-jump", { detail: target, bubbles: true })`.
  - It also renders `<button class="line">`, the compact items plus ▾. Tapping it sets `expanded`. A "Hide ▴" `<button class="hide">` above the rows clears it.
  - The host reflects the `expanded` attribute. CSS: under `@media (width < 48rem)`, `:host(:not([expanded])) .rows` is hidden, and `.line` shows only on a phone when not expanded. It never fires `input` or `toggle`.
- Produces, in the route:
  - `export function summaryOf(full: FullCode, base: string): { rows: SummaryRow[]; compact: SummaryItem[]; hint: string | null }` in `summary.ts`.
  - The targets are the `hints.ts` group names: `mode`, `cookie`, `treasures`, `boosts`, `randomBoost` and `cookiePowers`.

- [ ] **Step 1: Write failing component tests.**
  - `"draws a row per entry with its label and items"`.
  - `"an image item draws its picture, badge and note"`.
  - `"clicking a row fires summary-jump with its target"`.
  - `"the compact line expands the rows and Hide folds them"`: checks the `expanded` attribute.
  - `"draws the hint when given"`.
  - `"fires no input"`.
- [ ] **Step 2: Write failing `summary.test.ts`.** Build each `FullCode` with `decodeFull`, or by hand with `treasurePick` and `levelRange`. Use base `"../assets/"`.
  - `"rows follow the tabs: Run, Cookies, Treasures, Boosts, Random boost, Power+"`. Use a full build: auto, money, episode3, HP + Power Jelly, revive, fairy + seaFairy, jump, with a cookie, relay, pet and 2 treasure slots. The labels come out in exactly that order.
  - `"Run says semi-auto and why, then goal, episode and action"`:
    - The items include a pill with text `"Semi-auto"` and `tone: "semi"`.
    - They include a muted text equal to `describeBuild(full).reasons.join(", ")`.
    - They include texts `"Money"` and `"Episode 3"`, and `"Jump at start"` last.
  - `"a manual run's Run row has no action and a Manual pill"`.
  - `"the tower's Run row names the floor"`: `"Special Episode 2, floor 42"` and `"…, any floor"`.
  - `"Cookies reads cookie → relay · pet, and drops the relay where the episode takes none"`. On specialExp there is no `→` sep.
  - `"Any reads as its catalog label"`: the cookie `anyIdFor("cookies")` reads `"Any cookie"`.
  - `"a treasure slot shows its first pick, +N for alternatives, and levels only when not +0"`:
    - A slot `[pick(a, 3–9), pick(b, 5–9)]` gives an image item with `badge: "+1"` and `note: "+3–9"`, and a title containing `" or "`.
    - A slot `[pick(c)]` has no badge and no note.
  - `"exact order puts → between slots and an exact order tag"`, with `ordered: true` and 2 slots.
  - `"a hidden treasure still has its picture and name"`. Take a consumable id from `assets/index.json`: the first treasure whose `family` is `"consumable"`. Its image `src` ends with `imageFor`'s path, and its title includes `labelFor`.
  - `"empty rows are left out and the hint shows for a bare build"`. `decodeFull("10S0000000")` gives the Run row only, and `hint` equals the copy from Global Constraints.
  - `"a special episode leaves out the boost rows and an Exp episode the treasures row"`.
  - `"compact carries the mode pill, goal, episode icon, faces and the boost count"`. Its last text is `"5 boosts"` for the full build: 2 boosts + 1 random + 2 powers.
- [ ] **Step 3:** Run `bun run test src/components/build-summary.test.ts src/routes/combi-name/summary.test.ts`. Expected: FAIL.
- [ ] **Step 4:** Implement both.
  - `summary.ts` builds its words only from `labels.ts` and `describe.ts`, using `describeBuild` and `floorText` with `.toLowerCase()` after the comma.
  - Pictures come from `art.ts` and `catalog.ts`, through the base.
  - Power+ names drop a trailing `" Cookie"`.
  - The mode word: Manual for a manual run, else Semi-auto when `describeBuild(full)?.semi`, else Auto.
- [ ] **Step 5:** Run the same command. Expected: PASS.
- [ ] **Step 6:** Commit `feat(combi-name): a summary of the build that leads to its controls`.

### Task 7: Page structure, tabs, summary wiring and jumping

**Files:**
- Modify: `src/routes/combi-name/index.html`:
  - Remove `.readout`, the `<build-summary>` inside `#build` and the band headers.
  - Add the toolbar, the warnings banner, the summary, the tab strip and the panels, as below.
- Modify: `src/routes/combi-name/index.ts`.
- Modify: `src/routes/combi-name/index.test.ts`:
  - Remove `"the build summary sits inside the board…"`, `"the board's heading folds…"`, `"jumping to a slot opens a folded board first"`, `"the build panels are gone…"` and `"the loadout sits between the run and the boosts"`.
  - Keep every other test passing.

**Markup**, inside `main` after `.codepanel`:
1. In `<site-nav current="combi-name">`, as slotted children:
   - `<button id="open-saved">Saved <span id="saved-count"></span></button>`.
   - `<button id="open-help">Help</button>`. Wired in Task 9; until then it opens nothing.
2. `<section id="warnings-banner" class="banner" hidden>` holding `<strong>Read with changes</strong>` and the existing `<ul id="warnings">`.
3. The note form, moved in Task 8. For now leave it where it is.
4. `<build-summary id="summary">`.
5. `<tab-strip id="tabs">`.
6. `<form id="build" novalidate>` holding four `<section role="tabpanel" id="panel-main|panel-cookies|panel-treasures|panel-boosts" data-tab aria-label="Main|Cookies|Treasures|Boosts">` sections. The existing `.field` divs move into them:
   - Main: mode (with a new `<p id="verdict" class="verdict">` under the chips), goal, `<entry-grid id="episode">` (replacing the `<entry-tile>`, set `required` and not searchable), floor and action.
   - Cookies:
     - `<div id="roles" class="roles">` holding three light-DOM `<button class="role" data-role="cookie|relay|pet" aria-pressed>`, drawn by the route. Each shows an `<img>` or a dashed placeholder, a `<small>` role name, and the label from `labelFor`, or "None". Between them sit `<span class="arrow" aria-hidden="true">→</span>` and `·`.
     - `#relay-note`.
     - `<button id="role-clear" type="button">Clear</button>`.
     - Three `<entry-grid id="cookie|relay|pet" searchable>` elements, only the selected role's not hidden.
   - Treasures: `#field-treasures`.
   - Boosts: boosts, `<chip-group id="randomBoost">` (replacing the tile, `resettable`, options `[["", "None"], …ALL_RANDOM_BOOSTS]`) and cookiePowers.

**Interfaces:**
- Consumes: Task 1's `storedTab`, `rememberTab`, `TabName` and `TAB_NAMES`; Task 2's `TabStrip` and `TabOption`; Task 6's `summaryOf` and `BuildSummary`.
- Produces, in `index.ts` (later tasks call these):
  - `const TAB_OF: Record<string, TabName>`, mapping every `OWNER` key: goal/mode/episode/floor/action go to main, cookie/relay/pet to cookies, treasures to treasures, and boosts/randomBoost/cookiePowers to boosts.
  - `function disabledReason(tab: TabName, episode: Episode): string | null`.
  - `function showTab(): void`, which shows the stored tab, or `main` when it is disabled.
  - `jumpTo(group)`. If the tab is disabled it returns. Otherwise it selects the tab with `rememberTab`, calls `showTab()`, scrolls and focuses.
- `render()` additionally does these, all from the decoded `full`:
  - `summaryCard.rows/compact/hint = summaryOf(full, ASSET_BASE)`.
  - `#verdict` text: empty for a manual run. Otherwise "Plays as semi-auto because of X, Y." or "Plays itself all the way: full auto."
  - `tabs.options` with badges:
    - Cookies: the count of cookie, relay (only if `limits.relay`) and pet that are non-null, `""` at 0.
    - Treasures: `` `${n}/3` `` when the episode takes treasures, else `""`.
    - Boosts: the count, `""` at 0.
  - `warnings-banner.hidden = warnings.length === 0`.
  - `showTab()`.
- `readForm` reads the random boost as `randomBoostChips.value === "" ? null : value`. `writeForm` writes `combi.randomBoost ?? ""`.
- Role cards: `let role: "cookie" | "relay" | "pet" = "cookie"`, held in memory. A role card click sets it, and if the relay is not available it stays on cookie. Clear sets that grid's `value = null` and re-renders. `jumpTo("cookie" | "relay" | "pet")` sets `role` too.
- Hints: `codeBar.hints = hintsFor(code).map(h => ({ ...h, inert: !(h.group in OWNER) || disabledReason(TAB_OF[h.group], episode) !== null }))`.
- Remove `foldBoard`, `boardCollapsed` and the `summaryCard` toggle listener. `summary-jump` calls `jumpTo(detail)`, and `tab-change` calls `rememberTab` then `showTab()`.

- [ ] **Step 1: Write failing route tests** in `index.test.ts`:
  - `"picking a tab shows its panel and remembers it"`: click the Boosts tab in `tabs`' shadow root. Only `#panel-boosts` is not hidden, and `localStorage.getItem("combi-name:tab") === "boosts"`. Reading the tab back on load is covered by Task 1's `storedTab` tests, plus one line in `index.ts` that calls `storedTab(localStorage)` at startup.
  - `"clicking a summary row opens its tab and focuses the control"`: click the Treasures row, and `#panel-treasures` is not hidden with `document.activeElement === need("treasure1")`.
  - `"clicking a run of the code opens the tab that holds its control"`: dispatch `slot-jump` `"randomBoost"`, and `#panel-boosts` is shown.
  - `"a special episode disables the boosts tab, shows Main, and reopens Boosts when the episode changes back"`: Review Focus 1. Storage still says `"boosts"` while Main is shown.
  - `"a code's unused parts are not clickable"`. On special2, every hint whose group is boosts, randomBoost, cookiePowers or reserved, and the version and loadoutVersion hints, has `inert: true`, read from `codeBar.hints`. On episode3 the boosts hints are not inert. Review Focus 5.
  - `"a role card picks which grid the Cookies tab shows, and a pick writes the code"`. Click the Relay card: only `#relay` is shown. Pick a cell in it: the code gains an `R` group and the card shows the name.
  - `"the relay card is off where the episode takes none"`.
  - `"Clear empties the selected role"`.
  - `"the random boost chips write slot 6 and None puts it back to 0"`. Adapt the existing `"picking None puts the random boost back to none"` test.
  - Adapt every existing test that opened an `<entry-tile>` dialog (`"picking a cookie in its dialog…"`, `"picking Any…"`) to click the inline `<entry-grid>` cells instead.
  - `"the tab badges count what is set"`: a full code gives `["","2","2/3","5"]`, read from `tabs.options`.
  - `"the relay is not counted where the episode takes none"`: Review Focus 3.
  - `"the summary follows the code"`: after a goal click, the Run row's text includes the new goal.
  - `"the verdict sits under the mode chips"`.
  - `"a contradicting code shows the warnings banner, and it hides again"`, adapting the two existing warning tests.
- [ ] **Step 2:** Run `bun run test src/routes/combi-name/index.test.ts`. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement the markup and wiring. Keep the `.field` ids, the `.fieldhead` headings and the slot markers.
- [ ] **Step 4:** Run `bun run test src/routes/combi-name` and `bun run check:type`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(combi-name): tabs and a summary in place of the three bands`.

### Task 8: The code panel's buttons and the note at the top

**Files:**
- Modify: `index.html`, `index.ts`, `index.test.ts` in `src/routes/combi-name/`.

**Markup:**
- The code bar slot holds, in order:
  - `#copy-link` (unchanged);
  - `<button id="save" type="submit" form="save-form">Save</button>`;
  - `<details id="code-menu" class="more">` with `<summary class="moretoggle" aria-label="More actions">⋯</summary>` and `<div class="menu">` holding `#reset`, `#save-new` and `#save-cancel`. The last two are `hidden` unless editing.
- `#link-status` is removed.
- `#save-form` moves to right after the warnings banner. It contains:
  - `<label for="save-description" id="note-label" class="eyebrow">`;
  - the textarea;
  - `#save-editing`;
  - `#save-status`.
- The old `.savebuttons` div goes.

**Interfaces:**
- Copy link failure: `codeBar.message = "The browser blocked the clipboard. Copy the address bar by hand."` and `codeBar.invalid = true`.
- Menu closing: generalise `closeMenus` to `document.querySelectorAll("details.more[open]")`, and listen for `toggle` (capture) and Escape on `document`. Every pick inside `#code-menu` closes it.
- `showEditing` also sets `#note-label` text from the Global Constraints copy.

- [ ] **Step 1: Write failing tests:**
  - `"the save button in the code panel submits the note"`. Type in `#save-description` and click `#save`, and the entry is saved. Adapt the existing `"saving the code lists it…"` test to this.
  - `"Reset, Save as new and Cancel sit in the code panel's menu"`. `need("reset").closest("#code-menu")` is not null. `#save-new` and `#save-cancel` are hidden until a Load.
  - `"picking from the code menu closes it"`.
  - `"the note's label says when a saved entry is open"`.
  - `"a blocked clipboard says so on the code bar"`. Replace the existing `"a blocked clipboard writes the instruction into the status line"` test.
  - `"the page's buttons ride in the code bar's row"`. Update the expected children: `copy-link`, `save` and `code-menu`.
- [ ] **Step 2:** Run the file. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run `bun run test src/routes/combi-name` and `bun run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(combi-name): save from the code panel, note at the top`.

### Task 9: Saved and Help drawers

**Files:**
- Modify: `index.html`, `index.ts`, `index.test.ts` in `src/routes/combi-name/`.

**Markup**, both before `</main>`:
- `<dialog id="saved-drawer" class="drawer" aria-labelledby="saved-heading">`. Inside:
  - `<header>` with `<h2 id="saved-heading">Saved codes</h2>` and `<button class="close" data-close>Close</button>`.
  - `<p id="saved-status" class="status" role="status">`.
  - The existing `#saved-empty`, `#saved-list` and Import and export `<details class="transfer">`, moved as they are.
  - Remove the old `<section class="panel saved">`.
- `<dialog id="help-drawer" class="drawer" aria-labelledby="help-heading">`. Inside:
  - a header the same way, titled "How codes read";
  - the masthead's intro paragraph, moved out of `.masthead`, which keeps only its `<h1>`;
  - the old `.tip` paragraph;
  - the body of the old `<details class="panel reference">`: the diagram, tables and notes, without the `<details>`/`<summary>`.

**Interfaces:**
- `function openDrawer(dialog: HTMLDialogElement): void`: `showModal()` plus `lockPageScroll()` from `#components/entry-tile`, storing the unlock.
- `close` restores scroll. A click on the dialog closes it only when the pointerdown also landed on the dialog, the same press latch `<entry-tile>` uses. Any `[data-close]` button closes it.
- `#open-saved` opens the saved drawer, and `#open-help` the help drawer. `#saved-count` text is `String(savedEntries.length)`.
- Messages:
  - The saved-list handler writes to `#saved-status`, not `#save-status`, for Copy link, Share, Delete and storage refusals.
  - A successful Load closes the drawer first, then writes "Loaded X." to `#save-status`.
  - A failed Load (`openSaved` returns false) keeps the drawer open and writes to `#saved-status`.
- After deleting the last entry, focus goes to the drawer's Close button.

- [ ] **Step 1: Write failing tests.** happy-dom may lack `showModal`. If so, stub `HTMLDialogElement.prototype.showModal` and `close` at the top of the test, the way the `entry-tile` tests do.
  - `"Saved opens a drawer that lists the saved codes, and its count follows the list"`.
  - `"loading from the drawer closes it and says so by the note"`.
  - `"a saved code that no longer reads keeps the drawer open and says so inside it"`. Store a hand-written entry `{ code: "1ZZZZZZZZZ", description: "", savedAt: … }` in `localStorage` under `saved.ts`'s key. Review Focus 2.
  - `"deleting the last entry moves focus to the drawer's Close button"`.
  - `"copying an entry's link reports inside the drawer"`. Adapt the existing test.
  - `"Help holds the slot reference and the page intro"`. `#help-drawer` contains the text "Reading" or the diagram `pre.diagram`, and the intro sentence "A combi name holds 10 characters".
  - Adapt every existing saved-list test that read `#save-status` for a drawer action.
- [ ] **Step 2:** Run the file. Expected: the new tests FAIL.
- [ ] **Step 3:** Implement it.
- [ ] **Step 4:** Run `bun run test` (whole suite) and `bun run check`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(combi-name): saved codes and help in drawers`.

### Task 10: Layout CSS

**Files:**
- Modify: `src/routes/combi-name/index.css`.
- Modify: `src/routes/base.css`, only if `main`'s grid rules there block the dock. Prefer route CSS.

Layout and colour are not testable in happy-dom, so this task has no unit test. Every rule below is listed as a preview check in the PR.

- [ ] **Step 1: Write the rules.**
  - **Desktop:** `.codepanel` stays sticky at the top.
  - **Phone** (`< 48rem`):
    - `main` is a grid. `.codepanel` gets `order: 99; position: sticky; bottom: 0`, with a padding bottom of `calc(var(--cr-space-2) + env(safe-area-inset-bottom, 0px))`.
    - Verify in a narrow browser that it sits at the bottom and doesn't cover the last control. If sticky-bottom fails, fall back to `position: fixed; inset: auto 0 0` plus `main { padding-bottom: 9rem }`.
  - **`tab-strip`:** `position: sticky; top: var(--codepanel-h, 0px)` on desktop and `top: 0` on a phone, on `--cr-bg`. In `index.ts`, add a `ResizeObserver` on `.codepanel` that sets `--codepanel-h` on `document.documentElement`, guarded by `typeof ResizeObserver !== "undefined"`.
  - **`.roles`:** a flex row, wrapping. `.role[aria-pressed=true]` gets the accent border and `box-shadow: 3px 3px 0 var(--cr-accent)`, as in the mockup.
  - **`.banner`:** a bordered box using `--cr-blessed` (amber) mixed over `--cr-surface`.
  - **`#save-form`:** a grid with a small gap.
  - **`[role=tabpanel]`:** a grid with a gap.
  - **`.tiles` in the Cookies panel:** a flex row, wrapping, centred on the cross axis.
  - **`.drawer`:**
    - `position: fixed; inset: 0 0 0 auto; margin: 0; height: 100%; max-height: none; width: min(22rem, 90vw)`, with a border on the left and the background from `--cr-surface`;
    - `::backdrop` on `--cr-backdrop`;
    - an inner scroll area, with the header sticky.
  - **`#code-menu`:** reuse the saved row's `.more` and `.menu` styles. Make sure the menu opens upward on a phone (`bottom: 100%`) and downward on desktop.
  - Remove the rules for `.readout`, `.tip`, `.band`, `.bandhead` and `#build[data-collapsed]`.
- [ ] **Step 2:** Run `bun run dev` and check it at 1280px and at 390px:
  - the dock;
  - the sticky tab strip;
  - the drawer;
  - the summary fold (at 390px);
  - the treasure dialog above the dock;
  - both themes.
- [ ] **Step 3:** Run `bun run format && bun run check && bun run test && bun run build`. Expected: all pass.
- [ ] **Step 4:** Commit `style(combi-name): the workbench layout`.

### Task 11: Docs, then ship

**Files:**
- `README.md`: the paragraph at line 187 about the board in three bands, and the one at line 191 about Saved codes under the board.
- `.claude/skills/combi-codec/SKILL.md`: "One code, one state" now has a summary from the same render. Drop the board header, badge and fold mentions, and add `summary.ts` to the route-only list.
- `.claude/skills/ui-components/SKILL.md`:
  - The element table: `<build-summary>`, `<tab-strip>`, `<entry-grid>`, `<site-nav>` with its slot, `CharHint.inert`, and `<entry-tile>` removed.
  - Replace the paragraphs on `<build-summary>`, on the dialogs, on the rail and on the body rows.
- `AGENTS.md`: the layout bullet that says "the sidebar layout".
- Remove the `<entry-tile>` element and its test file if nothing imports the element any more. Keep `tileStyles`, `glyphFor` and `lockPageScroll` exported, from `entry-tile.ts` or moved to `tile.ts`.

- [ ] **Step 1:** Make the edits.
- [ ] **Step 2:** Run `bun run format && bun run check && bun run test && bun run build`. Expected: all pass.
- [ ] **Step 3:** Commit `docs(combi-name): describe the workbench layout`.
- [ ] **Step 4:** Push, then open the PR and wait for the preview, per the `shipping-a-change` skill steps 6–8. The PR's test plan lists every Task 10 check unticked.
