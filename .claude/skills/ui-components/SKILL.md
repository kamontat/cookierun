---
name: ui-components
description: Use when editing anything in src/components/, using a custom element from a route, styling in src/routes/base.css, or touching theming (theme-toggle, the theme-boot block) or cross-page links (src/lib/href.ts). Covers the element contracts, the shadow-DOM and token-scoping rules, and why hrefFor emits two link shapes.
---

# Components, theme and links

## Components

Every component is a `LitElement` with its own shadow root, carrying its own styles — there is no page-level selector reaching in, so each element is a markup change and nothing else to adopt in a new route. `src/components/theme.ts` exports two shared `css` chunks, `base` (box-sizing, font and colour inheritance onto `:host`) and `controls` (the button/input/select/label look), and every component composes them into its own `static styles` array alongside whatever is particular to it. Lit shares one `CSSStyleSheet` per `css` value across every component that adopts it, so importing `base` nine times costs one sheet, not nine.

Colour is read only through `--cr-*` custom properties — never a literal value — because those are what inherit through a shadow boundary. `src/routes/tokens.css` is the only place any of them is defined; a component reads one with `var(--cr-accent)` and defines none of its own. Dark is the default there and light is the variant, so a component that hardcodes a colour rather than reading a token also hardcodes a theme.

Reactive properties are declared with `@property()` and `@state()` from `lit/decorators.js` as plain class fields, not the `accessor` keyword the Lit docs lead with — `accessor` does not survive Bun's transpiler while `tsconfig.json` has `experimentalDecorators: true` set, which it does, with a FIXME linking bun#43097. `noImplicitOverride` is also on, so `static styles`, `render`, and every lifecycle method a component overrides (`connectedCallback`, `willUpdate`) need the `override` keyword, and so does a reactive property whose name collides with a member the DOM already declares — `<auto-verdict>`'s `prefix` does, because `Element` has a readonly `prefix` of its own (its XML namespace prefix).

A native form control's `input` event is `bubbles: true, composed: true` — it already escapes a shadow root unaided — but `change` is not composed and dies at the boundary. `<labelled-select>` and `<check-group>` therefore stop the control's own `input`, update their internal state, and dispatch their own untargeted `input` from the host; the page listens for `input` on the enclosing form and would otherwise hear a stale, composed echo of the control's last state (from `change` never arriving to correct it), or nothing. `<entry-picker>` and `<entry-set>` follow the same rule for their picks, and additionally stop the `input` event of the `<input type="search">` inside their own shadow root — filtering the list is not a change of the component's value, so that event must never reach the page at all. `<theme-toggle>` follows it too, though nothing listens for what it dispatches: the rail sits outside both of the combi page's forms. The rule has no exceptions, because "harmless where it happens to sit today" is not a property a component keeps.

Attributes carry markup-authored configuration; properties carry structured data the route hands over. Every `customElements.define` is guarded by `customElements.get`, because one `bun test` process shares one registry across every test file.

| Element | Attributes | Properties |
| --- | --- | --- |
| `<site-nav>` | `current` — tool slug, absent or empty means the home pane | — |
| `<theme-toggle>` | — | — |
| `<tool-index>` | — | — |
| `<labelled-select>` | `label` | `options`, `value` |
| `<check-group>` | `legend` | `options`, `selected` |
| `<copy-code>` | `value` | `value`, `hints` |
| `<auto-verdict>` | `prefix` | `verdict` |
| `<entry-picker>` | `label` | `options`, `value` |
| `<entry-set>` | `legend` | `options`, `selected` |

`<site-nav>` and `<tool-index>` read the registry themselves; no route passes them data. `<site-nav>` renders `<theme-toggle>` as one of its own children, so there is no mount order for a page to get wrong.

`<copy-code>` is the only element that observes an attribute, because the page sets a new code on every keystroke and the markup ships an initial one. Setting either the attribute or the property rewrites the code; setting the property also clears the copy status, since a stale "Copied." beside a code that has since changed is a lie.

`<check-group>`'s `selected` getter reads an internal `Set` of ticked values, not `input:checked` — Lit owns the DOM now, so reading the rendered checkboxes back would be reading this element's own output rather than its state. The getter filters the element's own `options` against that set rather than reading DOM or tick order, which is what keeps boosts in slot order and cookie powers in bit order: part of the wire format, not a preference. `<entry-set>`'s getter follows the same rule for the same reason: a treasure slot's alternatives are written in id order, so click order would produce a different code for the same slot.

All three multi-value elements — `<check-group>`, `<entry-picker>`, `<entry-set>` — prune a selection the current `options` no longer contains, and all three do it in `willUpdate` as well as in the setter. The setter alone is not enough: `options` and the selection are two separate writes, so a list replaced underneath a pick would leave the dropped value in the internal set, invisible while it has no row and back the moment a later list contains it again.

`<copy-code>`'s `hints` property takes one `{ char, hint, group }` per character of the current value and draws each run of one group as a `<span>` with the tooltip bubble as its own CSS, keyed off a `data-tooltip` attribute the component defines and styles itself. It labels; it never decides what a character means — that is the page's job. A list whose length does not match the value is dropped whole rather than misaligned, and setting `value` clears the hints, since against a newer code they would point at the wrong characters.

`<entry-picker>` and `<entry-set>` each render inside a closed `<details>`, with the current pick on the summary line: six open lists over catalogs of 94 to 1,144 entries is a wall of scrolling, and a closed control still has to say what it holds. Their rows are a roving tabindex — one tab stop per list, arrows and Home/End inside it, clamped at the ends — because 50 rendered rows in each of six controls would otherwise be 300 tab stops between the loadout and the rest of the page. After a pick, focus follows the same row into its replacement; when a filter has hidden it, the search input takes focus instead, being the one element that survives every render.

Each component is standalone in its logic, apart from the shared style chunks: every one imports `base` (most also `controls`) from `src/components/theme.ts`. `entryStyles` is the one style chunk that lives beside a component rather than in `theme.ts` — it is exported from `entry-picker.ts`, defined above the `EntryPicker` class since `static styles` evaluates at class-definition time, and imported by `entry-set.ts` for the look the two controls share. Presentation is shared; the logic and the `Option` types are deliberately not — `<labelled-select>` and `<check-group>` each declare their own `Option` pair type rather than sharing one, and `<entry-picker>` and `<entry-set>` do the same. A shared type between two components is the first step towards a component that cannot be read on its own. Beyond the style chunks, only `site-nav.ts` and `tool-index.ts` import anything else — `TOOLS` and `hrefFor` from `src/lib/`, plus `theme-toggle.ts` in the sidebar's case, since it renders one.

`src/components/` imports from `src/lib/` and never from `src/routes/` — `src/components/auto-verdict.ts` declares its own `Verdict` type rather than importing the structurally identical `AutoVerdict` from `src/routes/combi-name/describe.ts`, which is what keeps that arrow pointing one way.

Tests reach into a component through `shadowRoot` and await `updateComplete` after any change, since Lit's render is a microtask rather than synchronous. A handler that restores focus — `<entry-picker>`'s and `<entry-set>`'s pick handlers both do — awaits its own `updateComplete` before it does, so a test asserting where focus lands has to settle twice: once for its own await, which resumes after the handler's, and again to actually observe the result. The component test files carry a `settle()` helper (`updateComplete` plus a zero-length `Bun.sleep`) for exactly this.

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
