---
name: ui-components
description: Use when editing anything in components/, using a custom element from a route, styling in routes/base.css, or touching theming (theme-toggle, the theme-boot block) or cross-page links (lib/href.ts). Covers the element contracts, the light-DOM and CSS-scoping rules, and why hrefFor emits two link shapes.
---

# Components, theme and links

## Components

Light DOM, no shadow root: Pico styles by element selector, and the two form components need `<form>` participation and label association. Component styles live in `routes/base.css` alongside the page frame, scoped by element name — including a `display` rule for each, since an unknown element is inline until a stylesheet says otherwise. They sit in the base sheet rather than beside each component or in the route that uses one, so that adopting an existing element in a new route is a markup change and nothing else.

The sidebar's rules reach through `nav` — `site-nav nav ul`, not `site-nav ul`. Pico styles `aside nav` and `aside li` directly, which used to cover this markup when the rail was an `<aside>`; with a custom element those rules match nothing, and the replacements need a third type selector to out-specify Pico's own `nav`/`nav li` rather than tie them and win on whichever sheet the bundler emits last.

Attributes carry markup-authored configuration; properties carry structured data the route hands over. Every `customElements.define` is guarded by `customElements.get`, because one `bun test` process shares one registry across every test file.

| Element | Attributes | Properties |
| --- | --- | --- |
| `<site-nav>` | `current` — tool slug, absent or empty means the home pane | — |
| `<theme-toggle>` | — | — |
| `<tool-index>` | — | — |
| `<labelled-select>` | `label` | `options`, `value` |
| `<check-group>` | `legend` | `options`, `selected` |
| `<copy-code>` | `value` | `value` |
| `<auto-verdict>` | `prefix` | `verdict` |

`<site-nav>` and `<tool-index>` read the registry themselves; no route passes them data. `<site-nav>` renders `<theme-toggle>` as one of its own children, so there is no mount order for a page to get wrong.

`<copy-code>` is the only element that observes an attribute, because the page sets a new code on every keystroke and the markup ships an initial one. Setting either the attribute or the property rewrites the code; setting the property also clears the copy status, since a stale "Copied." beside a code that has since changed is a lie.

`<check-group>`'s `selected` getter filters the element's own `options` rather than reading DOM order. That is what keeps boosts in slot order and cookie powers in bit order, and it is part of the wire format rather than a preference.

Each component is standalone by design. Only `site-nav.ts` and `tool-index.ts` import anything — `TOOLS` and `hrefFor` from `lib/`, plus `theme-toggle.ts` in the sidebar's case, since it renders one — and the other five import nothing at all. `<labelled-select>` and `<check-group>` even declare an `Option` pair type each rather than sharing one. A shared type between two components is the first step towards a component that cannot be read on its own.

`components/` imports from `lib/` and never from `routes/` — `components/auto-verdict.ts` declares its own `Verdict` type rather than importing the structurally identical `AutoVerdict` from `routes/combi-name/describe.ts`, which is what keeps that arrow pointing one way.

## Theme

`components/theme-toggle.ts` owns the light/dark choice. Pico paints light by default, dark under `prefers-color-scheme`, and obeys `data-theme` on the root over both, so the whole feature is: remember a choice and write that attribute. Three states, and "system" is the absence of one — it removes `data-theme` and deletes the stored key rather than writing a third value, which is what hands the page back to the OS.

Each page's `<head>` carries a small inline copy of the read-and-apply step, marked `id="theme-boot"`. The module scripts are deferred, so without it a page paints in the system theme and flips once the saved choice loads. `lib/tools.test.ts` asserts every page has it.

Every storage call is wrapped: a browser that refuses `localStorage` still themes the page for that visit. `components/theme-toggle.ts` exports `renderThemeControl` as a plain function as well as defining `<theme-toggle>` around it, because a custom element hands a `connectedCallback` exception to the global error handler instead of throwing to whoever appended it — the storage-refused test would pass vacuously through the element, so it calls the function directly.

## Link shape

`hrefFor` in `lib/href.ts` writes every cross-page link, and writes it twice over:

- Served over http(s) it emits directories — `./combi-name/`, `../` — so the address bar reads `/combi-name`, not a filename.
- Under `file:` it appends `index.html`, because opening `dist/` from disk means nothing is there to serve a directory index and the bare directory link would dead-end.

Both forms stay relative, and that outlives the reason it started. The site was served from a GitHub Pages project subpath, where a root-relative `/combi-name` would have resolved against the domain root and missed; it now serves from a Cloudflare Worker at its own root, where such a link would happen to work. Relative links are still what the `file:` build needs, and they cost nothing, so the rule stands — but do not restate the old subpath justification as if it were live. A test covers all four combinations of depth and protocol; that is the guard against someone "simplifying" it back to one form.

`hrefFor` is `lib/`'s one deliberate brush with the DOM: it defaults its `protocol` argument to `globalThis.location?.protocol`, because every caller would otherwise pass the same thing. That is a default rather than a read — `lib/href.test.ts` hands the protocol in on every call and never touches `location`.
