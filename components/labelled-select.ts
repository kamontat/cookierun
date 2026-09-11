export type Option = readonly [value: string, label: string];

let sequence = 0;

/**
 * A label and a select, built from `[value, label]` pairs handed in as a
 * property. The pairs come from the caller's canonical list, so the option
 * order is the caller's order.
 */
export class LabelledSelect extends HTMLElement {
  readonly #select = document.createElement("select");
  #options: readonly Option[] = [];
  #built = false;

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    // Derived from the host id where there is one, so the generated id reads
    // as belonging to this control rather than to a counter.
    this.#select.id = this.id === "" ? `select-${++sequence}` : `${this.id}-select`;

    const label = document.createElement("label");
    label.htmlFor = this.#select.id;
    label.textContent = this.getAttribute("label") ?? "";

    this.replaceChildren(label, this.#select);
  }

  get options(): readonly Option[] {
    return this.#options;
  }

  set options(options: readonly Option[]) {
    this.#options = options;
    this.#select.replaceChildren(
      ...options.map(([value, label]) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        return option;
      }),
    );
  }

  get value(): string {
    return this.#select.value;
  }

  set value(value: string) {
    this.#select.value = value;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "labelled-select": LabelledSelect;
  }
}

if (!customElements.get("labelled-select")) {
  customElements.define("labelled-select", LabelledSelect);
}
