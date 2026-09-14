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

/** The code a `location.hash` carries, canonicalised the way the reader does. */
export function codeInHash(hash: string): string | null {
	const code = hash.replace(/^#/, "").trim().toUpperCase();
	return code === "" ? null : code;
}

export function hashFor(code: string): string {
	return `#${code}`;
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

export function startingCode(hash: string, storage: Storage): string | null {
	return codeInHash(hash) ?? storedCode(storage);
}
