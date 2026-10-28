import { expect, test } from "bun:test";

import {
	codeInHash,
	hashFor,
	noteInHash,
	rememberCode,
	rememberFullCode,
	rememberTab,
	STORAGE_KEY,
	shareHashFor,
	startingCode,
	statsInHash,
	storedCode,
	storedFullCode,
	storedTab,
} from "./state";

function storage(initial: string | null): Storage & { written: string[] } {
	let held = initial;
	const written: string[] = [];
	return {
		written,
		getItem: () => held,
		setItem: (_key: string, value: string) => {
			held = value;
			written.push(value);
		},
	} as unknown as Storage & { written: string[] };
}

const REFUSING = {
	getItem() {
		throw new Error("storage is off");
	},
	setItem() {
		throw new Error("storage is off");
	},
} as unknown as Storage;

test("a hash carries the code without its leading marker", () => {
	expect(codeInHash("#1-MS0A000000")).toBe("1-MS0A000000");
	expect(hashFor("1-MS0A000000")).toBe("#1-MS0A000000");
});

test("an empty or bare hash is no code at all", () => {
	expect(codeInHash("")).toBeNull();
	expect(codeInHash("#")).toBeNull();
	expect(codeInHash("#   ")).toBeNull();
});

test("a lowercase code in the hash reads as the canonical uppercase one", () => {
	expect(codeInHash("#1c00-ms0a000000")).toBe("1C00-MS0A000000");
});

test("the remembered code survives a round trip through storage", () => {
	const held = storage(null);

	rememberCode(held, "1-MS0A000000");

	expect(storedCode(held)).toBe("1-MS0A000000");
	expect(held.written).toEqual(["1-MS0A000000"]);
});

test("a browser that refuses storage still yields a code, and swallows the write", () => {
	expect(storedCode(REFUSING)).toBeNull();
	expect(() => {
		rememberCode(REFUSING, "1-MS0A000000");
	}).not.toThrow();
});

test("a link beats the last visit, which beats nothing at all", () => {
	const held = storage("1-MM0A000000");

	expect(startingCode("#1-JX035RV000", held)).toBe("1-JX035RV000");
	expect(startingCode("", held)).toBe("1-MM0A000000");
	expect(startingCode("", storage(null))).toBeNull();
});

test("the storage key names the page, so another tool cannot collide with it", () => {
	expect(STORAGE_KEY).toBe("combi-name:code");
});

test("a shared link carries its note after the code, and the code reads without it", () => {
	const hash = shareHashFor("1-MM0A000000", "Coin farm\nuse Fairy & co");

	expect(hash.startsWith("#1-MM0A000000?note=")).toBe(true);
	expect(codeInHash(hash)).toBe("1-MM0A000000");
	expect(noteInHash(hash)).toBe("Coin farm\nuse Fairy & co");
});

test("a link with no note, or an empty one, carries none", () => {
	expect(shareHashFor("1-MM0A000000", "")).toBe("#1-MM0A000000");
	expect(noteInHash("#1-MM0A000000")).toBeNull();
	expect(noteInHash("#1-MM0A000000?note=")).toBeNull();
	expect(noteInHash("")).toBeNull();
});

test("a note keeps its own case while the code is uppercased", () => {
	const hash = shareHashFor("1-mm0a000000", "Keep My Case");

	expect(codeInHash(hash)).toBe("1-MM0A000000");
	expect(noteInHash(hash)).toBe("Keep My Case");
});

// Base64url rather than percent-escapes: no space, `+` or `%` for a chat app to
// end the link at, and non-Latin text comes out shorter, not three times longer.
test("a note travels as base64url, safe for any script", () => {
	const note = "ฟาร์มเหรียญ 🍪\nuse Fairy & co / 100%";
	const hash = shareHashFor("1-MM0A000000", note);

	expect(hash).toMatch(/^#1-MM0A000000\?note=[A-Za-z0-9_-]+$/);
	expect(noteInHash(hash)).toBe(note);
});

test("a note that is not base64url, or not text, reads as none", () => {
	expect(noteInHash("#1-MM0A000000?note=***")).toBeNull();
	expect(noteInHash("#1-MM0A000000?note=_-_-")).toBeNull();
});

test("a remembered tab is read back", () => {
	const held = storage(null);

	rememberTab(held, "treasures");

	expect(storedTab(held)).toBe("treasures");
});

test("an unknown or missing tab reads as main", () => {
	expect(storedTab(storage("nope"))).toBe("main");
	expect(storedTab(storage(null))).toBe("main");
});

test("a storage that throws reads main and remembers nothing", () => {
	expect(storedTab(REFUSING)).toBe("main");
	expect(() => rememberTab(REFUSING, "boosts")).not.toThrow();
});

test("the full-code choice is remembered and read back, off by default", () => {
	const store = new Map<string, string>();
	const storage = {
		getItem: (key: string) => store.get(key) ?? null,
		setItem: (key: string, value: string) => store.set(key, value),
		removeItem: (key: string) => store.delete(key),
	} as unknown as Storage;

	expect(storedFullCode(storage)).toBe(false);
	rememberFullCode(storage, true);
	expect(storedFullCode(storage)).toBe(true);
	rememberFullCode(storage, false);
	expect(storedFullCode(storage)).toBe(false);
});

test("a storage that throws reads the full code as off and remembers nothing", () => {
	const broken = {
		getItem: () => {
			throw new Error("denied");
		},
		setItem: () => {
			throw new Error("denied");
		},
		removeItem: () => {
			throw new Error("denied");
		},
	} as unknown as Storage;

	expect(storedFullCode(broken)).toBe(false);
	expect(() => rememberFullCode(broken, true)).not.toThrow();
});

test("a shared link carries its run stats beside the note, readable by eye", () => {
	const hash = shareHashFor("1-MM0A000000", "Coin farm", {
		money: { min: 12000, max: 15000 },
		boxes: { min: 3, max: 3 },
		time: 245,
	});

	expect(hash).toMatch(/&money=12000-15000&boxes=3&time=245$/);
	expect(codeInHash(hash)).toBe("1-MM0A000000");
	expect(noteInHash(hash)).toBe("Coin farm");
	expect(statsInHash(hash)).toEqual({
		money: { min: 12000, max: 15000 },
		boxes: { min: 3, max: 3 },
		time: 245,
	});
});

test("a link with stats and no note carries the stats alone", () => {
	const hash = shareHashFor("1-MM0A000000", "", {
		exp: { min: 300, max: 450 },
	});

	expect(hash).toBe("#1-MM0A000000?exp=300-450");
	expect(noteInHash(hash)).toBeNull();
	expect(statsInHash(hash)).toEqual({ exp: { min: 300, max: 450 } });
});

test("a stat in a link that does not read is left out", () => {
	expect(statsInHash("#1-MM0A000000?money=lots&boxes=9&time=60")).toEqual({
		time: 60,
	});
	expect(statsInHash("#1-MM0A000000")).toEqual({});
});

test("a shared link carries the score first among its stats", () => {
	const hash = shareHashFor("1-MS0A000000", "", {
		money: { min: 10, max: 10 },
		score: { min: 1200000, max: 1500000 },
	});

	expect(hash).toBe("#1-MS0A000000?score=1200000-1500000&money=10");
	expect(statsInHash(hash)).toEqual({
		score: { min: 1200000, max: 1500000 },
		money: { min: 10, max: 10 },
	});
});
