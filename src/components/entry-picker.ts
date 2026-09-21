export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

/**
 * A type-to-filter list that resolves to one pick, for catalogs too long for a
 * `<select>` — the treasure list alone is over a thousand entries.
 *
 * It lives inside a closed `<details>`: a page with six of these open at once is
 * a wall of scrolling lists, and the summary already says what is picked, which
 * is what a closed control has to answer.
 *
 * Only the first `LIMIT` matches are rendered, because three of these plus
 * three `<entry-set>`s over the same catalog would otherwise put tens of
 * thousands of rows in one page. The selected row is always rendered, even when
 * the filter excludes it, so the control never appears to have lost the pick.
 */
export class EntryPicker extends HTMLElement {
	readonly #summary = document.createElement("summary");
	readonly #pick = document.createElement("span");
	readonly #search = document.createElement("input");
	readonly #list = document.createElement("div");
	readonly #more = document.createElement("small");
	#options: readonly Option[] = [];
	#value: string | null = null;
	#built = false;

	connectedCallback(): void {
		if (this.#built) return;
		this.#built = true;

		const label = this.getAttribute("label") ?? "";

		const name = document.createElement("span");
		name.className = "name";
		name.textContent = label;
		this.#pick.className = "pick";
		this.#summary.replaceChildren(name, this.#pick);

		this.#search.type = "search";
		this.#search.autocomplete = "off";
		this.#search.placeholder = "Type to filter";
		this.#search.setAttribute("aria-label", `Filter ${label}`);
		this.#search.addEventListener("input", (event) => {
			// Filtering is not a change of value, so it must not read as one.
			event.stopPropagation();
			this.#render();
		});

		this.#list.className = "entries";
		this.#list.setAttribute("role", "listbox");
		this.#list.setAttribute("aria-label", label);
		this.#list.addEventListener("keydown", (event) => {
			this.#walk(event);
		});
		this.#more.className = "more";

		const details = document.createElement("details");
		details.replaceChildren(
			this.#summary,
			this.#search,
			this.#list,
			this.#more,
		);
		this.replaceChildren(details);
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

	#picked(): Option | undefined {
		return this.#options.find(([value]) => value === this.#value);
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

		const picked = this.#picked();
		return {
			shown: picked === undefined ? capped : [picked, ...capped],
			total,
		};
	}

	#rows(): HTMLButtonElement[] {
		return [...this.#list.querySelectorAll<HTMLButtonElement>("button")];
	}

	/**
	 * One tab stop for the whole list, arrows inside it: 50 rows in each of six
	 * controls would otherwise be 300 stops between the loadout and the rest of
	 * the page. Enter and Space need no handling — these rows are buttons.
	 */
	#walk(event: KeyboardEvent): void {
		const rows = this.#rows();
		const at = rows.indexOf(document.activeElement as HTMLButtonElement);
		if (at === -1) return;

		const to = {
			ArrowDown: at + 1,
			ArrowUp: at - 1,
			Home: 0,
			End: rows.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		// Clamped rather than wrapped: an arrow that jumps from the last row to
		// the first reads as a lost keypress.
		rows[Math.min(Math.max(to, 0), rows.length - 1)]?.focus();
	}

	#row(
		value: string,
		text: string,
		image: string | null,
		tabbable: boolean,
	): HTMLElement {
		const button = document.createElement("button");
		button.type = "button";
		button.value = value;
		button.className = "entry";
		button.tabIndex = tabbable ? 0 : -1;
		button.setAttribute("role", "option");
		button.setAttribute("aria-selected", String((this.#value ?? "") === value));
		button.addEventListener("click", () => {
			this.#value = value === "" ? null : value;
			this.#render();
			// `#render()` just replaced the button the click landed on, which would
			// otherwise drop focus to <body>. Focus follows the same row into its
			// replacement — where a keyboard is, and where a mouse just was. A
			// filter that hides the row leaves nothing to return to, so the search
			// input, the one element that survives every render, takes it.
			(this.#rows().find((row) => row.value === value) ?? this.#search).focus();
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

	#renderSummary(): void {
		const picked = this.#picked();
		this.#pick.replaceChildren();

		if (picked === undefined) {
			this.#pick.textContent = NONE;
			return;
		}

		const [, label, image] = picked;
		if (image !== null) {
			const icon = document.createElement("img");
			icon.src = image;
			icon.alt = "";
			icon.loading = "lazy";
			this.#pick.append(icon);
		}
		this.#pick.append(document.createTextNode(label));
	}

	#render(): void {
		if (!this.#built) return;

		const { shown, total } = this.#matches();
		// The tab stop is the pick, so tabbing in lands on what the control
		// currently says; with nothing picked that is the None row at the top.
		const tabbableValue = this.#value ?? "";

		this.#list.replaceChildren(
			this.#row("", NONE, null, tabbableValue === ""),
			...shown.map(([value, label, image]) =>
				this.#row(value, label, image, value === tabbableValue),
			),
		);

		this.#renderSummary();

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
