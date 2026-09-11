export type Option = readonly [value: string, label: string];

/**
 * A fieldset of checkboxes built from `[value, label]` pairs.
 *
 * `selected` filters this element's own `options` rather than reading DOM
 * order, which is what keeps boosts in slot order and cookie powers in bit
 * order. That ordering is part of the combi wire format, not a preference.
 */
export class CheckGroup extends HTMLElement {
  readonly #checks = document.createElement("div");
  #options: readonly Option[] = [];
  #built = false;

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    const legend = document.createElement("legend");
    legend.textContent = this.getAttribute("legend") ?? "";

    this.#checks.className = "checks";

    const fieldset = document.createElement("fieldset");
    fieldset.replaceChildren(legend, this.#checks);

    this.replaceChildren(fieldset);
  }

  get options(): readonly Option[] {
    return this.#options;
  }

  set options(options: readonly Option[]) {
    this.#options = options;
    this.#checks.replaceChildren(
      ...options.map(([value, text]) => {
        const input = document.createElement("input");
        input.type = "checkbox";
        input.value = value;

        const label = document.createElement("label");
        label.append(input, document.createTextNode(text));
        return label;
      }),
    );
  }

  get selected(): string[] {
    const checked = new Set(
      Array.from(
        this.#checks.querySelectorAll<HTMLInputElement>("input:checked"),
        (input) => input.value,
      ),
    );
    return this.#options
      .map(([value]) => value)
      .filter((value) => checked.has(value));
  }

  set selected(values: readonly string[]) {
    const wanted = new Set(values);
    for (const input of this.#checks.querySelectorAll<HTMLInputElement>(
      "input",
    )) {
      input.checked = wanted.has(input.value);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "check-group": CheckGroup;
  }
}

if (!customElements.get("check-group")) {
  customElements.define("check-group", CheckGroup);
}
