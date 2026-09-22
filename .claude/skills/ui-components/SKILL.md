---
name: ui-components
description: Use when editing anything in src/components/, using a custom element from a route, styling in src/routes/base.css, or touching theming (theme-toggle, the theme-boot block) or cross-page links (src/lib/href.ts). Covers the element contracts, the shadow-DOM and token-scoping rules, and why hrefFor emits two link shapes.
---

# Components, theme and links

## Components

Every component is a `LitElement` with its own shadow root, carrying its own styles — there is no page-level selector reaching in, so each element is a markup change and nothing else to adopt in a new route. `src/components/theme.ts` exports two shared `css` chunks, `base` (box-sizing, font and colour inheritance onto `:host`) and `controls` (the button/input/select/label look), and every component composes them into its own `static styles` array alongside whatever is particular to it. Lit shares one `CSSStyleSheet` per `css` value across every component that adopts it, so importing `base` nine times costs one sheet, not nine.

Colour is read only through `--cr-*` custom properties — never a literal value — because those are what inherit through a shadow boundary. `src/routes/tokens.css` is the only place any of them is defined; a component reads one with `var(--cr-accent)` and defines none of its own. Dark is the default there and light is the variant, so a component that hardcodes a colour rather than reading a token also hardcodes a theme.

Reactive properties are declared with `@property()` and `@state()` from `lit/decorators.js` as plain class fields, not the `accessor` keyword the Lit docs lead with — `accessor` does not survive Bun's transpiler while `tsconfig.json` has `experimentalDecorators: true` set, which it does, with a FIXME linking bun#43097. `noImplicitOverride` is also on, so `static styles`, `render`, and every lifecycle method a component overrides (`connectedCallback`, `willUpdate`) need the `override` keyword, and so does a reactive property whose name collides with a member the DOM already declares — a `prefix` would, for instance, because `Element` has a readonly `prefix` of its own (its XML namespace prefix).

Every control dispatches its own untargeted `input` from the host, and the page listens for `input` on the enclosing form. The chips and cards are `<button>`s, so nothing composed escapes on its own and the host's event is the only one there is. Where a native control is involved the rule bites harder: a native `input` event is `bubbles: true, composed: true` and escapes the shadow root unaided, while `change` is not composed and dies at the boundary — so a component wrapping one has to stop the native event and re-dispatch its own, or the page hears a stale, composed echo of the control's last state. `<entry-tile>`, `<entry-tiles>` and `<code-bar>` additionally stop the `input` of the `<input>` inside their own shadow root outright: filtering a list is not a change of the control's value, and a code being typed is reported as a `code-draft`, not as a form change. `<theme-toggle>` follows the rule too, though nothing listens for what it dispatches: the rail sits outside the combi page's form. The rule has no exceptions, because "harmless where it happens to sit today" is not a property a component keeps.

Attributes carry markup-authored configuration; properties carry structured data the route hands over. Every `customElements.define` is guarded by `customElements.get`, because one `bun test` process shares one registry across every test file.

| Element | Attributes | Properties |
| --- | --- | --- |
| `<site-nav>` | `current` — tool slug, absent or empty means the home pane | — |
| `<theme-toggle>` | — | — |
| `<tool-index>` | — | — |
| `<code-bar>` | `value`, `message`, `invalid`, `placeholder`, `editing` | `value`, `hints`, `message`, `invalid`, `editing` |
| `<summary-line>` | — | `fields` |
| `<verdict-line>` | — | `verdict` |
| `<chip-group>` | `label` | `options`, `value` |
| `<card-group>` | `legend` | `options`, `selected` |
| `<entry-tile>` | `label` | `options`, `value`, `open` |
| `<entry-tiles>` | `legend` | `options`, `selected`, `open` |

`<site-nav>` and `<tool-index>` read the registry themselves; no route passes them data. `<site-nav>` renders `<theme-toggle>` as one of its own children, so there is no mount order for a page to get wrong.

`<code-bar>` is both halves of the combi page: it shows the code and it is the only place a code is entered. It decodes nothing. Typing reports a `code-draft` with the text so far; the page decodes that and hands back a `value`, a `message` and whether the message is an error. Clicking a run of the code emits `slot-jump` with that run's group name, which the page turns into the control to focus. Escape closes the editor and emits `code-cancel`, which is the page's cue to put the built code back.

The editor's text is held in the element's own `draft` state, seeded from `value` when the editor opens, and `value` is deliberately not written back into the field while it is open — the page decodes every keystroke and writes a new `value`, so binding the field to it would fight whoever is typing for the caret. `value` is the one observed attribute, because the markup ships an initial code and the page sets a new one on every change; setting it also clears the copy status, since a stale "Copied." beside a code that has since changed is a lie.

`<code-bar>`'s `hints` property takes one `{ char, hint, group }` per character of the current value and draws each run of one group as a `<button>`, with the tooltip bubble as its own CSS keyed off a `data-tooltip` attribute the component defines and styles itself. It labels; it never decides what a character means — that is the page's job. A list whose length does not match the value is dropped whole rather than misaligned, and setting `value` clears the hints, since against a newer code they would point at the wrong characters.

`<card-group>`'s `selected` getter reads an internal `Set` of ticked values rather than the rendered cards — Lit owns that DOM, so reading it back would be reading this element's own output rather than its state. The getter filters the element's own `options` against that set rather than reading DOM or click order, which is what keeps boosts in slot order and cookie powers in bit order: part of the wire format, not a preference. `<entry-tiles>`'s getter follows the same rule for the same reason: a treasure slot's alternatives are written in id order, so click order would produce a different code for the same slot.

All four value-holding list elements — `<card-group>`, `<entry-tile>`, `<entry-tiles>` and, in its own way, `<chip-group>` — refuse a value their current `options` do not contain, and the three multi-value ones do it in `willUpdate` as well as in the setter. The setter alone is not enough: `options` and the selection are two separate writes, so a list replaced underneath a pick would leave the dropped value in the internal set, invisible while it has no card and back the moment a later list contains it again. `<chip-group>` needs no pruning pass because it stores one value and its getter falls back to the first option whenever that value names none of them — which is what the `<select>` it replaced read as, and what `render` marks checked, so the getter can never disagree with the screen.

`<chip-group>` is a radio group wearing the site's button look: one tab stop for the whole row, arrows moving the choice as well as the focus, Home and End at the ends, clamped rather than wrapped. It replaces a `<select>` wherever the list is short enough to show whole — seeing the twelve episodes at once is the point, and a closed select hides eleven of them.

`<summary-line>` and `<verdict-line>` were one element and are two because the page pins them in different places: the summary is what the code says, so it rides in the sticky panel beside the code, while the verdict is a judgment about the build and sits down the page with the warnings. `<summary-line>` renders nothing at all — not an empty paragraph — when it has no fields, since an empty line in a sticky panel still costs its height on a phone.

`<card-group>`'s third option field is a *list* of pictures, not one: a cookie power+ can belong to several cookies or pets at once — Serenade of Love to two, EXP Party to four — and the card lays them out from a `data-count` attribute on its own frame. An empty list is what falls back to the lettered tile, so "no art" and "one picture" are the same code path with a different length.

`<entry-tile>` and `<entry-tiles>` each render inside a closed `<details>`, with the current pick on the summary line: six open grids over catalogs of 94 to 1,144 entries is a wall of scrolling, and a closed control still has to say what it holds. Only the first 50 matches are rendered, plus the current pick even when the filter excludes it, so the control never appears to have lost it. Their cells are a roving tabindex — one tab stop per grid, arrows and Home/End inside it, clamped at the ends — because 50 cells in each of six controls would otherwise be 300 tab stops between the loadout and the rest of the page. The arrow walk is linear in every direction on purpose: how many cells sit on a row is a layout answer the element would have to measure, and a walk that guesses wrong is worse than one that is consistent. After a pick, focus follows the same cell into its replacement; when a filter has hidden it, the search input takes focus instead, being the one element that survives every render. Both reflect an `open` property onto the host, because the page widens an open control to the full row and no page selector can see `details[open]` across a shadow boundary. Both also close on a `pointerdown` that lands outside themselves — `pointerdown` rather than `click` because it fires before focus moves, so the list is gone by the time whatever was clicked takes over, and the listener is added in `connectedCallback` and removed in `disconnectedCallback` so nothing listens on behalf of a control that has left the page. The two carry their own copy of that handler rather than sharing one: only presentation is shared between these components.

An image inside one of these frames carries the frame's measurements itself rather than a percentage of them. The frame is a grid area, so a percentage height — `height` and `max-height` alike — has nothing definite to resolve against, and the portrait falls back to its own height and overflows onto the name below it. Where a frame's size changes, the image's must change with it.

Each component is standalone in its logic, apart from the shared style chunks: every one imports `base` (most also `controls`) from `src/components/theme.ts`. `tileStyles` is the one style chunk that lives beside a component rather than in `theme.ts` — it is exported from `entry-tile.ts`, defined above the `EntryTile` class since `static styles` evaluates at class-definition time, and imported by `entry-tiles.ts` for the look the two controls share, along with `glyphFor`, the initials an entry falls back to when the catalog has no picture. Presentation is shared; the logic and the `Option` types are deliberately not — `<chip-group>` and `<card-group>` each declare their own `Option` type rather than sharing one, and `<entry-tile>` and `<entry-tiles>` do the same. A shared type between two components is the first step towards a component that cannot be read on its own. Beyond the style chunks, only `site-nav.ts` and `tool-index.ts` import anything else — `TOOLS` and `hrefFor` from `src/lib/`, plus `theme-toggle.ts` in the sidebar's case, since it renders one.

A CSS comment inside a `css` tagged template must not contain a backtick: it closes the template literal, and the failure surfaces as a parse error in the bundler rather than from the typechecker or Biome. Name a property in prose — max-height, not the quoted form.

`src/components/` imports from `src/lib/` and never from `src/routes/` — `src/components/verdict-line.ts` declares its own `Verdict` type rather than importing the structurally identical `AutoVerdict` from `src/routes/combi-name/describe.ts`, and `<code-bar>` declares its own `CharHint` rather than importing the one `hints.ts` exports. That is what keeps the arrow pointing one way.

Tests reach into a component through `shadowRoot` and await `updateComplete` after any change, since Lit's render is a microtask rather than synchronous. A handler that restores focus — the pick handlers of both catalog controls, and `<chip-group>`'s arrow walk — awaits its own `updateComplete` before it does, so a test asserting where focus lands has to settle twice: once for its own await, which resumes after the handler's, and again to actually observe the result. The component test files carry a `settle()` helper (`updateComplete` plus a zero-length `Bun.sleep`) for exactly this. A value bound with `.value=${...}` is a property and not an attribute, so a test looking for one control among several finds it by reading `button.value` back, not with an attribute selector.

What no test can show: happy-dom never resolves an inherited custom property, so nothing here proves a `--cr-*` token actually reaches a component, or that a colour, a border, or a layout looks right. The browser is the only verification that layer gets — a full green suite is not evidence the page is styled.

## Theme

`src/components/theme-toggle.ts` owns the light/dark choice. `src/routes/tokens.css` paints dark by default, light under `prefers-color-scheme`, and obeys `data-theme` on the root over both, so the whole feature is: remember a choice and write that attribute. Three states, and "system" is the absence of one — it removes `data-theme` and deletes the stored key rather than writing a third value, which is what hands the page back to the OS.

Each page's `<head>` carries a small inline copy of the read-and-apply step, marked `id="theme-boot"`. The module scripts are deferred, so without it a page paints in the system theme and flips once the saved choice loads. `src/lib/tools.test.ts` asserts every page has it.

Every storage call is wrapped: a browser that refuses `localStorage` still themes the page for that visit. `readTheme`, `writeTheme`, and `applyTheme` are plain functions exported alongside `<theme-toggle>` rather than folded into its `connectedCallback`, and the storage-refused test calls them directly rather than going through the element — a custom element hands a `connectedCallback` exception to the global error handler instead of throwing to whoever appended it, so routing that test through `<theme-toggle>` would pass whether or not the wrapping actually worked.

## Link shape

`hrefFor` in `src/lib/href.ts` writes every cross-page link, and writes it twice over:

- Served over http(s) it emits directories — `./combi-name/`, `../` — so the address bar reads `/combi-name`, not a filename.
- Under `file:` it appends `index.html`, because opening `dist/` from disk means nothing is there to serve a directory index and the bare directory link would dead-end.

Both forms stay relative, and that outlives the reason it started. The site was served from a GitHub Pages project subpath, where a root-relative `/combi-name` would have resolved against the domain root and missed; it now serves from a Cloudflare Worker at its own root, where such a link would happen to work. Relative links are still what the `file:` build needs, and they cost nothing, so the rule stands — but do not restate the old subpath justification as if it were live. A test covers all four combinations of depth and protocol; that is the guard against someone "simplifying" it back to one form.

`hrefFor` is `src/lib/`'s one deliberate brush with the DOM: it defaults its `protocol` argument to `globalThis.location?.protocol`, because every caller would otherwise pass the same thing. That is a default rather than a read — `src/lib/href.test.ts` hands the protocol in on every call and never touches `location`.
