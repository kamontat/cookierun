import { expect, test } from "bun:test";

import {
	codeInHash,
	hashFor,
	noteInHash,
	rememberCode,
	STORAGE_KEY,
	shareHashFor,
	startingCode,
	storedCode,
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
	expect(codeInHash("#10S0000000")).toBe("10S0000000");
	expect(hashFor("10S0000000")).toBe("#10S0000000");
});

test("an empty or bare hash is no code at all", () => {
	expect(codeInHash("")).toBeNull();
	expect(codeInHash("#")).toBeNull();
	expect(codeInHash("#   ")).toBeNull();
});

test("a lowercase code in the hash reads as the canonical uppercase one", () => {
	expect(codeInHash("#1c00-10s0000000")).toBe("1C00-10S0000000");
});

test("the remembered code survives a round trip through storage", () => {
	const held = storage(null);

	rememberCode(held, "10S0000000");

	expect(storedCode(held)).toBe("10S0000000");
	expect(held.written).toEqual(["10S0000000"]);
});

test("a browser that refuses storage still yields a code, and swallows the write", () => {
	expect(storedCode(REFUSING)).toBeNull();
	expect(() => {
		rememberCode(REFUSING, "10S0000000");
	}).not.toThrow();
});

test("a link beats the last visit, which beats nothing at all", () => {
	const held = storage("10M0000000");

	expect(startingCode("#1HE34R000J", held)).toBe("1HE34R000J");
	expect(startingCode("", held)).toBe("10M0000000");
	expect(startingCode("", storage(null))).toBeNull();
});

test("the storage key names the page, so another tool cannot collide with it", () => {
	expect(STORAGE_KEY).toBe("combi-name:code");
});

test("a shared link carries its note after the code, and the code reads without it", () => {
	const hash = shareHashFor("10M0000000", "Coin farm\nuse Fairy & co");

	expect(hash.startsWith("#10M0000000?note=")).toBe(true);
	expect(codeInHash(hash)).toBe("10M0000000");
	expect(noteInHash(hash)).toBe("Coin farm\nuse Fairy & co");
});

test("a link with no note, or an empty one, carries none", () => {
	expect(shareHashFor("10M0000000", "")).toBe("#10M0000000");
	expect(noteInHash("#10M0000000")).toBeNull();
	expect(noteInHash("#10M0000000?note=")).toBeNull();
	expect(noteInHash("")).toBeNull();
});

test("a note keeps its own case while the code is uppercased", () => {
	const hash = shareHashFor("10m0000000", "Keep My Case");

	expect(codeInHash(hash)).toBe("10M0000000");
	expect(noteInHash(hash)).toBe("Keep My Case");
});
