import { css } from "lit";

/**
 * A page-level reset does not cross a shadow boundary, so every shadow root
 * needs its own. This is the minimum that matters: the box model, and the
 * font inheritance that form controls refuse by default.
 *
 * Lit shares one `CSSStyleSheet` instance across every component adopting the
 * same `CSSResult`, so importing this nine times costs one sheet.
 */
export const base = css`
	*,
	*::before,
	*::after {
		box-sizing: border-box;
	}

	button,
	input,
	select {
		font: inherit;
		color: inherit;
	}

	:host {
		font-family: var(--cr-font);
		color: var(--cr-text);
	}
`;

/**
 * The control primitives, shared because a select in the sidebar and a select
 * in the builder are the same control. Two-pixel edges, hard offset blocks,
 * no blur anywhere: that is the whole visual language.
 */
export const controls = css`
	button {
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-surface-2);
		padding: var(--cr-space-1) var(--cr-space-3);
		box-shadow: var(--cr-block);
		font-family: var(--cr-mono);
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
		cursor: pointer;
		/* The press gesture below is the feedback; the platform's own grey wash
		   over it just makes the button look broken for a moment.
		   manipulation turns off the double-tap-to-zoom wait. */
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;
	}

	/* Pressed means moved into its own shadow, which is the arcade gesture. */
	button:active {
		transform: translate(2px, 2px);
		box-shadow: none;
	}

	button:focus-visible,
	input:focus-visible,
	select:focus-visible,
	summary:focus-visible {
		outline: var(--cr-border) solid var(--cr-accent);
		outline-offset: 2px;
	}

	input,
	select {
		width: 100%;
		border: var(--cr-border) solid var(--cr-line);
		border-radius: var(--cr-radius);
		background: var(--cr-bg);
		padding: var(--cr-space-1) var(--cr-space-2);
	}

	label {
		display: block;
		color: var(--cr-muted);
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: var(--cr-tracking);
	}

	/* Under a coarse pointer every control grows to the platform hit area.
	   Keyed off the pointer rather than the width, because a narrow window on
	   a desktop is still a mouse.

	   A component whose control is deliberately smaller than this - a code run
	   in <code-bar> - says so with a more specific selector, which outbids
	   these bare ones. */
	@media (pointer: coarse) {
		button,
		input,
		select {
			min-height: var(--cr-tap);
		}
	}
`;
