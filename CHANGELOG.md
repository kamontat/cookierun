# Changelog

What changed in this project and why, newest first.

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
