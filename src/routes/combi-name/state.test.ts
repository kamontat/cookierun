import { expect, test } from "bun:test";

import {
	codeInHash,
	hashFor,
	rememberCode,
	STORAGE_KEY,
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
	expect(codeInHash("#1S00000000")).toBe("1S00000000");
	expect(hashFor("1S00000000")).toBe("#1S00000000");
});

test("an empty or bare hash is no code at all", () => {
	expect(codeInHash("")).toBeNull();
	expect(codeInHash("#")).toBeNull();
	expect(codeInHash("#   ")).toBeNull();
});

test("a lowercase code in the hash reads as the canonical uppercase one", () => {
	expect(codeInHash("#1c00-1s00000000")).toBe("1C00-1S00000000");
});

test("the remembered code survives a round trip through storage", () => {
	const held = storage(null);

	rememberCode(held, "1S00000000");

	expect(storedCode(held)).toBe("1S00000000");
	expect(held.written).toEqual(["1S00000000"]);
});

test("a browser that refuses storage still yields a code, and swallows the write", () => {
	expect(storedCode(REFUSING)).toBeNull();
	expect(() => {
		rememberCode(REFUSING, "1S00000000");
	}).not.toThrow();
});

test("a link beats the last visit, which beats nothing at all", () => {
	const held = storage("1M00000000");

	expect(startingCode("#1E36R00J00", held)).toBe("1E36R00J00");
	expect(startingCode("", held)).toBe("1M00000000");
	expect(startingCode("", storage(null))).toBeNull();
});

test("the storage key names the page, so another tool cannot collide with it", () => {
	expect(STORAGE_KEY).toBe("combi-name:code");
});
