/**
 * Codes someone kept on purpose, each with a few words of their own saying what
 * it is for, and the run stats it brought home (`stats.ts`). `state.ts` remembers the last build whether anyone asked or not;
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

import { describeRun } from "./describe";
import { decodeFull, encodeFull } from "./full-code";
import { codeInHash, noteInHash, statsInHash } from "./state";
import {
	formatStat,
	isEmptyStats,
	parseStat,
	putStat,
	type RunStats,
	readStats,
	STAT_FIELDS,
	type StatField,
	type StatsDraft,
} from "./stats";

export const SAVED_KEY = "combi-name:saved";

/** Room for a few lines of notes, short enough that the list stays a list. */
export const DESCRIPTION_MAX = 500;

export interface SavedCode {
	readonly code: string;
	readonly description: string;
	/** Left off rather than empty when the entry has none. */
	readonly stats?: RunStats;
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

/** An entry as it is kept: a clean description, and stats only if there are any. */
function entryOf(
	code: string,
	note: { description: string; stats?: RunStats },
	savedAt: number,
): SavedCode {
	const stats = readStats(note.stats);
	return {
		code,
		description: cleanDescription(note.description),
		...(isEmptyStats(stats) ? {} : { stats }),
		savedAt,
	};
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
	return parsed
		.filter(isSavedCode)
		.map((entry) => entryOf(entry.code, entry, entry.savedAt));
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
 * listed twice: saving it again takes the new description and stats and moves it to the
 * top, since two notes on one code is one note someone forgot they wrote.
 *
 * Returns the list as it now stands, and whether the browser kept it — a
 * refused write still hands back the list the page should show for this visit.
 */
export function saveCode(
	storage: Storage,
	code: string,
	note: { description: string; stats?: RunStats },
	now: number = Date.now(),
): { entries: SavedCode[]; stored: boolean } {
	const entry = entryOf(code, note, now);
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

/** Empties the list. Written as an empty list, the shape `removeSaved` leaves. */
export function clearSaved(storage: Storage): {
	entries: SavedCode[];
	stored: boolean;
} {
	return { entries: [], stored: writeSaved(storage, []) };
}

export type UpdateResult =
	| { ok: true; entries: SavedCode[]; stored: boolean }
	| { ok: false; reason: "missing" | "taken"; entries: SavedCode[] };

/**
 * Rewrites one entry — its code, its description, its stats — where it stands.
 * Editing is not saving afresh, so the entry keeps its place in the list.
 *
 * The list holds each code once, so moving an entry onto a code another entry
 * already holds is refused rather than quietly merging two notes into one.
 */
export function updateSaved(
	storage: Storage,
	code: string,
	change: { code: string; description: string; stats?: RunStats },
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

	const next = entries.with(index, entryOf(change.code, change, now));
	return { ok: true, entries: next, stored: writeSaved(storage, next) };
}

/**
 * The ways the drawer can show the list. Sorting is a view: the list is stored,
 * exported and edited newest first whatever the drawer shows, so picking a sort
 * never rewrites anyone's list.
 */
export const SAVED_SORTS = [
	"newest",
	"oldest",
	"score",
	"money",
	"exp",
	"boxes",
	"time",
] as const;

export type SavedSort = (typeof SAVED_SORTS)[number];

export const SAVED_SORT_LABELS: Readonly<Record<SavedSort, string>> = {
	newest: "Newest",
	oldest: "Oldest",
	score: "Highest score",
	money: "Most money",
	exp: "Most exp",
	boxes: "Most boxes",
	time: "Longest",
};

export const SAVED_SORT_KEY = "combi-name:saved-sort";

function isSavedSort(value: unknown): value is SavedSort {
	return (SAVED_SORTS as readonly unknown[]).includes(value);
}

/** The sort this browser last picked, or newest when it picked none. */
export function storedSort(storage: Storage): SavedSort {
	try {
		const value = storage.getItem(SAVED_SORT_KEY);
		return isSavedSort(value) ? value : "newest";
	} catch {
		return "newest";
	}
}

export function rememberSort(storage: Storage, sort: SavedSort): void {
	try {
		storage.setItem(SAVED_SORT_KEY, sort);
	} catch {}
}

/** A stat as one pair to compare: the top of a range first, then its floor. */
function statKey(entry: SavedCode, field: StatField): [number, number] | null {
	const value = entry.stats?.[field];
	if (value === undefined) return null;
	return typeof value === "number" ? [value, value] : [value.max, value.min];
}

/**
 * The list in the order the drawer shows it. A stat sort puts the most first,
 * by the top of a range and then its floor, and the entries that never noted
 * that stat after every one that did. Ties keep the order the list has.
 */
export function sortSaved(
	entries: readonly SavedCode[],
	sort: SavedSort,
): SavedCode[] {
	if (sort === "newest") return [...entries];
	if (sort === "oldest") return [...entries].reverse();
	return [...entries].sort((a, b) => {
		const left = statKey(a, sort);
		const right = statKey(b, sort);
		if (left === null || right === null) {
			return (left === null ? 1 : 0) - (right === null ? 1 : 0);
		}
		return right[0] - left[0] || right[1] - left[1];
	});
}

/** What a run reads as on its row, or null for a code that no longer reads. */
function runChipsOf(code: string): string[] | null {
	try {
		return describeRun(decodeFull(code).full);
	} catch {
		return null;
	}
}

/** The three things a row's run says that the drawer can filter on. */
export const RUN_FACETS = ["mode", "goal", "episode"] as const;

export type RunFacet = (typeof RUN_FACETS)[number];

/**
 * A run's mode, goal and episode, worded as its row's chips word them, so a
 * filter offers exactly what the rows say.
 */
export function runFacets(code: string): Record<RunFacet, string> | null {
	return facetsOf(runChipsOf(code));
}

function facetsOf(chips: string[] | null): Record<RunFacet, string> | null {
	if (chips === null) return null;
	const [mode = "", goal = "", episode = ""] = chips;
	return { mode, goal, episode };
}

/** What the drawer is narrowed to. An empty field narrows nothing. */
export interface SavedFilter extends Record<RunFacet, string> {
	readonly text: string;
}

export const NO_FILTER: SavedFilter = {
	text: "",
	mode: "",
	goal: "",
	episode: "",
};

export function isFiltering(filter: SavedFilter): boolean {
	return (
		filter.text.trim() !== "" ||
		RUN_FACETS.some((facet) => filter[facet] !== "")
	);
}

/**
 * The entries a filter keeps, in the order they came. The search is words,
 * each of which has to turn up somewhere in the note, the code or the run's
 * chips, in any case. A code that no longer reads has no run, so any facet
 * leaves it out.
 */
export function filterSaved(
	entries: readonly SavedCode[],
	filter: SavedFilter,
): SavedCode[] {
	const words = filter.text.toLowerCase().split(/\s+/).filter(Boolean);
	const facets = RUN_FACETS.filter((facet) => filter[facet] !== "");
	return entries.filter((entry) => {
		const chips = runChipsOf(entry.code);
		if (facets.length > 0) {
			const run = facetsOf(chips);
			if (run === null) return false;
			if (facets.some((facet) => run[facet] !== filter[facet])) return false;
		}
		const haystack = [entry.description, entry.code, ...(chips ?? [])]
			.join("\n")
			.toLowerCase();
		return words.every((word) => haystack.includes(word));
	});
}

/** Each value a facet takes in the list, once, sorted as a reader would. */
export function facetValues(
	entries: readonly SavedCode[],
	facet: RunFacet,
): string[] {
	const values = new Set<string>();
	for (const entry of entries) {
		const run = runFacets(entry.code);
		if (run !== null) values.add(run[facet]);
	}
	return [...values].sort((a, b) =>
		a.localeCompare(b, undefined, { numeric: true }),
	);
}

/**
 * The list as text someone can paste into a chat, a note or a file: each code
 * on a line of its own, its stats under it one per line as `money: 1200-1500`,
 * then its description with every line quoted by `>`, and a blank line between
 * entries. The quote is what tells a description
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
			const stats = STAT_FIELDS.flatMap((field) => {
				const value = entry.stats?.[field];
				return value === undefined ? [] : [`${field}: ${formatStat(value)}`];
			});
			return [entry.code, ...stats, ...note].join("\n");
		})
		.map((block) => `${block}\n`)
		.join("\n");
}

/** One entry read from text, before the list it joins gives it a time. */
export interface ParsedCode {
	readonly code: string;
	readonly description: string;
	readonly stats?: RunStats;
}

/** A line of text that named no code this page can read. */
export interface SkippedLine {
	/** One-based, the way an editor numbers it. */
	readonly line: number;
	readonly text: string;
	readonly reason: string;
}

/** A stat on a line of its own under a code, as `formatSaved` writes it. */
const STAT_LINE = /^(score|money|exp|boxes|time)\s*:\s*(.*)$/i;

/** The code a line names, written in the form the page itself would write it. */
function codeOnLine(text: string): {
	code: string;
	note: string | null;
	stats: RunStats;
} {
	// A link, or a bare hash: the code is the fragment, and it may carry a note.
	const at = text.indexOf("#");
	const raw = at === -1 ? text : text.slice(at);
	const code = at === -1 ? text.toUpperCase() : (codeInHash(raw) ?? "");
	const { full } = decodeFull(code);
	return {
		code: encodeFull(full),
		note: at === -1 ? null : noteInHash(raw),
		stats: at === -1 ? {} : statsInHash(raw),
	};
}

/**
 * Reads the text `formatSaved` writes, and the looser things people paste
 * instead: bare codes one per line, a shared link, a `>` with no space after
 * it, a stat label in any case. A line that is neither a quote, a stat nor a
 * code, or a stat whose value does not read, is skipped and reported rather
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
	const blocks: {
		code: string;
		linkNote: string | null;
		stats: StatsDraft;
		lines: string[];
	}[] = [];
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
			const stat = STAT_LINE.exec(line);
			if (stat !== null) {
				const field = (stat[1] ?? "").toLowerCase() as StatField;
				const parsed = parseStat(field, stat[2] ?? "");
				if (parsed.ok) {
					if (current !== null) putStat(current.stats, field, parsed.value);
				} else {
					skipped.push({ line: index + 1, text: line, reason: parsed.error });
				}
				return;
			}
			try {
				const { code, note, stats } = codeOnLine(line);
				current = { code, linkNote: note, stats: { ...stats }, lines: [] };
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
			...(isEmptyStats(block.stats) ? {} : { stats: block.stats }),
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
		.map((entry) => entryOf(entry.code, entry, now));
	const entries = [...fresh, ...existing];
	return {
		entries,
		stored: fresh.length === 0 ? true : writeSaved(storage, entries),
		added: fresh.length,
		kept: incoming.length - fresh.length,
	};
}
