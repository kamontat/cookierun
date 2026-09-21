/**
 * Declared here rather than imported from the combi route: components never
 * import from routes. `AutoVerdict` in the route's describe.ts is structurally
 * assignable to this, so the route passes its value straight in.
 */
export type Verdict = {
	readonly semi: boolean;
	/** What forces manual work each run. Empty when the combi is full auto. */
	readonly reasons: readonly string[];
};

export class AutoVerdictElement extends HTMLElement {
	#verdict: Verdict | null = null;

	connectedCallback(): void {
		this.setAttribute("aria-live", "polite");
		this.#render();
	}

	get verdict(): Verdict | null {
		return this.#verdict;
	}

	set verdict(verdict: Verdict | null) {
		this.#verdict = verdict;
		this.#render();
	}

	#render(): void {
		if (this.#verdict === null) {
			this.replaceChildren();
			return;
		}

		const { semi, reasons } = this.#verdict;

		const name = document.createElement("strong");
		name.textContent = semi ? "Semi-auto" : "Full auto";

		const tail = semi
			? ` - ${reasons.join(", ")} ${
					reasons.length === 1 ? "needs" : "need"
				} manual work each run.`
			: " - nothing needs manual work each run.";

		// The separating space belongs to the prefix, not to the verdict, or an
		// element without one opens with a stray space before "Full auto".
		const prefix = this.getAttribute("prefix") ?? "";

		this.replaceChildren(
			...(prefix === "" ? [] : [document.createTextNode(`${prefix} `)]),
			name,
			document.createTextNode(tail),
		);
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"auto-verdict": AutoVerdictElement;
	}
}

if (!customElements.get("auto-verdict")) {
	customElements.define("auto-verdict", AutoVerdictElement);
}
