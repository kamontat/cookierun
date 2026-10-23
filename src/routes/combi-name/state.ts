/**
 * Where the page keeps the code between visits: in the address bar, so a code
 * is a link someone can send, and in `localStorage`, so closing the tab does
 * not throw the last build away.
 *
 * The link wins over the remembered code. Someone who followed a link asked for
 * that code; their own last build is still one Reset away.
 *
 * Every storage call is wrapped, the same rule `theme-toggle` follows: a browser
 * that refuses `localStorage` still has a working page for that visit.
 */

export const STORAGE_KEY = "combi-name:code";

/**
 * A shared link may carry a note after the code, as `#CODE?note=...`. The page's
 * own hash never does — it is the build on screen and nothing else — so only a
 * link someone sent on purpose has one.
 */
const NOTE_MARK = "?";

function splitHash(hash: string): { code: string; query: string } {
	const body = hash.replace(/^#/, "");
	const at = body.indexOf(NOTE_MARK);
	return at === -1
		? { code: body, query: "" }
		: { code: body.slice(0, at), query: body.slice(at + 1) };
}

/** The code a `location.hash` carries, canonicalised the way the reader does. */
export function codeInHash(hash: string): string | null {
	const code = splitHash(hash).code.trim().toUpperCase();
	return code === "" ? null : code;
}

/** The note a shared link carries beside its code, as it was written. */
export function noteInHash(hash: string): string | null {
	const note = new URLSearchParams(splitHash(hash).query).get("note");
	return note === null || note.trim() === "" ? null : note;
}

export function hashFor(code: string): string {
	return `#${code}`;
}

/** The hash of a link that hands someone a code and the note that goes with it. */
export function shareHashFor(code: string, note: string): string {
	const canonical = code.trim().toUpperCase();
	if (note.trim() === "") return hashFor(canonical);
	return `${hashFor(canonical)}${NOTE_MARK}${new URLSearchParams({ note })}`;
}

export function storedCode(storage: Storage): string | null {
	try {
		return storage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

export function rememberCode(storage: Storage, code: string): void {
	try {
		storage.setItem(STORAGE_KEY, code);
	} catch {}
}

/**
 * Whether the board was left folded. A view preference rather than part of the
 * build, so it is kept apart from the code and never travels in a link.
 */
export const BOARD_KEY = "combi-name:board-collapsed";

export function boardCollapsed(storage: Storage): boolean {
	try {
		return storage.getItem(BOARD_KEY) === "true";
	} catch {
		return false;
	}
}

export function rememberBoardCollapsed(
	storage: Storage,
	collapsed: boolean,
): void {
	try {
		storage.setItem(BOARD_KEY, String(collapsed));
	} catch {}
}

export function startingCode(hash: string, storage: Storage): string | null {
	return codeInHash(hash) ?? storedCode(storage);
}
