/**
 * Codes someone kept on purpose, each with a few words of their own saying what
 * it is for. `state.ts` remembers the last build whether anyone asked or not;
 * this is the list they asked for.
 *
 * It lives in `localStorage` under its own key and nowhere else — a saved code
 * is a note to yourself, and the link is still how a code reaches anyone else.
 * Nothing read back is trusted: the list outlives the page that wrote it, so an
 * entry that is not the shape this file writes is dropped on the way in, and
 * every storage call is wrapped the way `state.ts`'s are.
 */

export const SAVED_KEY = "combi-name:saved";

/** Room for a few lines of notes, short enough that the list stays a list. */
export const DESCRIPTION_MAX = 500;

export interface SavedCode {
	readonly code: string;
	readonly description: string;
	/** Milliseconds since the epoch, when the entry was last saved. */
	readonly savedAt: number;
}

function isSavedCode(value: unknown): value is SavedCode {
	if (typeof value !== "object" || value === null) return false;
	const entry = value as { [K in keyof SavedCode]?: unknown };
	return (
		typeof entry.code === "string" &&
		entry.code !== "" &&
		typeof entry.description === "string" &&
		typeof entry.savedAt === "number" &&
		Number.isFinite(entry.savedAt)
	);
}

/**
 * A description as it is kept: line breaks are part of it, so only the blank
 * lines around it and the spaces closing each line go.
 */
export function cleanDescription(description: string): string {
	return description
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.trimEnd())
		.join("\n")
		.replace(/^\s*\n|\n\s*$/g, "")
		.trim()
		.slice(0, DESCRIPTION_MAX);
}

/** The first line, for anywhere a description has to fit in a sentence. */
export function descriptionTitle(description: string): string {
	return description.split("\n")[0] ?? "";
}

/** Every saved code, newest first. */
export function readSaved(storage: Storage): SavedCode[] {
	let raw: string | null = null;
	try {
		raw = storage.getItem(SAVED_KEY);
	} catch {
		return [];
	}
	if (raw === null) return [];

	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		return [];
	}
	if (!Array.isArray(parsed)) return [];
	return parsed.filter(isSavedCode);
}

function writeSaved(storage: Storage, entries: readonly SavedCode[]): boolean {
	try {
		storage.setItem(SAVED_KEY, JSON.stringify(entries));
		return true;
	} catch {
		return false;
	}
}

/**
 * Saves a code at the head of the list. A code already in the list is not
 * listed twice: saving it again takes the new description and moves it to the
 * top, since two notes on one code is one note someone forgot they wrote.
 *
 * Returns the list as it now stands, and whether the browser kept it — a
 * refused write still hands back the list the page should show for this visit.
 */
export function saveCode(
	storage: Storage,
	code: string,
	description: string,
	now: number = Date.now(),
): { entries: SavedCode[]; stored: boolean } {
	const entry: SavedCode = {
		code,
		description: cleanDescription(description),
		savedAt: now,
	};
	const entries = [
		entry,
		...readSaved(storage).filter((saved) => saved.code !== code),
	];
	return { entries, stored: writeSaved(storage, entries) };
}

export function removeSaved(
	storage: Storage,
	code: string,
): { entries: SavedCode[]; stored: boolean } {
	const entries = readSaved(storage).filter((saved) => saved.code !== code);
	return { entries, stored: writeSaved(storage, entries) };
}
