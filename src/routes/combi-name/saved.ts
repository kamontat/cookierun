/**
 * Codes someone kept on purpose, each with a few words of their own saying what
 * it is for. `state.ts` remembers the last build whether anyone asked or not;
 * this is the list they asked for.
 *
 * It lives in `localStorage` under its own key and nowhere else. It leaves the
 * browser only when someone sends it: one entry as a link carrying its note
 * (`state.ts`'s `shareHashFor`), or the whole list as the text `formatSaved`
 * writes and `parseSaved` reads back. Nothing read back is trusted: the list
 * outlives the page that wrote it, so an entry that is not the shape this file
 * writes is dropped on the way in, every storage call is wrapped the way
 * `state.ts`'s are, and imported text is decoded code by code.
 */

import { decodeFull, encodeFull } from "./full-code";
import { codeInHash, noteInHash } from "./state";

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

export type UpdateResult =
	| { ok: true; entries: SavedCode[]; stored: boolean }
	| { ok: false; reason: "missing" | "taken"; entries: SavedCode[] };

/**
 * Rewrites one entry — its code, its description, or both — where it stands.
 * Editing is not saving afresh, so the entry keeps its place in the list.
 *
 * The list holds each code once, so moving an entry onto a code another entry
 * already holds is refused rather than quietly merging two notes into one.
 */
export function updateSaved(
	storage: Storage,
	code: string,
	change: { code: string; description: string },
	now: number = Date.now(),
): UpdateResult {
	const entries = readSaved(storage);
	const index = entries.findIndex((saved) => saved.code === code);
	if (index === -1) return { ok: false, reason: "missing", entries };
	if (
		change.code !== code &&
		entries.some((saved) => saved.code === change.code)
	) {
		return { ok: false, reason: "taken", entries };
	}

	const next = entries.with(index, {
		code: change.code,
		description: cleanDescription(change.description),
		savedAt: now,
	});
	return { ok: true, entries: next, stored: writeSaved(storage, next) };
}

/**
 * The list as text someone can paste into a chat, a note or a file: each code
 * on a line of its own, its description under it with every line quoted by
 * `>`, and a blank line between entries. The quote is what tells a description
 * from a code on the way back in, so a note may say anything, a code included.
 */
export function formatSaved(entries: readonly SavedCode[]): string {
	return entries
		.map((entry) => {
			const note =
				entry.description === ""
					? []
					: entry.description
							.split("\n")
							.map((line) => (line === "" ? ">" : `> ${line}`));
			return [entry.code, ...note].join("\n");
		})
		.map((block) => `${block}\n`)
		.join("\n");
}

/** One entry read from text, before the list it joins gives it a time. */
export interface ParsedCode {
	readonly code: string;
	readonly description: string;
}

/** A line of text that named no code this page can read. */
export interface SkippedLine {
	/** One-based, the way an editor numbers it. */
	readonly line: number;
	readonly text: string;
	readonly reason: string;
}

/** The code a line names, written in the form the page itself would write it. */
function codeOnLine(text: string): { code: string; note: string | null } {
	// A link, or a bare hash: the code is the fragment, and it may carry a note.
	const at = text.indexOf("#");
	const raw = at === -1 ? text : text.slice(at);
	const code = at === -1 ? text.toUpperCase() : (codeInHash(raw) ?? "");
	const { full } = decodeFull(code);
	return {
		code: encodeFull(full),
		note: at === -1 ? null : noteInHash(raw),
	};
}

/**
 * Reads the text `formatSaved` writes, and the looser things people paste
 * instead: bare codes one per line, a shared link, a `>` with no space after
 * it. A line that is neither a quote nor a code is skipped and reported rather
 * than failing the lot, since one typo should not cost someone a whole list.
 * A quote with no code above it belongs to nothing and goes without a word.
 *
 * A code listed twice is read once, keeping the first — the same rule the
 * saved list itself keeps.
 */
export function parseSaved(text: string): {
	entries: ParsedCode[];
	skipped: SkippedLine[];
} {
	const blocks: { code: string; linkNote: string | null; lines: string[] }[] =
		[];
	const skipped: SkippedLine[] = [];
	let current: (typeof blocks)[number] | null = null;

	text
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.forEach((raw, index) => {
			const line = raw.trim();
			if (line.startsWith(">")) {
				current?.lines.push(line.slice(1).replace(/^ /, ""));
				return;
			}
			if (line === "") return;
			try {
				const { code, note } = codeOnLine(line);
				current = { code, linkNote: note, lines: [] };
				blocks.push(current);
			} catch (error) {
				current = null;
				skipped.push({
					line: index + 1,
					text: line,
					reason: error instanceof Error ? error.message : String(error),
				});
			}
		});

	const entries: ParsedCode[] = [];
	for (const block of blocks) {
		if (entries.some((entry) => entry.code === block.code)) continue;
		const typed = cleanDescription(block.lines.join("\n"));
		entries.push({
			code: block.code,
			description:
				typed !== "" ? typed : cleanDescription(block.linkNote ?? ""),
		});
	}
	return { entries, skipped };
}

/**
 * Adds what text brought in to the saved list. A code already saved keeps the
 * note it has: the note someone wrote for themselves outranks one that came
 * from somewhere else, and an import that could overwrite a list is one nobody
 * would dare run twice. New codes go to the top in the order the text had them.
 */
export function importSaved(
	storage: Storage,
	incoming: readonly ParsedCode[],
	now: number = Date.now(),
): { entries: SavedCode[]; stored: boolean; added: number; kept: number } {
	const existing = readSaved(storage);
	const fresh = incoming
		.filter((entry) => !existing.some((saved) => saved.code === entry.code))
		.map((entry) => ({
			code: entry.code,
			description: cleanDescription(entry.description),
			savedAt: now,
		}));
	const entries = [...fresh, ...existing];
	return {
		entries,
		stored: fresh.length === 0 ? true : writeSaved(storage, entries),
		added: fresh.length,
		kept: incoming.length - fresh.length,
	};
}
