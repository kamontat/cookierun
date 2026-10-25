# Changelog

What changed in this project and why, newest first.

## 2026-10-26: Resizable Saved and Help drawers on desktop, and a code panel that says whether you are editing

### Features

- On a wide screen with a mouse, the left edge of the combi page's **Saved** and **Help**
  drawers is a resize handle. Drag it, or focus it and press the arrow keys (Shift for bigger
  steps), to set the width anywhere from 288px to 90% of the window. Double-click it to go
  back to the default `22rem`.
- Each drawer remembers its own width under `combi-name:drawer-width:<id>`. A browser that
  refuses storage still resizes, and only forgets on reload.

### Improvements

- Inside a drawer, the sheet now scrolls instead of the dialog, so the resize handle stays
  on the drawer's edge however far the list has scrolled.
- The code panel's heading is now shown and reads **New code**, or **Editing saved code**
  while a saved entry is open, with the heading and the panel's edge in a dashed accent. The
  note's label is plain "Note"; it used to carry "new code" / "editing a saved code".
- **Update** no longer closes the entry: it stays open on its new code with the note and stats
  as typed, so a second change is one more Update rather than another Load.
- **Save as new** is now **New**, a button of its own beside Update in the code panel rather
  than an item in the ⋯ menu.

### Bug fixes

- Saving an unchanged code "as new" overwrote the entry it was loaded from instead of adding a
  copy. **New** now shows only while the code on screen is one no entry holds.

### Decisions

- New is hidden for a saved code rather than refusing the save with a message: the list keeps
  each code once, so there is no copy it could make, and a button that cannot work is better
  not offered.

- The handle is only on a fine pointer at `48rem` and up. On a phone the drawer already takes
  90% of the screen, and a drag on its edge would fight the page's own swipe.
- The handle sits on the dialog rather than as a `position: fixed` child of the scrolling
  dialog: the fixed version left the mouse cursor stale over it.

## 2026-10-25: The workbench layout, with a top bar in place of the sidebar, and snackbar notifications, and run stats on saved codes, and the code as a character grid with saved rows that read as runs

### BREAKING CHANGES

- The sidebar is gone on every page. Navigation is now a tool menu in the top bar.
- The combi page's board and its fold are gone, and so is the `combi-name:board-collapsed`
  setting. The page no longer reads it.
- The `<entry-tile>` element is removed. Its shared styles and helpers (`tileStyles`,
  `glyphFor`, `lockPageScroll`) moved to `src/components/tile.ts`. Code that imports
  `#components/entry-tile` must import from `#components/tile` instead.
- `<build-summary>` has a new contract. It draws rows the page hands it (`rows`, `compact`,
  `hint`) and fires `summary-jump`. The old `verdict` and `collapsed` properties and its
  `toggle` event are gone.

### Features

- A top bar on every page. It holds the brand ("Cookie Run"), a tool menu that lists All
  tools and every registered tool with its tagline, the theme control (an icon on phones),
  and a slot for the page's own buttons. The combi page puts **Saved N** and **?** (Help)
  there.
- The combi page is laid out as a workbench, top to bottom: the code panel, the note, a
  summary of the build, and four tabs. The tabs are **Main**, **Cookies**, **Treasures**
  and **Boosts**. Each shows a count of what it holds and is disabled when the episode has
  no room for it. The open tab is remembered under `combi-name:tab`.
- The code panel is pinned under the top bar on desktop. On a phone it scrolls away with
  the page, the tab bar sticks to the top on its own, and a floating **↑** button at the
  bottom right brings the code back once it is out of view.
  - It shows the ten characters the game takes, with **Edit**, **Save** (or **Update**)
    and a **⋯** menu.
  - The menu holds **Show full code**, **Copy code**, **Copy link**, **Reset**, and
    **Save as new** and **Cancel** while a saved code is open.
  - Show full code swaps the panel, and Copy code with it, to the whole code with its
    loadout, remembered under `combi-name:full-code`.
- A summary under the note reads the build at a glance, one row per tab, in tab order.
  - Cookies, treasures, boosts and power+ are pictures in equal-sized boxes.
  - Clicking a row's pictures shows or hides that row's names. On the Run row the same
    click shows why a run is semi-auto.
  - An evolved or blessed treasure wears an **E** or **B** and a ring in its colour.
  - The **›** at the end of each row opens its tab.
  - On a phone the summary folds to one line until tapped.
- One notification banner carries every message, as a snackbar floated at the bottom
  centre of the window.
  - Info is green, warn yellow and error red, each with its own badge (`i`, `!`, `×`),
    through two new tokens, `--cr-success` and `--cr-warning`.
  - Info clears itself after a few seconds; warnings and errors stay until dismissed or
    replaced.
  - A message of several lines folds to its title and a count, such as "Read with changes
    (2) ▾", and opens on a tap.
  - While a drawer is open the banner moves into it and sits under the drawer's header.
- Saved codes and Help open as side drawers from the top bar. Saved codes keep Load, the
  row menu, and import and export as before. Help holds the slot reference and the page's
  intro.
- The episode, cookie, relay and pet pickers are grids drawn in place (`<entry-grid>`)
  instead of dialogs. The Cookies tab has cards for cookie → relay · pet that choose which
  grid shows. Random boost is a row of chips. Treasure slots keep their picker.
- Letters for parts of the code with nothing behind them are plain text and not clickable:
  the version character, the tower's reserved slots, and slots an episode doesn't use.
- A saved code keeps what a run of it brought home, in four optional boxes under the note:
  **Money** and **Exp** (a positive whole number or a range like `12000-15000`), **Boxes**
  (0 to 5, or a range) and **Time** (seconds). A saved row shows them on one line, and Load
  fills them back in.
- Run stats travel with a code. A shared link carries them as plain query values
  (`#CODE?note=…&money=12000-15000&time=245`) and offers them in the boxes like its note.
  Export writes them as `money: 12000-15000` lines under the code, and import reads them
  back.
- A saved row reads as the run it holds instead of its code: chips for the mode
  (Semi-auto when the build is, relay included), the goal, the episode as `EP. 3` or
  `S.EP. 2`, and the tower's floor, then its stats, then its note. A row with no note has
  no note line, and **Saved [date]** sits at the start of the row's button line.
- The code shows each treasure slot as its own run after the order flag, and tapping one
  opens the Treasures tab on that slot; tapping the order flag goes to the order switch.

### Improvements

- The code is a grid of character cells in monospace with no letter-spacing, and fields sit
  one empty cell apart, so every character keeps its column whether the code fits one line
  or wraps onto several. The long treasure run no longer wraps with a centred second line.
- Parts of the code you can tap are yellow and underlined; the parts you cannot are grey
  and plain, so the difference shows on a phone without a hover.
- Tapping part of the code says only its slot and field under the code, such as
  "Slot 2 · Mode", since the tap already opens the control that shows the value.

- The page is one centred column, and the sections keep the same spacing whichever tab is
  open.
- The tab bar stays one row on a phone and scrolls sideways only.
- The code's dotted underlines are drawn as text decoration, so they line up along a
  wrapped line on iOS.
- A long build stays tidy on a phone: the folded summary is one line, with the boost count
  ahead of the pictures, and nothing can widen the page.
- Loading a saved code says so once. The line under the note that repeated "Loaded from X"
  next to the banner's "Loaded X." is gone; the note's label and the **Update** button still
  show that an entry is open.
- A message no longer pushes the page down. The banner used to grow the code panel when it
  appeared and shrink it when it went, so everything under the panel jumped.
- The code panel's **Copy link** carries the note and stats in the boxes, not just the code,
  so a build can be sent before it is saved. A blocked clipboard shows the link itself,
  since the address bar holds only the code.

### Bug fixes

- The Cookies tab no longer vanishes for anyone using a content blocker (Brave Shields,
  uBlock Origin, AdGuard). Its panel was named `#panel-cookies`, an id that cookie-banner
  filter lists hide on every site. It is `#panel-roles` now, and a test fails if a page
  region is named after cookies again.
- Pressing Enter in the tower's floor box no longer reloads the page.
- An inline grid never scrolls inside its own box. On WebKit at 110% zoom the episode grid
  had become a one-pixel scrolling box.
- The theme dropdown no longer keeps a focus ring after a mouse pick.
- Exporting with nothing saved, or importing empty text, is a warning rather than an error.
  Nothing failed; error is kept for what the browser or a code refused.
- The folded summary on a phone no longer cuts off the **E**/**B** letter above a treasure
  picture or the **+N** badge below it.

### Decisions

- Mockups came first: the owner tried several layouts, then a version with real art and
  real codes, before settling on this one. The design and plan are in
  `docs/superpowers/specs/2026-10-23-combi-workbench-layout-design.md` and
  `docs/superpowers/plans/2026-10-24-combi-workbench-layout.md`.
- The panel shows only the game's ten characters by default. They are what goes into the
  game, the loadout is in the summary, and a full code took three lines of a phone's dock.
  Show full code is there when it is wanted.
- A summary sits beside the controls, against the earlier "one board, no second rendering"
  rule. It is drawn from the same decoded code in the same render, so it cannot disagree
  with the controls.
- The drawers are modal sheets on both widths rather than a desktop side column that
  pushes the page over. That keeps one implementation, and Escape and the focus trap come
  from the platform.
- Treasures keep their picker dialog, the owner's call. Every other picker became an
  inline grid.
- The banner went through three mockup rounds. A strip in the panel that always kept one
  line was built first, then dropped because the empty line was annoying. A card hanging
  off the panel and a message in the button row's free space were also mocked up. The
  owner picked the snackbar.
- The phone's bottom dock for the code panel was dropped, the owner's call. The panel
  sticks to the top as on desktop, and the bottom of the screen is left to the snackbar.
- A stat that does not read stops Save, Update and Copy link rather than being left out, so
  what is kept or sent is what was typed. Every bad box is outlined, not just the first.
- Stats are not part of the code. They belong to a saved entry and its link, so the wire
  format and `VERSION` are unchanged.
- A saved row leaves its code out, the owner's call: the code says nothing at a glance,
  while the mode, goal and episode do. Load, Copy link and Share still act on the code.
- Later the same day the phone's code panel was unpinned after all. A full code in a pinned
  panel took a third of the screen, and mockups of more compact codes (section rows,
  equal cells, labelled cells, one line that scrolls sideways, a smaller loadout line) were
  all still too tall on a phone. The owner chose a plain **↑** button over a floating pill
  showing the code.
- The code's cells had a light ground at first to mark them as tappable; it read badly on
  the dark theme, so the underline alone marks a tap. The **↑** button is filled with the
  text colour rather than the accent, because the accent fill is what a picked treasure
  level wears and the button floats over those strips.

## 2026-10-23: Treasure slots as rows with a one-line level strip, and saved codes you can update, share and move

### Features

- Each pick in a treasure slot shows its levels as one strip of ten cells, +0 to +9, with a
  summary beside it such as `+9`, `+7–9`, `+0, +2–4` or `any`, replacing the 5×2 button grid.
- Holding a level for half a second keeps that level alone, so +0 to +9 is one gesture.
  Dragging across the strip, or shift-pressing a level on desktop, selects a range.
- An `any` button beside each strip turns on all ten levels, and pressing it again goes
  back to +0.
- A filled treasure slot ends with a "+ Add alternative" button that opens the picker.
- Loading a saved code opens it in the save box with its note. **Update** writes the build
  on screen and the note back into that entry, in place, and **Save as new** keeps the
  original. A line above the box says what Update would do, including a code change, and
  an update onto a code another entry already holds is refused.
- **Copy link** on a saved entry copies a link that carries its note (`#CODE?note=…`).
  **Share** sends the same link through the share sheet where the browser has one. Opening
  such a link puts the note in the save box, one click from keeping it.
- **Import and export**, folded under the saved list, moves the whole list as plain text:
  each code on its own line with its note under it, every note line starting with `>`.
  Export copies it or downloads a `.txt`; import takes pasted text, a file, bare codes or
  shared links, adds only codes not already saved, and names the lines it skipped.
- The "Your build" heading folds the board away. The auto/semi-auto badge and verdict stay
  on show, the choice is remembered in this browser, and clicking a run of the code to jump
  to its control opens the board first.

### Improvements

- The three treasure slots stack as full-width rows instead of columns, so names show in
  full with their kind, and a dashed "or" separates alternatives. The slot's name sits on
  the left, or as a bar above the picks when the slot is narrow.
- The layout follows each slot's own width rather than the window's. The strip joins the
  name's line only with a mouse and at least 42rem of room. On touch, each cell is the full
  tap height.
- An empty treasure slot is clickable across its whole frame, not just its left column.
- The page behind an open picker no longer scrolls, even with the iOS keyboard up. Closing
  the picker returns the page to where it was.
- A saved row shows two buttons instead of a wall: **Load**, and a **⋯** menu holding Copy
  link, Share and Delete. The menu closes on a pick, on Escape, on a click elsewhere, and
  when another row's menu opens.
- **Reset** lets go of a loaded entry, so Update is never left aimed at it after starting
  over.

### Bug fixes

- On iOS, picker cells were only as tall as the tap size, so every name overlapped the
  picture in the row below. Rows now size to their content.
- On iOS, a picker was taller than the visible screen, so its title, Close, Clear and Done
  ended up behind the browser toolbars. Its height cap now uses `svh`.

### Decisions

- A plain press on a level toggles it rather than keeping only that level: a touch screen
  has no modifier key, and +2, +4, +6 has to be reachable there too. A long press keeps
  one level instead. A visible One/Many switch, and keeping tap-to-keep-one with written
  hints, were both considered and rejected.
- The ledger layout was chosen over two other mockups. Inventory cards hid level editing
  behind the dialog. A tabbed workbench with no dialog was rejected as well.
- Load and Edit were first two buttons, but they differed only in whether a later save
  wrote back into the entry, and the save box already asks that with Update and Save as
  new. So Load always opens the entry, and there is no Edit.
- A shared note travels as base64url of its UTF-8 bytes rather than percent-escaped. The
  link is then one run of letters, digits, `-` and `_`, with no space, `+` or `%` for a chat
  app to cut it at, and a Thai or emoji note comes out shorter than its escapes would.
- The export format is quoted plain text rather than JSON, so the same text reads well in
  a chat and imports back. The `>` quote is what tells a note from a code, so a note may
  say anything.
- Import never overwrites a code already saved: the note someone wrote for themselves
  outranks one that came from elsewhere, and an import that could overwrite a list is one
  nobody would run twice.
- Share appears only where the browser has a share sheet; elsewhere it would duplicate Copy
  link.
