import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { hrefFor } from "#lib/href";
import { TOOLS, type ToolSlug } from "#lib/tools";

import { base, controls } from "./theme";
import "./theme-toggle";

/**
 * The top bar every page carries, in place of the sidebar: the brand, a menu
 * naming the current tool (or "All tools" on the home pane), a default slot
 * for whatever a page wants beside them — the combi page's Saved and Help
 * buttons, in a later task — and the theme control. Navigation comes from the
 * registry, so nothing in any page's markup names another tool.
 *
 * The brand's icon is a named `icon` slot rather than an attribute or
 * property: Bun's HTML bundler rewrites (and inlines) an `<img src>` written
 * in a page's own markup at build time, but it never reaches into a custom
 * element's attribute to do the same, so a bare `icon` attribute would ship
 * the file untouched instead of the data URI every other icon on the page
 * gets. A page hands the icon over as light-DOM markup instead, the same way
 * the combi page will later hand over its own slotted buttons.
 */
export class SiteNav extends LitElement {
	static override styles = [
		base,
		controls,
		css`
			/* Its own stacking layer, above the page's sticky code panel and tab
			   strip (z-index 2 and 1): the tool menu hangs out of the bar over
			   the page, and once the page has scrolled the code panel sticks
			   right where the menu opens. Without this the panel paints over it. */
			:host {
				position: relative;
				z-index: 3;
				display: flex;
				align-items: center;
				gap: var(--cr-space-3);
				border-bottom: var(--cr-border) solid var(--cr-line);
				background: var(--cr-surface);
				padding: var(--cr-space-2) var(--cr-space-3);
			}

			/* One line on a phone: the gaps tighten, and the tool menu's button
			   gives way first, ending in an ellipsis rather than wrapping the
			   bar onto four lines. */
			@media (width < 48rem) {
				:host {
					gap: var(--cr-space-2);
				}

				.switcher {
					min-width: 0;
				}

				.switcher > summary {
					display: block;
					overflow: hidden;
					text-overflow: ellipsis;
					white-space: nowrap;
				}
			}

			.brand {
				display: flex;
				align-items: center;
				gap: var(--cr-space-2);
				color: inherit;
				font-family: var(--cr-mono);
				font-weight: 600;
				letter-spacing: var(--cr-tracking);
				text-decoration: none;
			}

			.brand ::slotted(img) {
				width: 1.75rem;
				height: 1.75rem;
				object-fit: contain;
			}

			/* The masthead's own h1 names the site on every page, and the bar has
			   no room to say it twice beside the icon under 48rem. Visually hidden
			   rather than removed, so the link keeps its accessible name. */
			@media (width < 48rem) {
				.brand-text {
					position: absolute;
					width: 1px;
					height: 1px;
					margin: -1px;
					overflow: hidden;
					clip-path: inset(50%);
					white-space: nowrap;
				}
			}

			.switcher {
				position: relative;
			}

			summary {
				display: inline-flex;
				align-items: center;
				gap: var(--cr-space-1);
				list-style: none;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface-2);
				box-shadow: var(--cr-block);
				padding: var(--cr-space-1) var(--cr-space-3);
				font-family: var(--cr-mono);
				font-size: 0.85rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
				cursor: pointer;
				touch-action: manipulation;
				-webkit-tap-highlight-color: transparent;
			}

			/* The browser's own disclosure triangle would duplicate the ▾ the
			   summary's own text already carries. */
			summary::-webkit-details-marker {
				display: none;
			}

			summary::marker {
				content: "";
			}

			nav {
				position: absolute;
				top: calc(100% + var(--cr-space-1));
				left: 0;
				z-index: 1;
				display: flex;
				flex-direction: column;
				min-width: 16rem;
				max-width: 22rem;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface);
				box-shadow: var(--cr-block);
				padding: var(--cr-space-2);
			}

			.divider {
				margin: var(--cr-space-2) 0 var(--cr-space-1);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.7rem;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			nav a {
				display: flex;
				flex-direction: column;
				gap: 0.15rem;
				border-left: var(--cr-border) solid transparent;
				padding: var(--cr-space-1) var(--cr-space-2);
				color: inherit;
				text-decoration: none;
			}

			/* Lighter than the current-page tint below, or hovering a link would
			   look more like "you are here" than being there does. */
			nav a:hover {
				background: color-mix(in srgb, var(--cr-accent) 7%, transparent);
			}

			nav a:focus-visible {
				outline: var(--cr-border) solid var(--cr-accent);
				outline-offset: 2px;
			}

			nav a[aria-current="page"] {
				border-left-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
				font-weight: 600;
			}

			nav a .tagline {
				color: var(--cr-muted);
				font-family: var(--cr-font);
				font-size: 0.75rem;
				font-weight: 400;
				letter-spacing: normal;
				text-transform: none;
				white-space: normal;
			}

			/* The slotted page actions sit at the far end of the bar with the
			   theme control after them, pushed there by margin-left: auto on the
			   default slot itself rather than on whatever a page puts in it - a
			   page could slot more than one action. A slot is display: contents
			   by default, where a margin does nothing, so it is a flex row of its
			   own; gap inherits from the host's. */
			slot:not([name]) {
				display: flex;
				align-items: center;
				gap: inherit;
				margin-left: auto;
			}

			/* A link is not a button, so the shared chunk's hit area never
			   reaches it. */
			@media (pointer: coarse) {
				a {
					min-height: var(--cr-tap);
				}
			}
		`,
	];

	@property({ type: String })
	current = "";

	#details(): HTMLDetailsElement | null {
		return this.shadowRoot?.querySelector("details.switcher") ?? null;
	}

	#summary(): HTMLElement | null {
		return this.shadowRoot?.querySelector("summary") ?? null;
	}

	#closeMenu(): void {
		const details = this.#details();
		if (details !== null) details.open = false;
	}

	/**
	 * Bound once as a class field rather than a method, so add/removeEventListener
	 * compare equal across calls - document hears this for as long as the
	 * element is connected, since a click outside this element's own shadow
	 * tree is a click the element never otherwise sees.
	 */
	#onDocumentClick = (event: Event): void => {
		if (event.composedPath().includes(this)) return;
		this.#closeMenu();
	};

	/** Escape closes the menu and sends focus back to the button that opened it. */
	#onKeydown = (event: KeyboardEvent): void => {
		if (event.key !== "Escape") return;
		const details = this.#details();
		if (details === null || !details.open) return;
		event.preventDefault();
		details.open = false;
		this.#summary()?.focus();
	};

	override connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("click", this.#onDocumentClick);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("click", this.#onDocumentClick);
	}

	override render() {
		// A cast here would let a typo through as a truthy `from`: hrefFor would
		// then write `../`-prefixed links for a page that was never registered,
		// sending every link outside the site instead of merely failing to mark
		// anything current.
		const active = TOOLS.some((tool) => tool.slug === this.current)
			? (this.current as ToolSlug)
			: null;

		const currentTool = TOOLS.find((tool) => tool.slug === active);
		const home = hrefFor(null, active);

		return html`
			<a class="brand" href=${home}>
				<slot name="icon"></slot>
				<span class="brand-text">Cookie Run tools</span>
			</a>
			<details class="switcher" @keydown=${this.#onKeydown}>
				<summary>${currentTool?.name ?? "All tools"} ▾</summary>
				<nav aria-label="Tools">
					<a
						href=${home}
						aria-current=${active === null ? "page" : nothing}
						@click=${() => {
							this.#closeMenu();
						}}
						>All tools</a
					>
					<p class="divider">Tools</p>
					${TOOLS.map(
						({ slug, name, tagline }) => html`<a
							href=${hrefFor(slug, active)}
							aria-current=${slug === active ? "page" : nothing}
							@click=${() => {
								this.#closeMenu();
							}}
						>
							<span class="name">${name}</span>
							<span class="tagline">${tagline}</span>
						</a>`,
					)}
				</nav>
			</details>
			<slot></slot>
			<theme-toggle></theme-toggle>
		`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"site-nav": SiteNav;
	}
}

if (!customElements.get("site-nav")) {
	customElements.define("site-nav", SiteNav);
}
