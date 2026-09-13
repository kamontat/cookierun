export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

/**
 * One treasure slot, holding the entries that slot will accept — a build that
 * says "this, or that" writes both here.
 *
 * `selected` filters this element's own `options` rather than reading the order
 * chips were added in, the same rule `<check-group>` follows and for the same
 * reason: a slot's alternatives are written in id order, so click order would
 * produce a different code for the same slot.
 *
 * It declares its own `Option` type rather than sharing `<entry-picker>`'s. A
 * shared type between two components is the first step towards a component that
 * cannot be read on its own.
 */
export class EntrySet extends HTMLElement {
	readonly #picked = document.createElement("div");
	readonly #search = document.createElement("input");
	readonly #list = document.createElement("div");
	readonly #more = document.createElement("small");
	#options: readonly Option[] = [];
	#chosen = new Set<string>();
	#built = false;

	connectedCallback(): void {
		if (this.#built) return;
		this.#built = true;

		const legend = document.createElement("legend");
		legend.textContent = this.getAttribute("legend") ?? "";

		this.#picked.className = "picked";
		this.#list.className = "entries";
		this.#more.className = "more";

		this.#search.type = "search";
		this.#search.autocomplete = "off";
		this.#search.placeholder = "Type to filter";
		this.#search.setAttribute(
			"aria-label",
			`Filter ${this.getAttribute("legend") ?? "entries"}`,
		);
		this.#search.addEventListener("input", (event) => {
			event.stopPropagation();
			this.#render();
		});

		const fieldset = document.createElement("fieldset");
		fieldset.replaceChildren(
			legend,
			this.#picked,
			this.#search,
			this.#list,
			this.#more,
		);
		this.replaceChildren(fieldset);
		this.#render();
	}

	get options(): readonly Option[] {
		return this.#options;
	}

	set options(options: readonly Option[]) {
		this.#options = options;
		this.selected = [...this.#chosen];
	}

	get selected(): string[] {
		return this.#options
			.map(([value]) => value)
			.filter((value) => this.#chosen.has(value));
	}

	set selected(values: readonly string[]) {
		const known = new Set(this.#options.map(([value]) => value));
		this.#chosen = new Set(values.filter((value) => known.has(value)));
		this.#render();
	}

	#changed(): void {
		this.#render();
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	#chip(value: string, label: string): HTMLElement {
		const chip = document.createElement("button");
		chip.type = "button";
		chip.value = value;
		chip.className = "chip";
		chip.title = `Remove ${label}`;
		chip.append(document.createTextNode(`${label} ×`));
		chip.addEventListener("click", () => {
			this.#chosen.delete(value);
			this.#changed();
		});
		return chip;
	}

	#row(option: Option): HTMLElement {
		const [value, label, image] = option;
		const button = document.createElement("button");
		button.type = "button";
		button.value = value;
		button.className = "entry";
		button.setAttribute("aria-selected", String(this.#chosen.has(value)));
		button.addEventListener("click", () => {
			this.#chosen.add(value);
			this.#changed();
		});

		if (image !== null) {
			const icon = document.createElement("img");
			icon.src = image;
			icon.alt = "";
			icon.loading = "lazy";
			button.append(icon);
		}
		button.append(document.createTextNode(label));
		return button;
	}

	#render(): void {
		if (!this.#built) return;

		const labels = new Map(
			this.#options.map(([value, label]) => [value, label]),
		);
		this.#picked.replaceChildren(
			...this.selected.map((value) =>
				this.#chip(value, labels.get(value) ?? value),
			),
		);

		const needle = this.#search.value.trim().toLowerCase();
		const matching =
			needle === ""
				? this.#options
				: this.#options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		this.#list.replaceChildren(
			...matching.slice(0, LIMIT).map((option) => this.#row(option)),
		);
		this.#more.textContent =
			matching.length > LIMIT
				? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
				: "";
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-set": EntrySet;
	}
}

if (!customElements.get("entry-set")) {
	customElements.define("entry-set", EntrySet);
}
