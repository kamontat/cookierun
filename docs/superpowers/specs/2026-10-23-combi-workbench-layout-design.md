# Combi page: workbench layout

The owner's design, worked out across several clickable mockups
(the last one: https://claude.ai/code/artifact/9b8c09e0-98af-4e9d-b806-d38568ea3df8).
This document turns it into something a builder can plan from.

## Why

Today the combi-name page is one long column: the sticky code panel, three
bands of controls, then the saved codes, then a folded reference table. Saving
a build means scrolling past every control, a phone gives the sticky code
panel half the screen, and the only way to read a whole build at a glance is
to scroll the board.

The new layout keeps the code in reach, puts the note and a readable summary of
the build at the top, and splits the controls into tabs so the page is short.

## Goals

- The code and its actions are always on screen: pinned to the top on desktop,
  docked at the bottom on a phone.
- Under it, in this order: warnings (when there are any), the note, a summary
  of the build, a tab bar, and the open tab's controls.
- The summary reads the whole build at a glance, with pictures, and every line
  of it is a way to the control behind it.
- Clicking a letter in the code, or a line of the summary, switches to the tab
  that holds the control and focuses it.
- Saved codes and the slot-format help open as a drawer instead of sitting at
  the bottom of the page.

## Non-goals

- No change to the wire format, the codec, the loadout grammar, `describe.ts`,
  `hints.ts`, `saved.ts`'s storage format or the share-link format.
- The treasure slots keep their current control: `<entry-tiles>`, with its
  picker dialog and level strip, as the owner asked ("use current design").
  The boost and cookie power+ cards (`<card-group>`) and the mode, goal and
  action chips (`<chip-group>`) also stay as they are.
- Every other picker **drops its dialog and becomes an inline grid**, as in the
  mockup (the owner's answer). That covers the episode, random boost, cookie,
  relay and pet pickers. See section 6.
- No new features in Saved codes: Load, the ⋯ menu, Update / Save as new,
  import and export all behave as they do today, in a new place.

## Anti-goals

- A summary that disagrees with the code. The summary is rendered from the
  decoded `FullCode` in the same `render` pass as everything else.
- A layout that needs JavaScript to measure itself in order to be usable. Any
  measuring (see sticky tabs below) is an enhancement only.
- A tab that hides a control the code depends on without saying so. A disabled
  tab says why.

## The page, top to bottom

### 1. Code panel (sticky)

`<code-bar>` as today, with its slotted buttons. Nothing else goes in this
panel: no heading, no summary, no tip line. The owner asked for "just the code
and the actions of the code".

The slotted buttons (the owner's answer on the dock):

- **Copy link**, then **Save**, or **Update** while an entry is open. Save and
  Update submit the save form.
- A **⋯** menu holding **Reset**, plus **Save as new** and **Cancel** while an
  entry is open. It is a `<details class="more">`, built and closed the same
  way as a saved row's menu (closes on a pick, on Escape with focus back to its
  summary, and on a click elsewhere).
- The menu is used on both widths. The owner chose it for the phone dock, and
  the builder's call is one arrangement rather than two.
- `#link-status` (Copy link's "the browser blocked the clipboard" line) goes
  away. That sentence is written to the code bar's own `message` instead, which
  is already the line under the code.

- **Desktop** (≥ 48rem): `position: sticky; top: 0`, as today.
- **Phone** (< 48rem): docked to the bottom of the viewport, padded by
  `env(safe-area-inset-bottom)`. It stays early in the DOM, so keyboard and
  screen-reader order is unchanged. It is pinned visually: either reorder it in
  `main`'s grid with `order` and `position: sticky; bottom: 0`, or use
  `position: fixed` and give `main` bottom padding. The builder picks one and
  checks it on a real phone width.
- Clicking a run of the code works as today: `slot-jump` with the group name.
  `jumpTo` now also switches tabs (see 6).
- **Unused parts are not clickable** (the owner's answer). A run is drawn as
  plain text with its tooltip still on, not as a button, when:
  - no control owns its group (`version`, `loadoutVersion`, `reserved`); or
  - its tab is disabled for the episode (slots 5–9 on special1, special2 and
    specialExp).

  The route marks those hints. `<code-bar>`'s `CharHint` gains an optional
  `inert: true`, and an inert run is a `<span>` that fires nothing.
- The page's `<h1>` stays. The intro paragraph under it moves to the top of the
  Help drawer (the owner's answer).

### 2. Top bar (replaces the sidebar)

The owner's answer: **remove the sidebar and use the mockup's layout** on every
page. `<site-nav>` becomes a top bar at every width. It holds:

- the brand ("Cookie Run tools" with the Fairy Cookie icon) linking home;
- a **tool menu** (the owner's answer, so the bar stays one line as tools are
  added). It is a button naming the current page: the tool's name, or "All
  tools" on the home pane, then ▾. It opens a list with "All tools" (home)
  first, then a "Tools" divider, then every tool from the registry with its
  name and tagline. The current entry is marked `aria-current="page"`. It
  closes on a pick, on Escape (focus back to the button) and on a click
  elsewhere;
- the theme toggle;
- a default slot at the far end for page actions.

The combi page slots **Saved** with a count (for example "Saved 3") and
**Help** there. Each opens its drawer (see 8).

`base.css` drops the rail grid. `body` becomes one column: the top bar, then
the masthead and `main`. The home pane gets the same top bar.
`src/lib/tools.test.ts` still finds `<site-nav>` on every page. Only its shape
changes.

Under 48rem the brand shows its icon only and the theme control shrinks to an
icon button. The tool menu and the slotted actions stay visible. The code panel is no longer pinned at the top on a phone, so the
bar can stay static there.

### 3. Warnings

`#warnings` moves from `.readout` to a banner at the top of the content, above the
note. It shows only when there is something to say, and nothing about which
warnings appear changes.

- **Code read with changes**: an amber banner, "Read with changes", listing the
  warnings.
- **Unreadable code**: stays where it is today, on the code bar's own message
  line, since that is where the code is typed. This is the builder's call; the
  mockup showed it in the banner too, but the code bar already owns that
  message.

The `.tip` paragraph ("Click any part of the code…") moves into the Help drawer.

### 4. Note

The save form's textarea (`#save-description`) moves to the top of the content
with a small label: "Note · new code", or "Note · editing a saved code" while
an entry is open. The "Loaded from …" line (`#save-editing`) and the save
status line (`#save-status`) sit right under it. Ctrl/Cmd+Enter still submits
and Escape still closes the entry. The submit buttons now live in the code
panel, so they submit the save form through the `form` attribute or
`requestSubmit`. Either is fine.

### 5. Summary

A read-only digest of the build, one row per line, rendered from the decoded
`FullCode`. The rows come in the same order as the tabs, so reading down the
summary walks across the tabs:

| Row | Content | Opens |
| --- | --- | --- |
| **Run** | mode word as a pill: Manual / Auto / Semi-auto. When semi-auto, the reasons beside it in muted text (`describeBuild`'s `reasons`). Then · goal · episode icon and name, plus ", floor 42" / ", any floor" on the tower. Then · action, when the run is auto and the action is not none. | Main tab, mode |
| **Cookies** | cookie face, then `→` relay face when the episode takes a relay and one is set, then · pet face; names hidden until the pictures are clicked (owner's call). Any, which has no face, reads as its catalog label ("Any cookie"). | Cookies tab |
| **Treasures** | one picture per slot: the slot's first pick. A small `+N` badge when the slot has N alternatives. The level text (`+3–9`) only when the first pick is not exactly +0. With exact order and two or more slots, `→` between slots and an "exact order" tag. A hover title lists the whole slot: "A +3–9 or B +5–9". | Treasures tab |
| **Boosts** | each boost's icon; names on click (owner's call) | Boosts tab, boosts |
| **Random boost** | its label | Boosts tab, random boost |
| **Power+** | each power's faces (at most two, stacked), name (without " Cookie") on click | Boosts tab, cookie power+ |

Rules:

- Run is always shown. Every other row is shown only when it has something to
  say, and never when the episode has no room for it (`limitsOf`).
- When only Run is showing and no cookie is set, a muted hint line follows it:
  "Nothing else picked yet. Choose a cookie, boosts or treasures in the tabs
  below."
- **Phone** (< 48rem): the summary opens folded to one line. It shows the mode
  pill, the goal, the episode icon, the cookie / relay / pet faces, the
  treasure pictures and "N boosts", with ▾. Tapping it expands to the full rows
  with a "Hide ▴" control. It is not remembered.
- The words come from `labels.ts` and `describe.ts` (`describeBuild`,
  `floorText`), and the pictures from `art.ts` / `catalog.ts`, so nothing new
  decides how a build reads.

**Implementation (builder's call).** Rewrite `<build-summary>` into this
component. Its old jobs, the board header and the board's fold, go away with
the board (see "Removed" below).

- Properties: `rows`. Each row is `{ label, target, items }`. `target` is an
  opaque string the route maps to a tab and control. An item is a small union:
  text, or an image plus text, a separator (`·` or `→`), a badge, or a tag.
  Plus a `hint` property for the empty line.
- The component declares its own types and never imports from the route, per
  the `ui-components` rule.
- A row is a `<button>`. Clicking it fires `summary-jump` with the target.
  Folding on a phone is the component's own state, through a media query or
  container query plus a toggle button. It fires nothing the form hears.
- It sits outside `#build`, or fires no `input`, so the form's `input` listener
  never re-renders from it.

### 6. Tabs

Four tabs: **Main**, **Cookies**, **Treasures**, **Boosts**.

| Tab | Holds (existing elements, moved, not rebuilt) | Badge |
| --- | --- | --- |
| Main | mode chips (with the verdict sentence under them), goal chips, **episode grid** (inline, the episode art, no search), floor field, action chips | none |
| Cookies | three **role cards**: Cookie `→` Relay `·` Pet, each showing its face and name, or None / Any. The relay card is disabled with "No relay here" where the episode takes none. Picking a card chooses which role the grid below writes. Under the cards: a Clear button when that role holds something, then one **inline grid** with a search box over the role's catalog (cookies for Cookie and Relay, pets for Pet). | how many of cookie / relay / pet are set (relay counts only where the episode takes one) |
| Treasures | the order chips, then the three `<entry-tiles>` slots | `n/3` slots filled |
| Boosts | boost cards, **random boost chips** (None first, then the eleven), cookie power+ cards | boosts + (random boost ? 1 : 0) + powers, hidden at 0 |

**The inline grid (builder's call on the shape).** A new component,
`<entry-grid>`: a single-pick grid drawn in place.

- **Same contract as `<entry-tile>`, minus the dialog:**
  - `options` as `[value, label, image]`;
  - `value` (string or null);
  - `required` (drops the None cell);
  - `searchable` (shows the filter box);
  - an untargeted `input` on a pick.
- **Shared look:** it reuses `tileStyles` and `glyphFor` for the cell look,
  and the roving tabindex with arrow keys, Home and End.
- **No cap:** it renders every match, with no 50-cell cap, since it's the only
  grid on screen.
- **Filtering:** the search box is not a value change and fires no `input`,
  the same rule `<entry-tile>` follows.
- **Ids and getters:** the episode keeps its id (`#episode`), and so do cookie,
  relay and pet (`#cookie`, `#relay`, `#pet`). The Cookies tab holds the three
  grids and shows only the selected role's. The role cards are light-DOM
  buttons the route draws from the three values. `readLoadout` and `readForm`
  keep reading `.value` from the same ids.
- **The old component:** `<entry-tile>` the element goes away once nothing uses
  it. `tileStyles`, `glyphFor` and `lockPageScroll` stay exported for
  `<entry-tiles>`; the builder may move them to their own file.
- **Random boost:** becomes a `<chip-group>` with `""` for None, read back as
  null. It stays `resettable`, so clicking the chosen chip goes back to None.

- A tab the episode has no room for is **disabled**, with its reason as a title
  ("Not used in Special Exp Episode"). Treasures is off for specialExp, and
  Boosts is off for special1, special2 and specialExp. The owner accepted
  disabling the whole tab. The per-field "takes none" notes inside
  `showLimits` stay for the fields that remain on an enabled tab (the action
  on a manual run, the relay).
- If the selected tab becomes disabled, Main shows instead. The stored choice
  is kept, so switching back to an episode that has the tab reopens it.
- The selected tab is **remembered per browser** under a new `localStorage` key
  in `state.ts` (`combi-name:tab`). Every access is wrapped like the others.
  Opening a saved code or following a link keeps the current tab.
- `jumpTo(group)` gains a group → tab map. It selects that tab, then scrolls
  and focuses the owner as today. `summary-jump` goes through the same
  function.
- Those runs are inert (see 1), so a jump to a disabled tab can't come from the
  code. The summary never shows a row for one either. If `jumpTo` is reached
  for a disabled tab anyway, it does nothing.
- The tab bar sticks under the code panel on desktop and at the top on a
  phone. Desktop needs the code panel's height. The builder may set it as a
  custom property from a `ResizeObserver`. Without it the tab bar simply
  scrolls away, which is acceptable.
- **Implementation (builder's call):** a small new component `<tab-strip>`.
  - `options`: `[value, label, badge, disabledReason]`.
  - `value`.
  - `role="tablist"` with arrow-key / Home / End roving like `<chip-group>`.
  - Fires `tab-change`, not `input`, since a tab is not part of the code.
  - Panels are light-DOM sections in the route, `role="tabpanel"`, `hidden`
    unless selected, labelled by their tab.

### 7. Removed

- The board header and its fold: `<build-summary>`'s `collapsed` / `toggle`,
  `foldBoard`, `boardCollapsed` / `rememberBoardCollapsed` / `BOARD_KEY` in
  `state.ts`, and `#build[data-collapsed]`. The new summary replaces the
  header. The verdict sentence moves under the mode chips on the Main tab, and
  its words show on the summary's Run row.
- The three bands' headings ("The run", "Your loadout", "Boosts and start") and
  their slot notes. The tabs replace them. Each field keeps its own heading and
  its "slot N" marker.
- `.readout` and `.tip`. The tip moves into Help.

### 8. Drawers: Saved codes and Help

Both are native `<dialog>` elements opened with `showModal()`, styled as a
sheet from the right edge: full height, `min(22rem, 90vw)` wide, with a header
holding the title and a Close button. Backdrop click, Escape and Close all
close it. This is the builder's call. The mockup's desktop drawer was
non-modal and pushed the page aside, but a modal sheet is one implementation
for both widths and gets the focus trap and Escape for free. Copy the
press-latch from `<entry-tile>` so dragging out of the sheet doesn't count as a
backdrop click. Lock page scroll the way `lockPageScroll` does.

- **Saved codes**: the existing `#saved-empty`, `#saved-list` with its rows and
  ⋯ menus, and the Import and export `<details>`, moved as they are. The
  top bar button's count follows `savedEntries.length`.
- **Load closes the drawer at every width** (builder's call), so the build it
  loaded and the note it filled are what you see. Because the drawer is modal,
  everything behind it is inert. So "Loaded X." and "X no longer reads"
  write to `#save-status` by the note, and only after the drawer has closed.
  On a failed Load the drawer stays open and the message goes to the
  drawer's line instead.
- Every other action in the drawer writes to a new status line inside the
  drawer, `#saved-status`, under its header:
  - "Copied the link to X." and the clipboard-blocked line with the URL.
  - Delete, and storage refused.
  - Share.
  - `#transfer-status` stays where it is, inside Import and export.
- After deleting the last entry, focus falls back to the drawer's Close button
  rather than to the note, which sits behind the modal.
- **Help**: the "Reading a code by eye" content (the diagram, both tables, the
  special-episode, loadout and auto vs semi-auto notes) moved as it is, with
  the old tip line at the top.

### 9. What stays exactly as it is

- `render` is still the one render. It now also writes the summary's rows, the
  tab badges and disabled states, and the Saved count.
- Paste-anywhere, `hashchange`, the remembered code, the share-link note offer,
  Copy link's confirm swap, Reset, `readDraft`, and every saved-list behaviour,
  including focus after delete and menu closing.
- Every control's id. Tests and `OWNER` keep finding them.

## Docs to update in the same change

- **`README.md`**: the paragraphs describing the board in three bands and
  Saved codes under the board.
- **`.claude/skills/combi-codec/SKILL.md`**:
  - The "One code, one state" paragraph says the page is one board with no
    summary. It now has a summary, rendered from the same decoded `FullCode`
    in the same `render`, so it cannot drift. Say that instead.
  - Mentions of the board header, its badge and its fold.
- **`.claude/skills/ui-components/SKILL.md`**:
  - The element table: the new `<build-summary>` contract, `<tab-strip>`,
    `<entry-grid>`, `CharHint.inert`, `<site-nav>` as a top bar with a slot,
    and `<entry-tile>` removed.
  - The paragraphs on `<build-summary>`, on the dialogs ("six open grids…",
    which no longer applies), on the rail and on `base.css`'s body rows.
- **`AGENTS.md`**: the `bun run dev` line and the layout section, if they name
  the sidebar.
- **`CHANGELOG.md`**: at landing, per `landing-a-change`.

## Testing

Test first, per `shipping-a-change`.

- **`<tab-strip>`**:
  - Renders tabs with badges.
  - A disabled tab can't be picked, by click or arrow.
  - Arrow keys, Home and End move the selection.
  - Fires `tab-change` and not `input`.
- **`<entry-grid>`**:
  - Renders all options inline, with None unless `required`.
  - A pick fires `input` and sets `value`.
  - Filtering fires nothing.
  - Arrow keys, Home and End rove the cells.
  - It refuses a value its options lack.
- **`<code-bar>`**: an `inert` hint run is a `<span>`, not a button, and fires
  no `slot-jump`.
- **`<site-nav>`**: renders the brand, the links and the theme toggle, plus
  slotted content.
- **Route**: the runs for unused parts are inert on special episodes and for
  the version characters. The Cookies role cards switch which grid shows, and
  a pick updates the card and the code.
- **`<build-summary>`**: renders its rows and items, a row click fires
  `summary-jump` with its target, and the phone toggle flips the folded state.
  Layout itself is a preview check.
- **Route** (`index.test.ts`):
  - Summary rows for the sample codes: order, hidden rows, the relay arrow, the
    alternatives badge, levels shown only when not +0, the exact-order tag.
  - Clicking a summary row or a code run selects the right tab and focuses the
    control.
  - Tabs are disabled per episode, with Main shown in their place.
  - The tab choice is remembered and survives opening a saved code.
  - The badges are right.
  - The save buttons in the code panel submit, update and save as new as
    before.
  - The Saved drawer opens, lists, loads (and closes on a phone width), and its
    count follows the list.
  - The Help drawer holds the reference.
  - Remove the tests for the fold and the bands, and rewrite the "sits inside
    the board" / "loadout sits between" tests for the tab layout.
- **`state.ts`**: the tab key reads and writes behind try/catch. Remove the
  tests for the board key.
- **Preview checks, in a browser on both widths:**
  - Sticky top and bottom dock.
  - The sticky tab bar.
  - The drawer sheet.
  - The phone summary fold.
  - That the treasure dialog still sits above the dock.

## Left to the builder

- The phone dock technique (sticky with `order`, or fixed), and the sticky tab
  offset.
- Exact spacing and type inside the summary, following the mockup and
  `tokens.css`.
- Splitting the work into commits. One PR.

