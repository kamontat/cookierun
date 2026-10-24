import { css } from "lit";

/** The initials an entry falls back to when the catalog has no picture. */
export function glyphFor(label: string): string {
	return label
		.split(/\s+/)
		.filter((word) => word.length > 0)
		.slice(0, 2)
		.map((word) => word[0]?.toUpperCase() ?? "")
		.join("");
}

/**
 * Holds the page still under an open picker, and hands back what lets it go.
 * A modal traps focus but not scroll. overflow: hidden on the root is enough
 * everywhere but iOS, which scrolls past it once the keyboard is up for the
 * search box, so the body is pinned where the page was and the page goes back
 * to that offset when the picker lets go. Shared with `<entry-tiles>`'s own
 * picker dialog, and with the route's Saved and Help drawers, since all three
 * open a modal the same way.
 */
export function lockPageScroll(): () => void {
	const root = document.documentElement;
	const body = document.body;
	const y = window.scrollY;
	root.style.overflow = "hidden";
	Object.assign(body.style, {
		position: "fixed",
		top: `${-y}px`,
		left: "0",
		right: "0",
	});
	return () => {
		root.style.overflow = "";
		Object.assign(body.style, { position: "", top: "", left: "", right: "" });
		window.scrollTo(0, y);
	};
}

/**
 * The look the board's catalog grids share, whether the grid sits behind a
 * dialog (`<entry-tiles>`, one treasure slot's alternatives) or inline on the
 * tab itself (`<entry-grid>`, episode/cookie/relay/pet): the tile button, the
 * art frame and its fallback glyph, and the dialog's own sheet and entries
 * grid. Each component keeps its own logic and its own `Option` type — only
 * the look is shared.
 */
export const tileStyles = css`
	:host {
		display: block;
	}

	/* A column, because the face is the thing being recognised: the role names
	   what the slot is for, the art answers it, and the name confirms what the
	   art already said. Side by side the art was a thumbnail beside a label;
	   stacked it is the tile. */
	button.tile {
		display: flex;
		flex-direction: column;
		gap: var(--cr-space-2);
		align-items: center;
		width: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
		box-shadow: none;
		padding: var(--cr-space-3) var(--cr-space-2);
		color: inherit;
		font-family: var(--cr-font);
		font-size: 0.9rem;
		text-align: center;
		text-transform: none;
		letter-spacing: normal;
	}

	button.tile:active {
		transform: none;
	}

	/* The only pick in its section. Stacked, it was a card with nothing beside
	   it; stretched across the board it was a banner. Laid on its side it is a
	   row of the sheet — the face leads, the name follows, and the count sits
	   at the far end saying what opens. The heading above it already names the
	   field, so the role label comes off the screen rather than out of the
	   tree: an unnamed button is a worse answer than a name said twice. */
	button.tile.inline {
		flex-direction: row;
		gap: var(--cr-space-3);
		align-items: center;
		text-align: left;
	}

	button.tile.inline .label {
		position: absolute;
		clip-path: inset(50%);
	}

	button.tile.inline .pick {
		flex: 1 1 auto;
		flex-direction: row;
		align-items: center;
	}

	button.tile.inline .art,
	button.tile.inline .art img {
		width: 2.5rem;
		height: 2.5rem;
	}

	button.tile.inline .count {
		flex: 0 0 auto;
		color: var(--cr-muted);
		font-family: var(--cr-mono);
		font-size: 0.7rem;
		letter-spacing: var(--cr-tracking);
	}

	/* A slot nobody has filled still has to invite a click, not just read
	   quieter than a filled one — the dashed frame is what says "empty" at a
	   glance, alongside the muted "None" text. */
	button.tile.empty {
		border-style: dashed;
		border-color: var(--cr-muted);
	}

	/* Keyed to [open], because the browser hides a closed dialog with its own
	   display: none and an author display wins over that whatever its
	   specificity — an unkeyed rule here draws every dialog on the page
	   inline, all the time.

	   The flex column is what lets max-height below actually bound .sheet: a
	   native <dialog> defaults to overflow-y: auto, so an unbounded child
	   simply grows the dialog past its cap and the whole dialog scrolls —
	   header, search box and all — instead of just .entries. Making the
	   dialog the flex container and .sheet a shrinkable flex item (below)
	   is what forces .sheet's height to actually stop at this box, border
	   included, rather than merely at some other rule's copy of the same
	   number: box-sizing: border-box already prices the border into this
	   max-height, and the flex algorithm carries that resolved size down
	   without a second calculation to keep in sync. */
	dialog[open] {
		display: flex;
		flex-direction: column;
		width: min(52rem, 94vw);
		max-height: 85vh;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface);
		padding: 0;
		color: var(--cr-text);
	}

	/* vh on a phone is the viewport with its toolbars hidden, so 85vh is
	   taller than the screen actually showing while they are up, and the
	   header and footer end up behind them. svh is the viewport with the
	   toolbars shown, which is what is on screen when the dialog opens. */
	@supports (height: 1svh) {
		dialog[open] {
			max-height: 85svh;
		}
	}

	dialog::backdrop {
		background: var(--cr-backdrop);
	}

	/* A flex column rather than a row template counted for a fixed number of
	   children: entry-tiles's sheet has four (header, input, .entries,
	   .more), or six whenever the kind row renders (header, .kinds, input,
	   .entries, footer, .more). A template keyed to a row count breaks the
	   moment either count changes; flex only needs .entries to claim the
	   leftover space, whatever else is around it. flex: 1 1 auto and
	   min-height: 0 are what let the dialog's own max-height (see above)
	   shrink this to fit, rather than .sheet growing past it and dragging
	   the dialog's own scrollbar along for the ride. */
	.sheet {
		display: flex;
		flex-direction: column;
		flex: 1 1 auto;
		min-height: 0;
		gap: var(--cr-space-2);
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

	.label {
		color: var(--cr-muted);
		font-family: var(--cr-mono);
		font-size: 0.7rem;
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
	}

	/* What the control holds, said on the closed line — the question a closed
	   control has to answer without being opened. */
	.pick {
		display: flex;
		flex-direction: column;
		flex: 0 1 auto;
		gap: var(--cr-space-2);
		align-items: center;
		min-width: 0;
		font-size: 0.9rem;
		line-height: 1.25;
	}

	.pick.empty {
		color: var(--cr-muted);
	}

	.art {
		display: grid;
		flex: 0 0 auto;
		place-items: center;
		width: 3rem;
		height: 3rem;
	}

	/* The image carries the frame's measurements itself rather than a
	   percentage of them. The frame is a grid area, so a percentage on the
	   image — height and max-height alike — has nothing definite to resolve
	   against, and the portrait falls back to its own height, overflowing onto
	   the name below it. The two lengths must stay in step. */
	.art img {
		width: 3rem;
		height: 3rem;
		object-fit: contain;
	}

	.glyph {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-bg);
		color: var(--cr-muted);
		font-family: var(--cr-mono);
		font-size: 0.85rem;
	}

	/* A grid of faces, not a list of names: the whole reason these catalogs
	   carry pictures is that a cookie is quicker to recognise than to read.
	   flex: 1 1 auto and min-height: 0 are what let this row claim the sheet's
	   leftover space and scroll in it, whatever else the sheet holds.

	   The rows are sized to their content outright: WebKit sizes an auto row
	   of buttons in a shrunken grid to the buttons' min-height, which under a
	   coarse pointer is the tap size, and every name below its picture then
	   spills into the row underneath. */
	.entries {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr));
		grid-auto-rows: max-content;
		align-content: start;
		gap: var(--cr-space-1);
		overflow-y: auto;
		/* Reaching either end of the grid stops there rather than handing the
		   rest of the swipe to the page behind the dialog. */
		overscroll-behavior: contain;
		flex: 1 1 auto;
		min-height: 0;
	}

	.entry {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--cr-space-1);
		border: var(--cr-border) solid transparent;
		border-radius: var(--cr-radius);
		background: none;
		box-shadow: none;
		padding: var(--cr-space-1);
		color: inherit;
		font-family: var(--cr-font);
		font-size: 0.7rem;
		line-height: 1.2;
		text-align: center;
		text-transform: none;
		letter-spacing: normal;
	}

	.entry:active {
		transform: none;
	}

	/* Smaller in the grid than on the closed line, frame and image together. */
	.entry .art,
	.entry .art img {
		width: 2.75rem;
		height: 2.75rem;
	}

	.entry[aria-selected="true"],
	.entry[aria-checked="true"] {
		border-color: var(--cr-accent);
		background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
		font-weight: 600;
	}

	.more {
		display: block;
		margin-top: var(--cr-space-1);
		color: var(--cr-muted);
		font-size: 0.75rem;
	}
`;
