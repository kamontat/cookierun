export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

/**
 * A type-to-filter list that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * Only the first `LIMIT` matches are rendered, because three of these plus
 * three `<entry-set>`s over the same catalog would otherwise put tens of
 * thousands of rows in one page. The selected row is always rendered, even when
 * the filter excludes it, so the control never appears to have lost the pick.
 */
export class EntryPicker extends HTMLElement {
	readonly #search = document.createElement("input");
	readonly #list = document.createElement("div");
	readonly #more = document.createElement("small");
	#options: readonly Option[] = [];
	#value: string | null = null;
	#built = false;

	connectedCallback(): void {
		if (this.#built) return;
		this.#built = true;

		const id = `entry-picker-${Math.random().toString(36).slice(2, 8)}`;

		const label = document.createElement("label");
		label.textContent = this.getAttribute("label") ?? "";
		label.htmlFor = id;

		this.#search.type = "search";
		this.#search.id = id;
		this.#search.autocomplete = "off";
		this.#search.placeholder = "Type to filter";
		this.#search.addEventListener("input", (event) => {
			// Filtering is not a change of value, so it must not read as one.
			event.stopPropagation();
			this.#render();
		});

		this.#list.className = "entries";
		this.#more.className = "more";

		const field = document.createElement("div");
		field.className = "field";
		field.replaceChildren(label, this.#search, this.#list, this.#more);
		this.replaceChildren(field);
		this.#render();
	}

	get options(): readonly Option[] {
		return this.#options;
	}

	set options(options: readonly Option[]) {
		this.#options = options;
		if (this.#value !== null && !this.#has(this.#value)) this.#value = null;
		this.#render();
	}

	get value(): string | null {
		return this.#value;
	}

	set value(value: string | null) {
		this.#value = value !== null && this.#has(value) ? value : null;
		this.#render();
	}

	#has(value: string): boolean {
		return this.#options.some(([candidate]) => candidate === value);
	}

	#matches(): { shown: readonly Option[]; total: number } {
		const needle = this.#search.value.trim().toLowerCase();
		const matching =
			needle === ""
				? this.#options
				: this.#options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		const capped = matching.slice(0, LIMIT);
		const total = matching.length;
		if (this.#value === null) return { shown: capped, total };
		if (capped.some(([value]) => value === this.#value)) {
			return { shown: capped, total };
		}

		const picked = this.#options.find(([value]) => value === this.#value);
		return {
			shown: picked === undefined ? capped : [picked, ...capped],
			total,
		};
	}

	#row(value: string, text: string, image: string | null): HTMLElement {
		const button = document.createElement("button");
		button.type = "button";
		button.value = value;
		button.className = "entry";
		button.setAttribute("aria-selected", String((this.#value ?? "") === value));
		button.addEventListener("click", () => {
			this.#value = value === "" ? null : value;
			this.#render();
			this.dispatchEvent(new Event("input", { bubbles: true }));
		});

		if (image !== null) {
			const icon = document.createElement("img");
			icon.src = image;
			icon.alt = "";
			icon.loading = "lazy";
			button.append(icon);
		}
		button.append(document.createTextNode(text));
		return button;
	}

	#render(): void {
		if (!this.#built) return;

		const { shown, total } = this.#matches();

		this.#list.replaceChildren(
			this.#row("", "None", null),
			...shown.map(([value, label, image]) => this.#row(value, label, image)),
		);

		this.#more.textContent =
			total > LIMIT
				? `Showing ${LIMIT} of ${total}. Type to narrow the list.`
				: "";
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-picker": EntryPicker;
	}
}

if (!customElements.get("entry-picker")) {
	customElements.define("entry-picker", EntryPicker);
}
