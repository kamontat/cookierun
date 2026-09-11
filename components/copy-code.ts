/**
 * The code the page exists to produce, plus a button that copies it and a
 * status line for the copy. Setting `value` clears the status, because a stale
 * "Copied." beside a code that has since changed is a lie.
 */
export class CopyCode extends HTMLElement {
  static readonly observedAttributes = ["value"];

  readonly #code = document.createElement("code");
  readonly #status = document.createElement("p");
  readonly #button = document.createElement("button");
  #built = false;

  connectedCallback(): void {
    if (this.#built) return;
    this.#built = true;

    this.#code.textContent = this.getAttribute("value") ?? "";

    this.#button.type = "button";
    this.#button.className = "outline secondary";
    this.#button.textContent = "Copy";
    this.#button.addEventListener("click", () => void this.#copy());

    this.#status.className = "status";
    this.#status.setAttribute("role", "status");

    const output = document.createElement("output");
    output.setAttribute("aria-live", "polite");
    output.append(this.#code, this.#button);

    this.replaceChildren(output, this.#status);
  }

  attributeChangedCallback(
    name: string,
    _previous: string | null,
    next: string | null,
  ): void {
    if (name === "value") this.#code.textContent = next ?? "";
  }

  get value(): string {
    return this.#code.textContent ?? "";
  }

  set value(value: string) {
    this.setAttribute("value", value);
    this.#setStatus("", false);
  }

  async #copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value);
      this.#setStatus("Copied.", false);
    } catch {
      this.#setStatus(
        "The browser blocked the clipboard. Select the code and copy it by hand.",
        true,
      );
    }
  }

  #setStatus(text: string, isError: boolean): void {
    this.#status.textContent = text;
    this.#status.classList.toggle("error", isError);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "copy-code": CopyCode;
  }
}

if (!customElements.get("copy-code")) {
  customElements.define("copy-code", CopyCode);
}
