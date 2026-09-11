import { hrefFor } from "#lib/href.ts";
import { TOOLS } from "#lib/tools.ts";

/**
 * The home pane's index. The sidebar carries the same names, but only as
 * names - this is where a tool gets to say what it does.
 */
export class ToolIndex extends HTMLElement {
	connectedCallback(): void {
		const list = document.createElement("dl");
		list.replaceChildren(
			...TOOLS.flatMap(({ slug, name, tagline }) => {
				const link = document.createElement("a");
				link.href = hrefFor(slug, null);
				link.textContent = name;

				const term = document.createElement("dt");
				term.append(link);

				const detail = document.createElement("dd");
				detail.textContent = tagline;

				return [term, detail];
			}),
		);

		this.replaceChildren(list);
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
