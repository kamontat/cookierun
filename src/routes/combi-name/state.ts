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

import {
	formatStat,
	parseStat,
	putStat,
	type RunStats,
	STAT_FIELDS,
	type StatsDraft,
} from "./stats";

export const STORAGE_KEY = "combi-name:code";

/**
 * A shared link may carry a note and run stats after the code, as
 * `#CODE?note=...&money=12000-15000&time=245`. The page's own hash never does — it is the build on screen and nothing else — so only a
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

/**
 * A note travels as base64url of its UTF-8 bytes rather than percent-escaped:
 * the link then holds only letters, digits, `-` and `_`, with no space, `+` or
 * `%` for a chat app to end the link at or re-escape, and a note in Thai or
 * with an emoji comes out at under half the length its escapes would take.
 */
function encodeNote(note: string): string {
	let binary = "";
	for (const byte of new TextEncoder().encode(note)) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary)
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

function decodeNote(encoded: string): string | null {
	if (!/^[A-Za-z0-9_-]+$/.test(encoded)) return null;
	try {
		const binary = atob(encoded.replace(/-/g, "+").replace(/_/g, "/"));
		const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
		return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
	} catch {
		return null;
	}
}

/** The note a shared link carries beside its code, as it was written. */
export function noteInHash(hash: string): string | null {
	const encoded = new URLSearchParams(splitHash(hash).query).get("note");
	if (encoded === null) return null;
	const note = decodeNote(encoded);
	return note === null || note.trim() === "" ? null : note;
}

/**
 * The run stats a shared link carries. They travel as typed — digits and a
 * hyphen need no escaping — and one that does not read is left out.
 */
export function statsInHash(hash: string): RunStats {
	const query = new URLSearchParams(splitHash(hash).query);
	const stats: StatsDraft = {};
	for (const field of STAT_FIELDS) {
		const parsed = parseStat(field, query.get(field) ?? "");
		if (parsed.ok) putStat(stats, field, parsed.value);
	}
	return stats;
}

export function hashFor(code: string): string {
	return `#${code}`;
}

/**
 * The hash of a link that hands someone a code and the note and stats that go
 * with it.
 */
export function shareHashFor(
	code: string,
	note: string,
	stats: RunStats = {},
): string {
	const canonical = code.trim().toUpperCase();
	const params = [
		...(note.trim() === "" ? [] : [`note=${encodeNote(note)}`]),
		...STAT_FIELDS.flatMap((field) => {
			const value = stats[field];
			return value === undefined ? [] : [`${field}=${formatStat(value)}`];
		}),
	];
	if (params.length === 0) return hashFor(canonical);
	return `${hashFor(canonical)}${NOTE_MARK}${params.join("&")}`;
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
 * Which tab was open in the workbench below the summary. A view preference
 * rather than part of the build, so it is kept apart from the code and never
 * travels in a link.
 */
export const TAB_KEY = "combi-name:tab";

export type TabName = "main" | "cookies" | "treasures" | "boosts";

export const TAB_NAMES: readonly TabName[] = [
	"main",
	"cookies",
	"treasures",
	"boosts",
];

function isTabName(value: string | null): value is TabName {
	return (TAB_NAMES as readonly string[]).includes(value ?? "");
}

export function storedTab(storage: Storage): TabName {
	try {
		const value = storage.getItem(TAB_KEY);
		return isTabName(value) ? value : "main";
	} catch {
		return "main";
	}
}

export function rememberTab(storage: Storage, tab: TabName): void {
	try {
		storage.setItem(TAB_KEY, tab);
	} catch {}
}

/**
 * Whether the code panel shows the whole code, loadout and all, rather than
 * the ten characters the game takes. Off by default: the loadout is the
 * summary's to show. Stored as "1" or "0", every access wrapped.
 */
export const FULL_CODE_KEY = "combi-name:full-code";

export function storedFullCode(storage: Storage): boolean {
	try {
		return storage.getItem(FULL_CODE_KEY) === "1";
	} catch {
		return false;
	}
}

export function rememberFullCode(storage: Storage, full: boolean): void {
	try {
		storage.setItem(FULL_CODE_KEY, full ? "1" : "0");
	} catch {}
}

export function startingCode(hash: string, storage: Storage): string | null {
	return codeInHash(hash) ?? storedCode(storage);
}
