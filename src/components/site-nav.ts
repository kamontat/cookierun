import { css, html, LitElement, nothing } from "lit";
import { property } from "lit/decorators.js";

import { hrefFor } from "#lib/href";
import { TOOLS, type ToolSlug } from "#lib/tools";

import { base } from "./theme";
import "./theme-toggle";

/**
 * The sidebar every page carries. Navigation comes from the registry, so
 * nothing in any page's markup names another tool, and the theme control is
 * rendered here rather than left as a slot for the page to fill.
 */
export class SiteNav extends LitElement {
	static override styles = [
		base,
		css`
			/* Full viewport height, not the height of its links: a rail that stops
			   halfway down the page reads as a panel that failed to load. */
			:host {
				display: flex;
				flex-direction: column;
				position: sticky;
				top: 0;
				grid-row: 1 / -1;
				align-self: start;
				height: 100dvh;
				overflow-y: auto;
				padding: var(--cr-space-4) var(--cr-space-3);
				border-right: var(--cr-border) solid var(--cr-line);
				background: var(--cr-surface);
			}

			.title {
				margin: 0 0 var(--cr-space-3);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
				font-weight: 600;
				letter-spacing: var(--cr-tracking);
				text-transform: uppercase;
			}

			/* Spaced, or the hovered link and the current one run together into a
			   single slab and neither reads as its own button. */
			ul {
				display: grid;
				gap: var(--cr-space-1);
				margin: 0;
				padding: 0;
				list-style: none;
			}

			a {
				display: block;
				padding: var(--cr-space-1) var(--cr-space-2);
				border-left: var(--cr-border) solid transparent;
				color: inherit;
				font-family: var(--cr-mono);
				text-decoration: none;
			}

			/* Lighter than the current-page tint below, or hovering a link would
			   look more like "you are here" than being there does. */
			a:hover {
				background: color-mix(in srgb, var(--cr-accent) 7%, transparent);
			}

			a:focus-visible {
				outline: var(--cr-border) solid var(--cr-accent);
				outline-offset: 2px;
			}

			/* Tint plus a marker, the same gesture the entry rows use. A solid
			   block here would outshout the code the tool exists to produce. */
			a[aria-current="page"] {
				border-left-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
				font-weight: 600;
			}

			/* Settling, not navigating: the theme control sits at the far end of
			   the rail so it never competes with the tool list. */
			theme-toggle {
				margin-top: auto;
				padding-top: var(--cr-space-3);
			}

			/* Under the breakpoint the rail stops being a column and rides along
			   the top as a single row: links on the left, theme control at the
			   far end, nothing wrapping onto a second line. Everything this bar
			   costs is taken off the top of a phone screen, above a page whose
			   own code panel is pinned there. */
			@media (width < 48rem) {
				:host {
					flex-direction: row;
					align-items: center;
					gap: var(--cr-space-3);
					position: static;
					grid-row: auto;
					height: auto;
					overflow: visible;
					padding: var(--cr-space-2) var(--cr-space-3);
					border-right: 0;
					border-bottom: var(--cr-border) solid var(--cr-line);
				}

				/* The masthead's own h1 names the site on every page, and on one
				   line there is no room to say it twice. */
				.title {
					display: none;
				}

				/* The list scrolls sideways rather than wrapping. A second row of
				   links costs the same screen the code panel below it wants, and
				   the registry can grow without the bar growing with it. */
				nav {
					flex: 1 1 auto;
					min-width: 0;
					overflow-x: auto;
				}

				ul {
					display: flex;
					flex-wrap: nowrap;
					gap: var(--cr-space-2);
				}

				a {
					white-space: nowrap;
				}

				theme-toggle {
					flex: 0 0 auto;
					margin-top: 0;
					padding-top: 0;
				}
			}

			/* A link is not a button, so the shared chunk's hit area never
			   reaches it. Flex rather than block, or the label sits at the top of
			   the taller box instead of in the middle of it. */
			@media (pointer: coarse) {
				a {
					display: flex;
					align-items: center;
					min-height: var(--cr-tap);
				}
			}
		`,
	];

	@property({ type: String })
	current = "";

	override render() {
		// A cast here would let a typo through as a truthy `from`: hrefFor would
		// then write `../`-prefixed links for a page that was never registered,
		// sending every link outside the site instead of merely failing to mark
		// anything current.
		const active = TOOLS.some((tool) => tool.slug === this.current)
			? (this.current as ToolSlug)
			: null;

		const entries = [
			{ href: hrefFor(null, active), label: "Home", current: active === null },
			...TOOLS.map(({ slug, name }) => ({
				href: hrefFor(slug, active),
				label: name,
				current: slug === active,
			})),
		];

		return html`
			<p class="title">Cookie Run tools</p>
			<nav aria-label="Tools">
				<ul>
					${entries.map(
						({ href, label, current }) => html`<li>
							<a href=${href} aria-current=${current ? "page" : nothing}
								>${label}</a
							>
						</li>`,
					)}
				</ul>
			</nav>
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
