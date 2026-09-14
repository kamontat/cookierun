/**
 * What one character of the code means. The element only groups and displays
 * these; what a character means is the page's business, not the element's.
 */
export type CharHint = {
	char: string;
	hint: string;
	/** Characters sharing a group are drawn, and labelled, as one run. */
	group: string;
};

/**
 * The code the page exists to produce, plus a button that copies it and a
 * status line for the copy. Setting `value` clears the status, because a stale
 * "Copied." beside a code that has since changed is a lie — and drops the hints
 * for the same reason, since against a newer code they would label the wrong
 * characters.
 */
export class CopyCode extends HTMLElement {
	static readonly observedAttributes = ["value"];

	readonly #code = document.createElement("code");
	readonly #status = document.createElement("p");
	readonly #button = document.createElement("button");
	#hints: readonly CharHint[] = [];
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
		if (name !== "value") return;
		this.#hints = [];
		this.#code.textContent = next ?? "";
	}

	get value(): string {
		return this.#code.textContent ?? "";
	}

	set value(value: string) {
		this.setAttribute("value", value);
		this.#setStatus("", false);
	}

	get hints(): readonly CharHint[] {
		return this.#hints;
	}

	/**
	 * One hint per character. Anything else is dropped whole: a hint list that
	 * does not line up with the code labels the wrong characters, which is worse
	 * than labelling none of them.
	 */
	set hints(hints: readonly CharHint[]) {
		const value = this.value;
		this.#hints = hints.length === value.length ? hints : [];
		this.#renderCode(value);
	}

	#renderCode(value: string): void {
		if (this.#hints.length === 0) {
			this.#code.textContent = value;
			return;
		}

		const runs: CharHint[][] = [];
		for (const hint of this.#hints) {
			const last = runs[runs.length - 1];
			if (last !== undefined && last[0]?.group === hint.group) last.push(hint);
			else runs.push([hint]);
		}

		this.#code.replaceChildren(
			...runs.map((run) => {
				const span = document.createElement("span");
				span.dataset.tooltip = run[0]?.hint ?? "";
				// Below: the code sits at the top of a sticky panel, so Pico's
				// default bubble above it would open off the top of the window.
				span.dataset.placement = "bottom";
				span.dataset.group = run[0]?.group ?? "";
				span.textContent = run.map(({ char }) => char).join("");
				return span;
			}),
		);
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
