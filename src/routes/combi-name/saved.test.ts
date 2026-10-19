import { expect, test } from "bun:test";

import {
	cleanDescription,
	DESCRIPTION_MAX,
	descriptionTitle,
	readSaved,
	removeSaved,
	SAVED_KEY,
	saveCode,
} from "./saved";

function storage(initial: string | null = null): Storage {
	let held = initial;
	return {
		getItem: () => held,
		setItem: (_key: string, value: string) => {
			held = value;
		},
	} as unknown as Storage;
}

const REFUSING = {
	getItem() {
		throw new Error("storage is off");
	},
	setItem() {
		throw new Error("storage is off");
	},
} as unknown as Storage;

test("a saved code comes back with its description", () => {
	const held = storage();

	saveCode(held, "10S0000000", "  Score run  ", 1);

	expect(readSaved(held)).toEqual([
		{ code: "10S0000000", description: "Score run", savedAt: 1 },
	]);
});

test("the newest save leads the list", () => {
	const held = storage();

	saveCode(held, "10S0000000", "first", 1);
	saveCode(held, "10M0000000", "second", 2);

	expect(readSaved(held).map((entry) => entry.code)).toEqual([
		"10M0000000",
		"10S0000000",
	]);
});

test("saving a code again replaces its description and moves it to the top", () => {
	const held = storage();

	saveCode(held, "10S0000000", "old", 1);
	saveCode(held, "10M0000000", "other", 2);
	const { entries } = saveCode(held, "10S0000000", "new", 3);

	expect(entries).toEqual([
		{ code: "10S0000000", description: "new", savedAt: 3 },
		{ code: "10M0000000", description: "other", savedAt: 2 },
	]);
	expect(readSaved(held)).toEqual(entries);
});

test("a description longer than the limit is cut to it", () => {
	const { entries } = saveCode(storage(), "10S0000000", "x".repeat(500));

	expect(entries[0]?.description).toHaveLength(DESCRIPTION_MAX);
});

test("removing a code takes only that code out", () => {
	const held = storage();
	saveCode(held, "10S0000000", "a", 1);
	saveCode(held, "10M0000000", "b", 2);

	const { entries } = removeSaved(held, "10S0000000");

	expect(entries.map((entry) => entry.code)).toEqual(["10M0000000"]);
	expect(readSaved(held)).toEqual(entries);
});

test("a list that is not this file's shape reads as empty or loses the bad rows", () => {
	expect(readSaved(storage("not json"))).toEqual([]);
	expect(readSaved(storage('{"code":"10S0000000"}'))).toEqual([]);
	expect(
		readSaved(
			storage(
				JSON.stringify([
					{ code: "10S0000000", description: "ok", savedAt: 1 },
					{ code: "", description: "empty", savedAt: 1 },
					{ code: "10M0000000", savedAt: 1 },
					null,
				]),
			),
		),
	).toEqual([{ code: "10S0000000", description: "ok", savedAt: 1 }]);
});

test("a browser that refuses storage still answers, and says the save was not kept", () => {
	expect(readSaved(REFUSING)).toEqual([]);

	const { entries, stored } = saveCode(REFUSING, "10S0000000", "a", 1);

	expect(stored).toBe(false);
	expect(entries).toHaveLength(1);
	expect(removeSaved(REFUSING, "10S0000000").stored).toBe(false);
});

test("the storage key names the page, apart from the last-build key", () => {
	expect(SAVED_KEY).toBe("combi-name:saved");
});

test("a description keeps its line breaks, minus the blank edges", () => {
	expect(cleanDescription("\n\n  Coin farm  \r\nuse Fairy   \n\n")).toBe(
		"Coin farm\nuse Fairy",
	);
	expect(cleanDescription("one\n\nthree")).toBe("one\n\nthree");
	expect(cleanDescription("  \n \n ")).toBe("");
});

test("a description's title is its first line", () => {
	expect(descriptionTitle("Coin farm\nuse Fairy")).toBe("Coin farm");
	expect(descriptionTitle("")).toBe("");
});
