# The merged build editor

2026-09-23

## Why

The combi page says the same build twice. `<build-summary>` draws it — the faces of
the cookie, relay, pet and treasures, the episode and boost icons, the cookie power+
portraits — and the four `<details class="panel">` sections below it hold the controls
that wrote those values, each control showing the same pick again in its own closed
line. Reading and editing are the same question asked in two places, a screen apart,
and the answer has to be kept in step by scrolling between them.

This design merges them. One board is what the code says and where the code is
changed: every value on it is the control that writes it.

## Scope

In:

- one board section replacing `<build-summary>` and all four build panels
- `<entry-tile>` and `<entry-tiles>` moving from an inline `<details>` to a modal
  `<dialog>`, with their closed line becoming the board's tile
- the treasure order switch moving to the Treasures heading, with the slot labels
  following it
- the run rows and the cookie power+ row becoming toggles on the board

Out:

- the codec, the wire format, and every table in `codec.ts` — no slot changes, no
  `VERSION` bump
- the sticky code panel, `<code-bar>`, the warnings list and the reference `<details>`
  at the foot of the page, all unchanged
- the home pane and every other route

## The board

One `<section class="board">` in `src/routes/combi-name/index.html`, under the sticky
code panel, holding five parts in this order:

1. **Header** — "Your build", the auto badge (`Full auto` / `Semi-auto`, absent for the
   hand-played types) and the verdict sentence under it.
2. **Loadout** — three tiles: Cookie, Relay, Pet.
3. **Treasures** — the heading carries a two-button order switch (`exact order` /
   `any order`); under it three slot tiles, labelled `Slot 1` `Slot 2` `Slot 3` when the
   order is exact and `Any slot` three times when it is not.
4. **Run** — five labelled rows: Type, Episode, Boosts, Random boost, Action.
5. **Cookie power+** — one toggle per power, each wearing the faces it belongs to.

A tile is a button: role, the faces of what it holds, and their names. An empty tile
draws a dashed frame and reads `none`, so a slot nobody has filled still invites a
click. A slot holding alternatives wears every one of their faces.

Everything is always visible. The panels folded because there were four of them below
a summary; one board with five labelled groups is a page to read top to bottom.

## Components

### `<entry-tile>` and `<entry-tiles>` — details to dialog

Both keep everything that makes them correct today:

- the `options` / `value` (`selected`) contract, including the pruning pass in
  `willUpdate` that drops a pick the current options do not hold
- the search box, the 50-match cap plus the current pick, the roving tabindex, and
  focus following a picked cell into its replacement
- `<entry-tiles>`'s kind filter row, badges, rings and chips
- the untargeted `input` dispatched from the host, and the route's form listener

What changes:

- the closed `<details>` becomes a tile button on the host, and the grid moves into a
  `<dialog>` opened with `showModal()`
- the `open` property stops reflecting onto the host: it exists today so the page can
  widen an open control, and a modal needs no row to widen. `.tiles > [open]` in
  `src/routes/combi-name/index.css` goes with it
- the outside-`pointerdown` close handler goes: a modal dialog's backdrop and Escape
  already do that job, and two closers would fight
- `<entry-tiles>`'s per-chip remove button goes with the closed line that carried it: a
  tile is a `<button>`, and a button inside a button is not markup. Dropping an
  alternative happens in the dialog now — unpick its cell, or **Clear** — which is also
  where the rest of that slot is visible while you do it. `#drop` and its focus-recovery
  logic are deleted; `#toggle` keeps the same job inside the dialog

Dialog rules, the same for both:

- **single pick** (`<entry-tile>`) applies on click and closes — one click, one value
- **multi pick** (`<entry-tiles>`) applies on **Done**; **Escape** and the backdrop
  cancel, leaving the slot exactly as it was. A slot is a set, and half a set applied
  on the way out is worse than none
- **Clear** empties the draft selection without closing
- focus returns to the tile that opened the dialog, on every way out

A cancel needs a draft: `<entry-tiles>` holds the in-dialog selection in `@state` and
only writes it to its own value — and dispatches `input` — on Done. `<entry-tile>` has
no draft, since a click is the commit.

### `<chip-group>` and `<card-group>` — unchanged

Type, Episode, Random boost and Action stay `<chip-group>`s; Boosts and Cookie power+
stay `<card-group>`s, which is already a grid of on/off toggles wearing art. No API
change, no new component. The board's rows are layout in `index.css` around elements
that already work.

Action stays the two-chip row it is today — `No action` and `Jump at start`, with
`resettable` on — rather than the single pressed toggle the mock drew. The toggle would
be a new element for one boolean, and a two-chip row says what the off state is called
instead of leaving it implied.

### `<build-summary>` — shrinks to the header

`groups` goes away; `verdict` stays. Every group it drew is now the live control that
writes that value, so what is left is the board's header: the title, the badge, and the
verdict sentence, with `aria-live="polite"` as today. `SummaryFace`, `SummaryItem` and
`SummaryGroup` are deleted with the property.

## Data flow

Unchanged, and that is the point. The page still holds exactly one `FullCode`:

- `readLoadout()` and `readForm()` read the same six catalog controls and five run
  controls they read today — the tiles *are* those controls
- the form's `input` listener still calls `render()`
- `render()` still encodes, writes `<code-bar>`, writes the hints, decodes the code
  back, writes the header's verdict, shows warnings and publishes to hash and storage
- `writeForm()` / `writeLoadout()` still apply a decoded code to the controls, options
  before picks

`jumpTo` keeps its `OWNER` map and scrolls to the owning control; the panel-unfolding
step added for the collapsible panels is deleted along with the panels. A jump lands on
the tile, not inside the dialog — someone who clicked a treasure run in the code wants
to see which treasures are in the slot, and opening a modal over the code they clicked
hides what they were reading.

## What is deleted

- the four `<details class="panel">` sections in `index.html`, their headings, and the
  three panel tests added in the collapsible-panels commit
- `jumpTo`'s `details` unfolding
- `.panel > summary` rules in `index.css` that exist for those panels — the reference
  `<details>` at the foot of the page keeps its own
- `<build-summary>`'s `groups` property, its three exported types, the route's
  `summaryGroups`/`runItems`/`treasureItems`/`entryItem`/`faceFor` builders, and their
  tests
- `.tiles > [open]`, and `open` reflection on both catalog controls

`describe.ts` keeps `describeCombi` (the verdict), `describeLoadout` (the hints) and
`entryName`.

## Accessibility

- each tile is a `<button>` with an accessible name built from its role and what it
  holds, so a screen reader hears "Cookie, Fairy Cookie" rather than "button"
- the dialog is a native modal: focus is trapped by the platform, Escape closes, and
  the first control inside it is the search box
- the order switch is two `aria-pressed` buttons in a group labelled by the Treasures
  heading
- the board header keeps `aria-live="polite"`, so the verdict is announced when it
  changes and nothing else on the board is
- the run rows keep `<chip-group>`'s single tab stop with arrow keys, and
  `<card-group>`'s toggles, both already tested

## Testing

Component tests:

- `<entry-tile>`: a click on the tile opens the dialog; picking a cell writes `value`,
  dispatches `input` and closes; focus returns to the tile; a value its options do not
  hold is still pruned
- `<entry-tiles>`: picks accumulate in the dialog without changing `selected`; Done
  writes them and dispatches one `input`; Escape leaves `selected` untouched; Clear
  empties the draft only; the kind filter still narrows without dispatching
- `<build-summary>`: badge and sentence for semi, full and null verdicts; nothing at all
  when there is no verdict

Route tests:

- picking a cookie through the dialog writes the loadout section of the code
- the order switch flips the slot labels and rewrites the order flag
- toggling a cookie power+ writes its bit
- a code typed into the bar still moves every control, tiles included
- a treasure the picker hides is still carried (the existing test, through the dialog)

happy-dom implements `showModal()` and `close()`, so all of this runs in the existing
harness. What it cannot show is unchanged from today: no `--cr-*` token resolves there,
so the board's layout and the dialog's look are verified in a browser, not by the suite.

## Risks

- **A dialog inside a shadow root.** `showModal()` puts the dialog in the top layer,
  which is outside the shadow tree's stacking context; the component's own styles still
  apply, but the sticky code panel's `z-index` does not compete with it. Verify in a
  browser early rather than late.
- **Six dialogs in the DOM.** One per catalog control, as today's six `<details>` are.
  Only one can be open at a time: everything under a modal's backdrop is inert, so a
  tile cannot be clicked while another tile's dialog is up. Nothing in the page has to
  enforce that, but a test should hold it to the promise.
- **The code panel is sticky and the dialog is not.** With a dialog open the page behind
  it does not scroll, so the two never disagree.
- **Losing the panels loses a place to stand.** The board is longer than the summary
  card was; if it reads as a wall, the fix is grouping and spacing inside the board, not
  folding it back into panels.
