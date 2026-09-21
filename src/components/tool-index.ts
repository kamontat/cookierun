import { css, html, LitElement } from "lit";

import { hrefFor } from "#lib/href";
import { TOOLS } from "#lib/tools";

import { base } from "./theme";

/**
 * The home pane's index. The sidebar carries the same names, but only as
 * names - this is where a tool gets to say what it does.
 */
export class ToolIndex extends LitElement {
	static override styles = [
		base,
		css`
			:host {
				display: block;
			}

			dl {
				margin: 0;
			}

			dt {
				font-family: var(--cr-mono);
				font-size: 1.05rem;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			dt a {
				color: var(--cr-accent);
				text-decoration: none;
			}

			dt a:hover {
				text-decoration: underline;
			}

			dd {
				margin: var(--cr-space-1) 0 var(--cr-space-3);
				max-width: 46rem;
				color: var(--cr-muted);
			}

			dd:last-child {
				margin-bottom: 0;
			}
		`,
	];

	override render() {
		return html`<dl>
			${TOOLS.map(
				({ slug, name, tagline }) => html`
					<dt><a href=${hrefFor(slug, null)}>${name}</a></dt>
					<dd>${tagline}</dd>
				`,
			)}
		</dl>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"tool-index": ToolIndex;
	}
}

if (!customElements.get("tool-index")) {
	customElements.define("tool-index", ToolIndex);
}
