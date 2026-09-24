import { css, html, LitElement } from "lit";

import { formatBuiltAt, REPO_URL, readBuildInfo } from "#lib/build-info";

import { base } from "./theme";

/**
 * The line every page ends on: where the source is, which commit the page was
 * built from, and when. Like `<site-nav>` and `<tool-index>` it reads what it
 * shows rather than being handed it, so a page hosts it with an empty tag.
 *
 * Read at render time rather than at module load: the values come from the
 * environment, and a test that sets one wants the component to see it.
 */
export class SiteFooter extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
				border-top: var(--cr-border) solid var(--cr-line);
				background: var(--cr-surface);
				padding: var(--cr-space-3);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
			}

			/* A row that wraps rather than one that scrolls: on a phone this is
			   the last thing on the page, so a second line costs nothing. */
			.line {
				display: flex;
				flex-wrap: wrap;
				align-items: baseline;
				gap: var(--cr-space-2);
				margin: 0;
				max-width: 68rem;
			}

			a {
				color: var(--cr-accent);
				text-decoration: none;
			}

			a:hover {
				text-decoration: underline;
			}

			a:focus-visible {
				outline: var(--cr-border) solid var(--cr-accent);
				outline-offset: 2px;
			}

			/* The separators are decoration between the parts, so they are read
			   past rather than out. They wear the text's own colour: the line
			   token is near-black on paper and barely off the surface in the
			   dark, so one separator would be heavier than the text it divides
			   and the other invisible. */
			.sep {
				color: var(--cr-muted);
			}

			/* Inherited from the host, which a shadow root's own monospace
			   elements do not do on their own. */
			code,
			time {
				font: inherit;
			}

			/* A link is not a button, so the shared chunk's hit area never reaches
			   it - the same rule the sidebar's links carry. */
			@media (pointer: coarse) {
				a {
					display: inline-flex;
					align-items: center;
					min-height: var(--cr-tap);
				}
			}
		`,
	];

	override render() {
		const info = readBuildInfo();

		const parts = [];
		if (info.commitUrl !== null) {
			parts.push(
				html`<a href=${info.commitUrl} aria-label=${`Commit ${info.shortCommit}`}
					><code>${info.shortCommit}</code></a
				>`,
			);
		}
		if (info.builtAt !== null) {
			parts.push(
				html`<span
					>built
					<time datetime=${info.builtAt.toISOString()}
						>${formatBuiltAt(info.builtAt)}</time
					></span
				>`,
			);
		}

		// Every `bun run dev` and every local build lands here, so the line says
		// what it is rather than leaving the reader with a bare repository link
		// and no idea what they are looking at.
		const rest = parts.length === 0 ? [html`<span>local build</span>`] : parts;

		return html`<p class="line">
			<a href=${REPO_URL}>GitHub</a>
			${rest.map(
				(part) => html`<span class="sep" aria-hidden="true">·</span>${part}`,
			)}
		</p>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"site-footer": SiteFooter;
	}
}

if (!customElements.get("site-footer")) {
	customElements.define("site-footer", SiteFooter);
}
