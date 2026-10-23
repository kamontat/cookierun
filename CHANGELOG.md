# Changelog

What changed in this project and why, newest first.

## 2026-10-23: Treasure slots as rows with a one-line level strip

### Features

- Each pick in a treasure slot shows its levels as one strip of ten cells, +0 to +9, with a
  summary beside it such as `+9`, `+7–9`, `+0, +2–4` or `any`, replacing the 5×2 button grid.
- Holding a level for half a second keeps that level alone, so +0 to +9 is one gesture.
  Dragging across the strip, or shift-pressing a level on desktop, selects a range.
- An `any` button beside each strip turns on all ten levels, and pressing it again goes
  back to +0.
- A filled treasure slot ends with a "+ Add alternative" button that opens the picker.

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
