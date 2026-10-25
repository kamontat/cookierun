/**
 * The Saved and Help drawers open from the right edge at a fixed width, which
 * on a wide screen leaves a long saved list wrapping in a narrow column. On
 * desktop their left edge is a handle: drag it, or focus it and press the
 * arrow keys, and the drawer takes that width; double-click it to go back to
 * the default. Each drawer remembers its own width in `localStorage`, wrapped
 * the same way `state.ts` is, so a browser that refuses storage still resizes
 * and only forgets.
 *
 * The width is a custom property on the dialog, not its `width`: the
 * stylesheet decides when it applies (a fine pointer on a wide screen) and
 * places the handle from the same value.
 */

/** Below this the saved rows stop reading as rows. */
export const MIN_WIDTH = 288;

/** The stylesheet's default, `22rem`, for the keyboard's first step. */
const DEFAULT_WIDTH = 352;

/** How far one arrow key press moves the edge; Shift moves it four times as far. */
const STEP = 16;

const PROPERTY = "--drawer-width";

type WidthStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const keyFor = (id: string) => `combi-name:drawer-width:${id}`;

/** A whole pixel width no narrower than the floor and no wider than 90% of the window. */
export function clampWidth(width: number, viewport: number): number {
	return Math.round(Math.max(MIN_WIDTH, Math.min(width, viewport * 0.9)));
}

export function readWidth(storage: WidthStorage, id: string): number | null {
	try {
		const stored = Number(storage.getItem(keyFor(id)) ?? Number.NaN);
		return Number.isFinite(stored) && stored > 0 ? stored : null;
	} catch {
		return null;
	}
}

/** `null` forgets the width, handing the drawer back to the default. */
export function writeWidth(
	storage: WidthStorage,
	id: string,
	width: number | null,
): void {
	try {
		if (width === null) storage.removeItem(keyFor(id));
		else storage.setItem(keyFor(id), String(width));
	} catch {
		// A browser that refuses storage keeps the width for this visit.
	}
}

/** Makes `handle` resize `dialog`, restoring the width it last had. */
export function attachResize(
	dialog: HTMLElement,
	handle: HTMLElement,
	storage: WidthStorage,
): void {
	handle.setAttribute("role", "separator");
	handle.setAttribute("aria-orientation", "vertical");
	handle.setAttribute("aria-label", "Resize panel");
	handle.setAttribute("aria-valuemin", String(MIN_WIDTH));
	handle.tabIndex = 0;

	let current: number | null = null;

	const show = (width: number | null) => {
		current = width;
		if (width === null) {
			dialog.style.removeProperty(PROPERTY);
			handle.removeAttribute("aria-valuenow");
		} else {
			dialog.style.setProperty(PROPERTY, `${width}px`);
			handle.setAttribute("aria-valuenow", String(width));
		}
	};

	const fromEdge = (clientX: number) =>
		clampWidth(window.innerWidth - clientX, window.innerWidth);

	show(readWidth(storage, dialog.id));

	let dragging = false;
	handle.addEventListener("pointerdown", (event) => {
		if (event.button !== 0) return;
		dragging = true;
		// Keeps the moves coming once the pointer is past the handle, and keeps
		// the press from reading as a backdrop click on the dialog.
		handle.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	});
	handle.addEventListener("pointermove", (event) => {
		if (dragging) show(fromEdge(event.clientX));
	});
	const release = () => {
		if (!dragging) return;
		dragging = false;
		writeWidth(storage, dialog.id, current);
	};
	handle.addEventListener("pointerup", release);
	handle.addEventListener("pointercancel", release);

	handle.addEventListener("keydown", (event) => {
		const step = event.shiftKey ? STEP * 4 : STEP;
		// The handle is the drawer's left edge: left widens, right narrows.
		const delta =
			event.key === "ArrowLeft" ? step : event.key === "ArrowRight" ? -step : 0;
		if (delta === 0) return;
		event.preventDefault();
		const from =
			current ?? (dialog.getBoundingClientRect().width || DEFAULT_WIDTH);
		show(clampWidth(from + delta, window.innerWidth));
		writeWidth(storage, dialog.id, current);
	});

	handle.addEventListener("dblclick", () => {
		show(null);
		writeWidth(storage, dialog.id, null);
	});
}
