import { css, html, LitElement, nothing } from "lit";
import { property, state } from "lit/decorators.js";
import { ifDefined } from "lit/directives/if-defined.js";

import { glyphFor, tileStyles } from "./entry-tile";
import { base, controls } from "./theme";

export type Option = readonly [
	value: string,
	label: string,
	image: string | null,
	kind?: string | null,
];

/** The levels a pick accepts, ascending: each +0 to +9, never none. */
export type Levels = readonly number[];

const LEVELS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const UNUPGRADED: Levels = [0];

/**
 * How long a press on a level has to be held, in milliseconds, before it holds
 * that level alone. Long enough that an ordinary tap never trips it.
 */
export const LONG_PRESS = 500;

/** Whether a number is one of the levels a pick can hold, +0 to +9. */
function isLevel(value: number): boolean {
	return Number.isInteger(value) && value >= 0 && value <= 9;
}

/** Every level from one end to the other, whichever end is given first. */
function span(from: number, to: number): number[] {
	const low = Math.min(from, to);
	return Array.from({ length: Math.abs(to - from) + 1 }, (_, at) => low + at);
}

/**
 * A pick's levels as one line — "+9", "+7–9", "+0, +2–4" — so what a strip
 * holds reads without counting lit cells. All ten is "any", since that is what
 * a pick accepting every level means.
 */
function describeLevels(levels: Levels): string {
	if (levels.length === LEVELS.length) return "any";
	const runs: [number, number][] = [];
	for (const level of levels) {
		const last = runs.at(-1);
		if (last !== undefined && level === last[1] + 1) last[1] = level;
		else runs.push([level, level]);
	}
	return runs
		.map(([from, to]) => (from === to ? `+${from}` : `+${from}–${to}`))
		.join(", ");
}

const LIMIT = 50;

const NONE = "None";

/**
 * What a kind is drawn as. An evolved entry and the blessed one beside it wear
 * the same picture and all but a prefix of the same name, so the badge and the
 * colour a slot borrows from it are the only things telling the two cells
 * apart — and the name is what a screen reader gets instead of the colour.
 *
 * An option carrying no kind, or one this table does not know, is drawn the way
 * every option was before kinds existed: no badge and no claim.
 */
const KINDS: Record<string, { badge: string; name: string }> = {
	base: { badge: "N", name: "Base" },
	evolved: { badge: "E", name: "Evolved" },
	blessed: { badge: "B", name: "Blessed" },
};

function kindOf(option: Option): string | undefined {
	const kind = option[3];
	return kind != null && Object.hasOwn(KINDS, kind) ? kind : undefined;
}

/** The filter row's own value for "do not narrow by kind at all". */
const ANY_KIND = "all";

/**
 * One treasure slot: the same filtered grid as `<entry-tile>`, holding any
 * number of picks rather than one. Several picks in a slot are alternatives —
 * the code says "this or that" — so the closed line says it that way too.
 */
export class EntryTiles extends LitElement {
	static override styles = [
		base,
		controls,
		tileStyles,
		css`
			/* Every query below measures the slot, not the window: the same
			   slot is a row of the board on a desktop and a full-width card on a
			   phone, and only its own width says which. */
			:host {
				container-type: inline-size;
			}

			/* A slot is one row of the field: its name on the left and its picks
			   beside it, or its name as a bar above them once the slot is too
			   narrow for both. The name stays a button of its own rather than
			   one button holding the list: a remove button inside the button that
			   opens the picker is not markup. */
			.slot {
				display: grid;
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				background: var(--cr-surface);
			}

			/* An empty slot still has to invite a click, so the frame dashes
			   the way an empty tile does. */
			.slot.empty {
				border-style: dashed;
				border-color: var(--cr-muted);
			}

			.slot > button.tile {
				flex-direction: row;
				gap: var(--cr-space-2);
				align-items: baseline;
				justify-content: space-between;
				border: none;
				border-radius: 0;
				background: var(--cr-surface-2);
				padding: var(--cr-space-2) var(--cr-space-3);
				text-align: left;
			}

			.slot.empty > button.tile {
				background: none;
			}

			/* With nothing to list, the name is the whole slot, so the whole
			   frame is the button rather than its left column. */
			.slot.empty {
				grid-template-columns: minmax(0, 1fr);
			}

			.slot > button.tile .label {
				font-weight: 600;
			}

			@container (min-width: 36rem) {
				.slot {
					grid-template-columns: 9rem minmax(0, 1fr);
				}

				.slot > button.tile {
					flex-direction: column;
					gap: var(--cr-space-1);
					align-items: flex-start;
					justify-content: flex-start;
					padding: var(--cr-space-3);
				}
			}

			.picks {
				display: grid;
				container: picks / inline-size;
				margin: 0;
				padding: 0;
				min-width: 0;
				list-style: none;
			}

			/* The word between two alternatives, quieter than either of them,
			   on the rule that separates them: two picks in one slot mean "this
			   or that", and the list says so. */
			.or {
				display: flex;
				gap: var(--cr-space-2);
				align-items: center;
				padding: 0 var(--cr-space-3);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.65rem;
				line-height: 1;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			.or::before,
			.or::after {
				flex: 1;
				border-top: 1px dashed var(--cr-line);
				content: "";
			}

			.or::before {
				flex: 0 0 var(--cr-space-5);
			}

			/* One pick per line, its name in full: the name is what tells an
			   evolved form from the blessed one beside it. The strip takes a
			   line of its own under the name, and joins it on one line only
			   where the pointer is fine and the row has the room — ten cells at
			   the coarse tap size would squeeze the name to nothing. */
			.chip {
				display: grid;
				grid-template-areas:
					"art who sum remove"
					"levels levels levels any";
				grid-template-columns: auto minmax(0, 1fr) auto auto;
				gap: var(--cr-space-2) var(--cr-space-3);
				align-items: center;
				padding: var(--cr-space-2) var(--cr-space-3);
			}

			@media (pointer: fine) {
				@container picks (min-width: 42rem) {
					.chip {
						grid-template-areas: "art who sum levels any remove";
						grid-template-columns: auto minmax(0, 1fr) auto auto auto auto;
					}

					/* Qualified by .chip so it outranks the bare .levels rule
					   below, which would otherwise win on source order alone. */
					.chip .levels {
						grid-template-columns: repeat(10, 2.25rem);
					}
				}
			}

			.chip .art {
				grid-area: art;
			}

			.chip .art,
			.chip .art img {
				width: 2.25rem;
				height: 2.25rem;
			}

			.who {
				display: grid;
				grid-area: who;
				min-width: 0;
			}

			.chip .name {
				font-size: 0.9rem;
				font-weight: 600;
				line-height: 1.25;
				overflow-wrap: anywhere;
			}

			.chip .kind {
				color: var(--kind);
				font-family: var(--cr-mono);
				font-size: 0.65rem;
				text-transform: uppercase;
				letter-spacing: var(--cr-tracking);
			}

			/* What the strip holds, as words: "+7–9" reads faster than counting
			   three lit cells out of ten. */
			.sum {
				grid-area: sum;
				color: var(--cr-accent);
				font-family: var(--cr-mono);
				font-size: 0.8rem;
				font-weight: 700;
				font-variant-numeric: tabular-nums;
				text-align: right;
				white-space: nowrap;
			}

			/* Ten cells in one strip rather than ten separate buttons: a strip
			   lit from +7 to +9 is a range at a glance, where a grid of ten
			   bordered buttons was ten things to read. pan-y keeps a thumb
			   scrolling the page while a sideways drag stays a drag. */
			.levels {
				display: grid;
				grid-area: levels;
				grid-template-columns: repeat(10, minmax(0, 1fr));
				border: var(--cr-border) solid var(--cr-line);
				border-radius: var(--cr-radius);
				overflow: hidden;
				user-select: none;
				-webkit-user-select: none;
				-webkit-touch-callout: none;
			}

			.levels button {
				border: none;
				border-left: 1px solid var(--cr-line);
				border-radius: 0;
				background: none;
				box-shadow: none;
				padding: 0;
				min-width: 0;
				min-height: 2rem;
				color: var(--cr-muted);
				font-size: 0.8rem;
				letter-spacing: normal;
				touch-action: pan-y;
			}

			.levels button:first-child {
				border-left: none;
			}

			.levels button:active {
				transform: none;
			}

			.levels button[aria-pressed="true"] {
				background: var(--cr-accent);
				color: var(--cr-bg);
				font-weight: 700;
			}

			/* Every level at once, beside the strip rather than in it: "any" is
			   not an eleventh level, and a press on it is not a toggle of one. */
			.any {
				grid-area: any;
				box-shadow: none;
				padding: 0 var(--cr-space-2);
				min-height: 2rem;
				font-size: 0.7rem;
			}

			.any:active {
				transform: none;
			}

			.any[aria-pressed="true"] {
				border-color: var(--cr-accent);
				background: var(--cr-accent);
				color: var(--cr-bg);
			}

			@media (pointer: coarse) {
				.levels button,
				.any {
					min-height: var(--cr-tap);
				}
			}

			/* The slot's name opens the picker too, but once the slot is
			   filled it reads as a label; this says what pressing it does. */
			.picks > li.add {
				padding: var(--cr-space-2) var(--cr-space-3);
				border-top: 1px dashed var(--cr-line);
			}

			button.add {
				border-style: dashed;
				background: none;
				box-shadow: none;
				color: var(--cr-muted);
				font-size: 0.75rem;
			}

			button.add:hover,
			button.add:focus-visible {
				border-color: var(--cr-accent);
				color: var(--cr-text);
			}

			button.add:active {
				transform: none;
			}

			/* What the tile says when it is closed: how much the slot holds, since
			   the names are right beside it. */
			.hint {
				color: var(--cr-muted);
				font-size: 0.8rem;
			}

			/* Which of the three colours this cell or chip borrows. Local
			   plumbing, not a site token: every value it takes is defined in
			   tokens.css and read from there. A base form points at --cr-muted,
			   because tinting the common case tints most of the grid. */
			[data-kind="base"] {
				--kind: var(--cr-muted);
			}

			[data-kind="evolved"] {
				--kind: var(--cr-evolved);
			}

			[data-kind="blessed"] {
				--kind: var(--cr-blessed);
			}

			/* The badge hangs off the corner of the frame it labels. */
			.art {
				position: relative;
			}

			.badge {
				position: absolute;
				top: -0.2rem;
				right: -0.2rem;
				min-width: 1rem;
				border: var(--cr-border) solid var(--cr-surface);
				border-radius: var(--cr-radius);
				background: var(--kind, var(--cr-muted));
				padding: 0 0.1rem;
				color: var(--cr-bg);
				font-family: var(--cr-mono);
				font-size: 0.6rem;
				font-weight: 700;
				line-height: 1.2;
				text-align: center;
			}

			/* A ring on the art rather than on the cell: the cell's own border
			   carries the picked state, and two meanings on one edge is one
			   meaning lost. */
			.entry[data-kind] .art,
			.chip[data-kind] .art {
				border-radius: var(--cr-radius);
				box-shadow: inset 0 0 0 var(--cr-border) var(--kind);
			}

			.remove {
				grid-area: remove;
				border: none;
				border-radius: var(--cr-radius);
				background: none;
				box-shadow: none;
				padding: 0 var(--cr-space-1);
				color: var(--cr-muted);
				font-family: var(--cr-mono);
				font-size: 0.95rem;
				line-height: 1;
				letter-spacing: normal;
			}

			.remove:hover,
			.remove:focus-visible {
				color: var(--cr-danger);
			}

			.remove:active {
				transform: none;
			}

			/* Smaller than the hit area the shared chunk gives every other button:
			   at the full 44px four alternatives stack into a column taller than
			   the group beside them. Square, so it is as easy to hit across as
			   down. */
			@media (pointer: coarse) {
				.remove {
					min-width: 2.25rem;
					min-height: 2.25rem;
				}
			}

			/* Narrowing the grid to one kind, and the colour key for the badges
			   at the same time: each button wears the swatch it filters to. */
			.kinds {
				display: flex;
				flex-wrap: wrap;
				gap: var(--cr-space-1);
				margin-bottom: var(--cr-space-2);
			}

			.kinds button {
				display: inline-flex;
				gap: var(--cr-space-1);
				align-items: center;
				padding: var(--cr-space-1) var(--cr-space-2);
				font-size: 0.65rem;
			}

			.kinds button[data-kind]:not([data-kind="all"])::before {
				display: inline-block;
				border-radius: var(--cr-radius);
				background: var(--kind);
				width: 0.55rem;
				height: 0.55rem;
				content: "";
			}

			.kinds button[aria-pressed="true"] {
				border-color: var(--cr-accent);
				background: color-mix(in srgb, var(--cr-accent) 14%, transparent);
				font-weight: 600;
			}

			footer {
				display: flex;
				align-items: center;
				justify-content: space-between;
				gap: var(--cr-space-2);
			}

			footer .picked {
				color: var(--cr-muted);
				font-size: 0.78rem;
			}

			footer .buttons {
				display: flex;
				gap: var(--cr-space-2);
			}

			footer button.done {
				border-color: var(--cr-accent);
				background: var(--cr-accent);
				color: var(--cr-bg);
			}
		`,
	];

	@property({ type: String })
	legend = "";

	@property({ attribute: false })
	options: readonly Option[] = [];

	@state()
	private chosen: ReadonlySet<string> = new Set();

	/**
	 * What the dialog is showing, which is not yet what the slot holds. A slot is
	 * a set: applying half of one on the way out would leave a code nobody built,
	 * so the draft is committed by Done and thrown away by everything else.
	 */
	@state()
	private draft: ReadonlySet<string> = new Set();

	/**
	 * Each pick's levels, held here rather than on the pick itself; a pick
	 * with no entry reads +0. An entry leaves with its pick: a treasure
	 * dropped and picked again starts over rather than coming back at a
	 * level nobody set this time.
	 */
	@state()
	private leveled: ReadonlyMap<string, Levels> = new Map();

	@state()
	private filter = "";

	/**
	 * Which kind the grid is narrowed to, or `ANY_KIND` for all of them. It
	 * narrows what is shown and nothing else: a pick it hides is still held, and
	 * moving it is no more a change of value than typing in the search box is.
	 */
	@state()
	private kind: string = ANY_KIND;

	/**
	 * Whether the press that is about to produce a click began on the dialog
	 * itself, latched on pointerdown. A click fires on the nearest common
	 * ancestor of the mousedown and mouseup targets, so selecting text in the
	 * search box and releasing past the sheet's edge would otherwise target
	 * the dialog too and discard the whole draft — this is what tells that
	 * drag apart from a real press-and-release on the backdrop.
	 */
	#pressedBackdrop = false;

	/**
	 * Filters the element's own `options`, so the answer comes back in id order.
	 * A slot's alternatives are written in that order, so click order would
	 * produce a different code for the same slot.
	 */
	get selected(): string[] {
		return this.options
			.map(([value]) => value)
			.filter((value) => this.chosen.has(value));
	}

	set selected(values: readonly string[]) {
		this.chosen = new Set(values.filter((value) => this.#has(value)));
	}

	/** One entry per pick, in pick order; a pick never levelled reads +0. */
	get levels(): Readonly<Record<string, Levels>> {
		return Object.fromEntries(
			this.selected.map((value) => [
				value,
				this.leveled.get(value) ?? UNUPGRADED,
			]),
		);
	}

	set levels(levels: Readonly<Record<string, Levels>>) {
		this.leveled = new Map(
			Object.entries(levels)
				.map(([value, set]): [string, Levels] => [
					value,
					[...new Set(set.filter(isLevel))].sort((a, b) => a - b),
				])
				.filter(([value, set]) => this.chosen.has(value) && set.length > 0),
		);
	}

	override connectedCallback(): void {
		super.connectedCallback();
		window.addEventListener("pointerup", this.#endDrag);
		window.addEventListener("pointercancel", this.#endDrag);
	}

	override disconnectedCallback(): void {
		super.disconnectedCallback();
		// A slot removed with its picker open never hears the close.
		if (this.#dialog()?.open) document.documentElement.style.overflow = "";
		window.removeEventListener("pointerup", this.#endDrag);
		window.removeEventListener("pointercancel", this.#endDrag);
	}

	override willUpdate(): void {
		// `options` and the picks are two separate writes, so a list replaced
		// under a slot would otherwise keep a dropped value in the set —
		// invisible while it has no cell, and back the moment a later list
		// contains it again.
		const kept = [...this.chosen].filter((value) => this.#has(value));
		if (kept.length !== this.chosen.size) this.chosen = new Set(kept);
		this.#prune();
	}

	/** Levels travel with their picks, so a pick that leaves takes its level. */
	#prune(): void {
		const kept = [...this.leveled].filter(([value]) => this.chosen.has(value));
		if (kept.length !== this.leveled.size) this.leveled = new Map(kept);
	}

	/**
	 * Where a shift-press or a drag measures its range from, per pick: the last
	 * level pressed without shift. A pick nobody has pressed yet ranges from its
	 * lowest held level, which is +0 for one never levelled.
	 */
	#anchors = new Map<string, number>();

	/** The pick a press on its strip started on, until the press is released. */
	#dragging: string | null = null;

	/** The level that press started on, so a drag knows when it has moved. */
	#pressedLevel: number | null = null;

	/** Holds the pressed level alone once the press has lasted LONG_PRESS. */
	#holdTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Whether the click about to end this press has already been answered — by
	 * a hold or a drag — and must not toggle the level it lands on as well.
	 */
	#answered = false;

	#anchorOf(value: string): number {
		return (
			this.#anchors.get(value) ??
			(this.leveled.get(value) ?? UNUPGRADED)[0] ??
			0
		);
	}

	/**
	 * A press toggles one level, because a touch screen has no modifier key and
	 * +2, +4 and +6 has to be reachable there too — though never the last
	 * level, since a treasure has to accept at least one. Holding a level
	 * holds it alone, dragging holds a range, and shift holds the range from
	 * the last level pressed.
	 */
	#pressLevel(value: string, level: number, event: MouseEvent): void {
		if (this.#answered) {
			this.#answered = false;
			return;
		}
		if (event.shiftKey) {
			this.#setLevels(value, span(this.#anchorOf(value), level));
			return;
		}
		this.#anchors.set(value, level);
		const current = this.leveled.get(value) ?? UNUPGRADED;
		const on = current.includes(level);
		if (on && current.length === 1) return;
		this.#setLevels(
			value,
			on ? current.filter((held) => held !== level) : [...current, level],
		);
	}

	/** Every level, or back to +0 from every level. */
	#pressAny(value: string): void {
		const current = this.leveled.get(value) ?? UNUPGRADED;
		this.#setLevels(
			value,
			current.length === LEVELS.length ? UNUPGRADED : LEVELS,
		);
	}

	/** Writes one pick's levels and says so, unless nothing actually changed. */
	#setLevels(value: string, levels: readonly number[]): void {
		const current = this.leveled.get(value) ?? UNUPGRADED;
		const next = [...levels].sort((a, b) => a - b);
		if (next.join() === current.join()) return;
		this.leveled = new Map(this.leveled).set(value, next);
		this.dispatchEvent(new Event("input", { bubbles: true }));
	}

	/**
	 * A press on a level starts a drag and a hold; passing over another level
	 * while it is still held turns it into a drag, which holds the range
	 * between them, and staying put for LONG_PRESS holds that level alone. The
	 * capture a touch takes on pointerdown is released, or every pointerover
	 * after it would land on the level the finger started on.
	 */
	#startDrag(value: string, level: number, event: PointerEvent): void {
		this.#answered = false;
		if (event.shiftKey) return;
		this.#dragging = value;
		this.#pressedLevel = level;
		this.#anchors.set(value, level);
		clearTimeout(this.#holdTimer);
		this.#holdTimer = setTimeout(() => {
			this.#answered = true;
			this.#setLevels(value, [level]);
		}, LONG_PRESS);
		const target = event.target as Element;
		if (target.hasPointerCapture?.(event.pointerId)) {
			target.releasePointerCapture(event.pointerId);
		}
	}

	#dragOver(value: string, event: PointerEvent): void {
		if (this.#dragging !== value || (event.buttons & 1) === 0) return;
		const cell = (event.target as Element).closest?.("button.level");
		if (cell === null || cell === undefined) return;
		const level = Number(cell.getAttribute("data-level"));
		if (level !== this.#pressedLevel) {
			clearTimeout(this.#holdTimer);
			this.#answered = true;
		}
		if (!this.#answered) return;
		this.#setLevels(value, span(this.#anchorOf(value), level));
	}

	/**
	 * The click that follows a release is dispatched in the same task, so an
	 * answer it should swallow is forgotten one task later — a release off the
	 * strip produces no click, and the next one must not be eaten instead.
	 */
	#endDrag = (): void => {
		clearTimeout(this.#holdTimer);
		this.#dragging = null;
		this.#pressedLevel = null;
		if (this.#answered) {
			setTimeout(() => {
				this.#answered = false;
			}, 0);
		}
	};

	#has(value: string): boolean {
		return this.options.some(([candidate]) => candidate === value);
	}

	#cells(): HTMLButtonElement[] {
		return [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(
				"button.entry",
			) ?? []),
		];
	}

	#search(): HTMLInputElement | null {
		return this.shadowRoot?.querySelector("input") ?? null;
	}

	#dialog(): HTMLDialogElement | null {
		return this.shadowRoot?.querySelector("dialog") ?? null;
	}

	#tile(): HTMLButtonElement | null {
		return this.shadowRoot?.querySelector("button.tile") ?? null;
	}

	async #openPicker(): Promise<void> {
		this.draft = new Set(this.chosen);
		this.filter = "";
		// Forces every pick back into view of the grid, the same reason
		// <entry-tile> inserts a filter-excluded pick rather than losing it: a
		// dialog that reopens still narrowed to last visit's kind leaves the
		// footer's count with no picked cell on screen to match it.
		this.kind = ANY_KIND;
		await this.updateComplete;
		this.#dialog()?.showModal();
		// A modal traps focus but not the page's scroll: a finger on the
		// backdrop would otherwise scroll the board behind it.
		document.documentElement.style.overflow = "hidden";
		this.#search()?.focus();
	}

	#commit(): void {
		this.chosen = new Set(this.draft);
		this.#prune();
		this.dispatchEvent(new Event("input", { bubbles: true }));
		this.#dialog()?.close();
	}

	/** One tab stop for the grid, arrows inside it, clamped at both ends. */
	#walk(event: KeyboardEvent): void {
		const cells = this.#cells();
		const at = cells.indexOf(
			this.shadowRoot?.activeElement as HTMLButtonElement,
		);
		if (at === -1) return;

		const to = {
			ArrowRight: at + 1,
			ArrowDown: at + 1,
			ArrowLeft: at - 1,
			ArrowUp: at - 1,
			Home: 0,
			End: cells.length - 1,
		}[event.key];
		if (to === undefined) return;

		event.preventDefault();
		cells[Math.min(Math.max(to, 0), cells.length - 1)]?.focus();
	}

	/** Focus follows the toggled cell into its replacement; once a filter has
	 * hidden it, the search box takes focus instead. */
	async #toggle(value: string): Promise<void> {
		const next = new Set(this.draft);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		this.draft = next;
		await this.updateComplete;
		(
			this.#cells().find((cell) => cell.value === value) ?? this.#search()
		)?.focus();
	}

	/**
	 * Drops one alternative from the slot's own list, where you can see what you
	 * are removing — the dialog's grid answers "which treasures exist", and this
	 * answers "which of them is this slot holding". It commits straight away
	 * rather than through a draft: there is nothing here to cancel, and a list
	 * you have to confirm a deletion in is a list you cannot tidy at a glance.
	 *
	 * Focus lands on whichever remove button takes the gone one's place, or on
	 * the slot's own button once the list has emptied — the row focus was on has
	 * stopped existing either way.
	 */
	async #drop(value: string): Promise<void> {
		const at = this.selected.indexOf(value);
		const next = new Set(this.chosen);
		next.delete(value);
		this.chosen = next;
		this.#prune();
		this.dispatchEvent(new Event("input", { bubbles: true }));
		await this.updateComplete;

		const buttons = [
			...(this.shadowRoot?.querySelectorAll<HTMLButtonElement>(
				".picks button.remove",
			) ?? []),
		];
		(buttons[Math.min(at, buttons.length - 1)] ?? this.#tile())?.focus();
	}

	#art(label: string, image: string | null, kind?: string) {
		return html`<span class="art"
			>${
				image === null
					? html`<span class="glyph" aria-hidden="true">${glyphFor(label)}</span>`
					: html`<img src=${image} alt="" loading="lazy" />`
			}${
				kind === undefined
					? nothing
					: html`<span class="badge" aria-hidden="true"
							>${KINDS[kind]?.badge}</span
						>`
			}</span
		>`;
	}

	#levelButtons(value: string, name: string, levels: Levels) {
		return html`<div
			class="levels"
			role="group"
			aria-label=${`${name} levels`}
			@pointerover=${(event: PointerEvent) => {
				this.#dragOver(value, event);
			}}
			@contextmenu=${(event: Event) => {
				// A held finger is a hold, not a request for the platform's menu.
				event.preventDefault();
			}}
		>
			${LEVELS.map(
				(level) => html`<button
					type="button"
					class="level"
					data-level=${level}
					aria-pressed=${String(levels.includes(level))}
					@pointerdown=${(event: PointerEvent) => {
						this.#startDrag(value, level, event);
					}}
					@click=${(event: MouseEvent) => {
						this.#pressLevel(value, level, event);
					}}
				>
					+${level}
				</button>`,
			)}
		</div>`;
	}

	override render() {
		const labels = new Map(
			this.options.map(([value, label]) => [value, label]),
		);
		const images = new Map(
			this.options.map(([value, , image]) => [value, image]),
		);
		const kinds = new Map(
			this.options.map((option) => [option[0], kindOf(option)]),
		);
		const chosen = this.selected;

		// In the table's own order rather than the list's, so the row reads the
		// same whichever slot it sits in.
		const offered = Object.keys(KINDS).filter((kind) =>
			this.options.some((option) => kindOf(option) === kind),
		);
		const narrowing = offered.includes(this.kind) ? this.kind : ANY_KIND;

		const needle = this.filter.trim().toLowerCase();
		const matching = this.options.filter(
			(option) =>
				(narrowing === ANY_KIND || kindOf(option) === narrowing) &&
				(needle === "" || option[1].toLowerCase().includes(needle)),
		);

		const shown = matching.slice(0, LIMIT);
		// The tab stop is whatever the draft already holds, so tabbing in lands on
		// what the dialog is showing; with nothing drafted that is the first cell.
		const tabbableValue =
			shown.find(([value]) => this.draft.has(value))?.[0] ?? shown[0]?.[0];

		return html`<div class=${chosen.length === 0 ? "slot empty" : "slot"}>
				<button
					type="button"
					class=${chosen.length === 0 ? "tile empty" : "tile"}
					@click=${() => {
						void this.#openPicker();
					}}
				>
					<span class="label">${this.legend}</span>
					<span class="hint"
						>${
							chosen.length === 0
								? NONE
								: `${chosen.length} ${chosen.length === 1 ? "treasure" : "alternatives"}`
						}</span
					>
				</button>
				${
					chosen.length === 0
						? nothing
						: html`<ul class="picks">
							${chosen.map((value, at) => {
								const name = labels.get(value) ?? value;
								const kind = kinds.get(value);
								const levels = this.leveled.get(value) ?? UNUPGRADED;
								return html`${
									at === 0
										? nothing
										: html`<li class="or" aria-hidden="true">or</li>`
								}<li
									class="chip"
									data-value=${value}
									data-kind=${ifDefined(kind)}
									>${this.#art(name, images.get(value) ?? null, kind)}<span
										class="who"
										><span class="name">${name}</span>${
											kind === undefined
												? nothing
												: html`<span class="kind">${KINDS[kind]?.name}</span>`
										}</span
									><span class="sum" aria-hidden="true"
										>${describeLevels(levels)}</span
									>${this.#levelButtons(value, name, levels)}<button
										type="button"
										class="any"
										aria-label=${`${name} at any level`}
										aria-pressed=${String(levels.length === LEVELS.length)}
										@click=${() => {
											this.#pressAny(value);
										}}
										>any</button
									><button
										type="button"
										class="remove"
										aria-label=${`Remove ${name}`}
										@click=${() => {
											void this.#drop(value);
										}}
										>×</button
									></li
								>`;
							})}
							<li class="add">
								<button
									type="button"
									class="add"
									@click=${() => {
										void this.#openPicker();
									}}
								>
									+ Add alternative
								</button>
							</li>
						</ul>`
				}
			</div>
			<dialog
				@pointerdown=${(event: Event) => {
					this.#pressedBackdrop = event.target === this.#dialog();
				}}
				@close=${() => {
					document.documentElement.style.overflow = "";
					this.#tile()?.focus();
				}}
				@click=${(event: Event) => {
					// A native dialog does not light-dismiss: nothing closes it on a
					// backdrop click unless this does. The target is the dialog itself
					// only when the click lands outside .sheet, so a click inside the
					// sheet passes through untouched — but a click also fires on the
					// nearest common ancestor of the press and release targets, so a
					// drag that starts inside .sheet and releases past its edge would
					// target the dialog too and discard the whole draft. Requiring the
					// press to have started there as well is what tells the two apart.
					if (this.#pressedBackdrop && event.target === this.#dialog()) {
						this.#dialog()?.close();
					}
				}}
			>
				<div class="sheet">
					<header>
						<h2>${this.legend}</h2>
						<button
							type="button"
							class="close"
							@click=${() => {
								this.#dialog()?.close();
							}}
						>
							Close
						</button>
					</header>
					${
						offered.length === 0
							? nothing
							: html`<div
									class="kinds"
									role="group"
									aria-label=${`Filter ${this.legend} by kind`}
								>
									${[ANY_KIND, ...offered].map(
										(kind) => html`<button
											type="button"
											data-kind=${kind}
											aria-pressed=${String(kind === narrowing)}
											@click=${() => {
												this.kind = kind;
											}}
										>
											${kind === ANY_KIND ? "All" : KINDS[kind]?.name}
										</button>`,
									)}
								</div>`
					}
					<input
						type="search"
						autocomplete="off"
						placeholder="Type to filter"
						aria-label=${`Filter ${this.legend}`}
						.value=${this.filter}
						@input=${(event: Event) => {
							event.stopPropagation();
							this.filter = (event.target as HTMLInputElement).value;
						}}
					/>
					<div
						class="entries"
						role="listbox"
						aria-multiselectable="true"
						aria-label=${this.legend}
						@keydown=${(event: KeyboardEvent) => {
							this.#walk(event);
						}}
					>
						${shown.map((option) => {
							const [value, label, image] = option;
							const kind = kindOf(option);
							return html`<button
								type="button"
								class="entry"
								.value=${value}
								role="option"
								data-kind=${ifDefined(kind)}
								tabindex=${value === tabbableValue ? 0 : -1}
								aria-checked=${String(this.draft.has(value))}
								aria-selected=${String(this.draft.has(value))}
								aria-label=${kind === undefined ? label : `${label}, ${KINDS[kind]?.name}`}
								@click=${() => {
									void this.#toggle(value);
								}}
							>
								${this.#art(label, image, kind)}<span class="name">${label}</span>
							</button>`;
						})}
					</div>
					<footer>
						<span class="picked"
							>${this.draft.size} picked — alternatives for one slot</span
						>
						<span class="buttons">
							<button
								type="button"
								class="clear"
								@click=${() => {
									this.draft = new Set();
								}}
							>
								Clear
							</button>
							<button
								type="button"
								class="done"
								@click=${() => {
									this.#commit();
								}}
							>
								Done
							</button>
						</span>
					</footer>
					<small class="more"
						>${
							matching.length > LIMIT
								? `Showing ${LIMIT} of ${matching.length}. Type to narrow the list.`
								: ""
						}</small
					>
				</div>
			</dialog>`;
	}
}

declare global {
	interface HTMLElementTagNameMap {
		"entry-tiles": EntryTiles;
	}
}

if (!customElements.get("entry-tiles")) {
	customElements.define("entry-tiles", EntryTiles);
}
