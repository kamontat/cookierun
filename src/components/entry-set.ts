export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
];

const LIMIT = 50;

const NONE = "None";

/**
 * One treasure slot, holding the entries that slot will accept — a build that
 * says "this, or that" writes both here.
 *
 * Like `<entry-picker>` it lives inside a closed `<details>`, and for the same
 * reason: three open lists over the same thousand-entry catalog is a wall, and
 * the summary already says what the slot holds.
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
	readonly #summary = document.createElement("summary");
	readonly #chosenText = document.createElement("span");
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

		const legend = this.getAttribute("legend") ?? "";

		const name = document.createElement("span");
		name.className = "name";
		name.textContent = legend;
		this.#chosenText.className = "pick";
		this.#summary.replaceChildren(name, this.#chosenText);

		this.#picked.className = "picked";
		this.#list.className = "entries";
		this.#list.setAttribute("role", "listbox");
		this.#list.setAttribute("aria-multiselectable", "true");
		this.#list.setAttribute("aria-label", legend);
		this.#list.addEventListener("keydown", (event) => {
			this.#walk(event);
		});
		this.#more.className = "more";

		this.#search.type = "search";
		this.#search.autocomplete = "off";
		this.#search.placeholder = "Type to filter";
		this.#search.setAttribute("aria-label", `Filter ${legend}`);
		this.#search.addEventListener("input", (event) => {
			event.stopPropagation();
			this.#render();
		});

		const details = document.createElement("details");
		details.replaceChildren(
			this.#summary,
			this.#picked,
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

	/**
	 * Focus follows the row or chip that was clicked into its replacement; when
	 * the click removed the thing it landed on, the search input — the one
	 * element that survives every render — takes it instead.
	 */
	#changed(focusValue: string | null): void {
		this.#render();
		const row =
			focusValue === null
				? undefined
				: this.#rows().find((candidate) => candidate.value === focusValue);
		(row ?? this.#search).focus();
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	#rows(): HTMLButtonElement[] {
		return [...this.#list.querySelectorAll<HTMLButtonElement>("button")];
	}

	/**
	 * One tab stop for the whole list, arrows inside it: 50 rows in each of three
	 * slots would otherwise be 150 stops in the loadout alone. Enter and Space
	 * need no handling — these rows are buttons.
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

	#chip(value: string, label: string): HTMLElement {
		const chip = document.createElement("button");
		chip.type = "button";
		chip.value = value;
		chip.className = "chip";
		chip.title = `Remove ${label}`;
		chip.append(document.createTextNode(`${label} ×`));
		chip.addEventListener("click", () => {
			this.#chosen.delete(value);
			this.#changed(null);
		});
		return chip;
	}

	#row(option: Option, tabbable: boolean): HTMLElement {
		const [value, label, image] = option;
		const button = document.createElement("button");
		button.type = "button";
		button.value = value;
		button.className = "entry";
		button.tabIndex = tabbable ? 0 : -1;
		button.setAttribute("role", "option");
		button.setAttribute("aria-selected", String(this.#chosen.has(value)));
		button.addEventListener("click", () => {
			this.#chosen.add(value);
			this.#changed(value);
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
		const chosen = this.selected;
		this.#picked.replaceChildren(
			...chosen.map((value) => this.#chip(value, labels.get(value) ?? value)),
		);
		// The same "this or that" the code reads as, so a closed slot says exactly
		// what the reader panel would say about it.
		this.#chosenText.textContent =
			chosen.length === 0
				? NONE
				: chosen.map((value) => labels.get(value) ?? value).join(" or ");

		const needle = this.#search.value.trim().toLowerCase();
		const matching =
			needle === ""
				? this.#options
				: this.#options.filter(([, label]) =>
						label.toLowerCase().includes(needle),
					);

		// The tab stop is the first pick, so tabbing in lands on what the slot
		// already holds; with nothing picked that is the first row.
		const shown = matching.slice(0, LIMIT);
		const tabbableValue =
			shown.find(([value]) => this.#chosen.has(value))?.[0] ?? shown[0]?.[0];

		this.#list.replaceChildren(
			...shown.map((option) => this.#row(option, option[0] === tabbableValue)),
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
