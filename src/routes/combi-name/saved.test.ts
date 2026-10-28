import { expect, test } from "bun:test";

import {
	cleanDescription,
	clearSaved,
	DESCRIPTION_MAX,
	descriptionTitle,
	facetValues,
	filterSaved,
	formatSaved,
	importSaved,
	isFiltering,
	NO_FILTER,
	parseSaved,
	readSaved,
	rememberSort,
	removeSaved,
	runFacets,
	SAVED_KEY,
	SAVED_SORT_KEY,
	SAVED_SORT_LABELS,
	SAVED_SORTS,
	type SavedCode,
	saveCode,
	sortSaved,
	storedSort,
	updateSaved,
} from "./saved";
import { shareHashFor } from "./state";

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

	saveCode(held, "1-0S0000000", { description: "  Score run  " }, 1);

	expect(readSaved(held)).toEqual([
		{ code: "1-0S0000000", description: "Score run", savedAt: 1 },
	]);
});

test("the newest save leads the list", () => {
	const held = storage();

	saveCode(held, "1-0S0000000", { description: "first" }, 1);
	saveCode(held, "1-0M0000000", { description: "second" }, 2);

	expect(readSaved(held).map((entry) => entry.code)).toEqual([
		"1-0M0000000",
		"1-0S0000000",
	]);
});

test("saving a code again replaces its description and moves it to the top", () => {
	const held = storage();

	saveCode(held, "1-0S0000000", { description: "old" }, 1);
	saveCode(held, "1-0M0000000", { description: "other" }, 2);
	const { entries } = saveCode(held, "1-0S0000000", { description: "new" }, 3);

	expect(entries).toEqual([
		{ code: "1-0S0000000", description: "new", savedAt: 3 },
		{ code: "1-0M0000000", description: "other", savedAt: 2 },
	]);
	expect(readSaved(held)).toEqual(entries);
});

test("a description longer than the limit is cut to it", () => {
	const { entries } = saveCode(storage(), "1-0S0000000", {
		description: "x".repeat(500),
	});

	expect(entries[0]?.description).toHaveLength(DESCRIPTION_MAX);
});

test("removing a code takes only that code out", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "a" }, 1);
	saveCode(held, "1-0M0000000", { description: "b" }, 2);

	const { entries } = removeSaved(held, "1-0S0000000");

	expect(entries.map((entry) => entry.code)).toEqual(["1-0M0000000"]);
	expect(readSaved(held)).toEqual(entries);
});

test("clearing the list takes every code out", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "a" }, 1);
	saveCode(held, "1-0M0000000", { description: "b" }, 2);

	const { entries, stored } = clearSaved(held);

	expect(entries).toEqual([]);
	expect(stored).toBe(true);
	expect(readSaved(held)).toEqual([]);
	expect(clearSaved(REFUSING).stored).toBe(false);
});

test("a list that is not this file's shape reads as empty or loses the bad rows", () => {
	expect(readSaved(storage("not json"))).toEqual([]);
	expect(readSaved(storage('{"code":"1-0S0000000"}'))).toEqual([]);
	expect(
		readSaved(
			storage(
				JSON.stringify([
					{ code: "1-0S0000000", description: "ok", savedAt: 1 },
					{ code: "", description: "empty", savedAt: 1 },
					{ code: "1-0M0000000", savedAt: 1 },
					null,
				]),
			),
		),
	).toEqual([{ code: "1-0S0000000", description: "ok", savedAt: 1 }]);
});

test("a browser that refuses storage still answers, and says the save was not kept", () => {
	expect(readSaved(REFUSING)).toEqual([]);

	const { entries, stored } = saveCode(
		REFUSING,
		"1-0S0000000",
		{ description: "a" },
		1,
	);

	expect(stored).toBe(false);
	expect(entries).toHaveLength(1);
	expect(removeSaved(REFUSING, "1-0S0000000").stored).toBe(false);
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

test("updating an entry's note keeps its code and its place in the list", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "a" }, 1);
	saveCode(held, "1-0M0000000", { description: "b" }, 2);

	const result = updateSaved(
		held,
		"1-0S0000000",
		{ code: "1-0S0000000", description: " new note " },
		3,
	);

	expect(result.ok).toBe(true);
	expect(readSaved(held)).toEqual([
		{ code: "1-0M0000000", description: "b", savedAt: 2 },
		{ code: "1-0S0000000", description: "new note", savedAt: 3 },
	]);
});

test("updating an entry's code moves the note onto the new code in place", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "a" }, 1);
	saveCode(held, "1-0M0000000", { description: "b" }, 2);

	updateSaved(
		held,
		"1-0S0000000",
		{ code: "1-0B5000000", description: "a" },
		3,
	);

	expect(readSaved(held).map((entry) => entry.code)).toEqual([
		"1-0M0000000",
		"1-0B5000000",
	]);
});

test("an update onto a code another entry holds is refused, and nothing changes", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "a" }, 1);
	saveCode(held, "1-0M0000000", { description: "b" }, 2);
	const before = readSaved(held);

	const result = updateSaved(held, "1-0S0000000", {
		code: "1-0M0000000",
		description: "a",
	});

	expect(result).toEqual({ ok: false, reason: "taken", entries: before });
	expect(readSaved(held)).toEqual(before);
});

test("an update to an entry that is gone is refused", () => {
	const result = updateSaved(storage(), "1-0S0000000", {
		code: "1-0S0000000",
		description: "a",
	});

	expect(result).toEqual({ ok: false, reason: "missing", entries: [] });
});

test("the list as text is each code on its own line with its note quoted under it", () => {
	expect(
		formatSaved([
			{
				code: "1-0M0000000",
				description: "Coin farm\n\nuse Fairy",
				savedAt: 2,
			},
			{ code: "1-0S0000000", description: "", savedAt: 1 },
		]),
	).toBe("1-0M0000000\n> Coin farm\n>\n> use Fairy\n\n1-0S0000000\n");
});

test("the text a list is written as reads back as the same list", () => {
	const entries = [
		{ code: "1-0M0000000", description: "Coin farm\n\nuse Fairy", savedAt: 2 },
		{ code: "1-0S0000000", description: "", savedAt: 1 },
	];

	expect(parseSaved(formatSaved(entries))).toEqual({
		entries: entries.map(({ code, description }) => ({ code, description })),
		skipped: [],
	});
});

test("reading text takes bare codes, canonicalises them, and skips what does not read", () => {
	const { entries, skipped } = parseSaved(
		"  0m0000000  \nnot a code\n> orphan note\n1-0S0000000\n>no space\n",
	);

	expect(entries).toEqual([
		{ code: "1-0M0000000", description: "" },
		{ code: "1-0S0000000", description: "no space" },
	]);
	expect(skipped.map((line) => line.line)).toEqual([2]);
});

test("reading text takes a shared link, and the note the link carries", () => {
	const { entries } = parseSaved(
		`https://example.com/combi-name/${shareHashFor("1-0M0000000", "Coin farm")}\nhttps://example.com/combi-name/#1-0S0000000\n> typed under it`,
	);

	expect(entries).toEqual([
		{ code: "1-0M0000000", description: "Coin farm" },
		{ code: "1-0S0000000", description: "typed under it" },
	]);
});

test("a code listed twice in the text is read once, keeping the first note", () => {
	const { entries } = parseSaved("1-0M0000000\n> first\n1-0M0000000\n> second");

	expect(entries).toEqual([{ code: "1-0M0000000", description: "first" }]);
});

test("importing adds the codes not yet saved, in order at the top, and leaves saved ones alone", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "mine" }, 1);

	const result = importSaved(
		held,
		[
			{ code: "1-0M0000000", description: "a" },
			{ code: "1-0S0000000", description: "theirs" },
			{ code: "1-0B5000000", description: "b" },
		],
		5,
	);

	expect(result.added).toBe(2);
	expect(result.kept).toBe(1);
	expect(result.stored).toBe(true);
	expect(readSaved(held)).toEqual([
		{ code: "1-0M0000000", description: "a", savedAt: 5 },
		{ code: "1-0B5000000", description: "b", savedAt: 5 },
		{ code: "1-0S0000000", description: "mine", savedAt: 1 },
	]);
});

test("an entry keeps its run stats, and drops the ones that are not well formed", () => {
	const held = storage();
	saveCode(
		held,
		"1-0M0000000",
		{
			description: "Coin farm",
			stats: { money: { min: 12000, max: 15000 }, time: 245 },
		},
		1,
	);

	expect(readSaved(held)).toEqual([
		{
			code: "1-0M0000000",
			description: "Coin farm",
			stats: { money: { min: 12000, max: 15000 }, time: 245 },
			savedAt: 1,
		},
	]);
	expect(
		readSaved(
			storage(
				JSON.stringify([
					{
						code: "1-0S0000000",
						description: "",
						savedAt: 1,
						stats: { boxes: { min: 0, max: 9 }, exp: { min: 5, max: 5 } },
					},
					{ code: "1-0M0000000", description: "", savedAt: 1, stats: "junk" },
				]),
			),
		),
	).toEqual([
		{
			code: "1-0S0000000",
			description: "",
			stats: { exp: { min: 5, max: 5 } },
			savedAt: 1,
		},
		{ code: "1-0M0000000", description: "", savedAt: 1 },
	]);
});

test("updating an entry rewrites its stats, and clearing them takes them off", () => {
	const held = storage();
	saveCode(held, "1-0S0000000", { description: "a", stats: { time: 60 } }, 1);

	updateSaved(
		held,
		"1-0S0000000",
		{ code: "1-0S0000000", description: "a", stats: { time: 90 } },
		2,
	);
	expect(readSaved(held)[0]?.stats).toEqual({ time: 90 });

	updateSaved(
		held,
		"1-0S0000000",
		{ code: "1-0S0000000", description: "a" },
		3,
	);
	expect(readSaved(held)[0]).toEqual({
		code: "1-0S0000000",
		description: "a",
		savedAt: 3,
	});
});

test("exported text carries the stats on lines of their own and reads them back", () => {
	const entries = [
		{
			code: "1-0M0000000",
			description: "Coin farm",
			stats: {
				money: { min: 12000, max: 15000 },
				exp: { min: 300, max: 300 },
				boxes: { min: 2, max: 4 },
				time: 245,
			},
			savedAt: 2,
		},
		{ code: "1-0S0000000", description: "", savedAt: 1 },
	];
	const text = formatSaved(entries);

	expect(text).toBe(
		"1-0M0000000\nmoney: 12000-15000\nexp: 300\nboxes: 2-4\ntime: 245\n> Coin farm\n\n1-0S0000000\n",
	);
	expect(parseSaved(text)).toEqual({
		entries: entries.map(({ savedAt: _savedAt, ...entry }) => entry),
		skipped: [],
	});
});

test("a stat line that does not read is skipped and reported, and the entry stays", () => {
	const { entries, skipped } = parseSaved(
		"1-0M0000000\nboxes: 9\nTime: 60\nmoney: 1,000 - 2,000",
	);

	expect(entries).toEqual([
		{
			code: "1-0M0000000",
			description: "",
			stats: { money: { min: 1000, max: 2000 }, time: 60 },
		},
	]);
	expect(skipped).toEqual([
		{
			line: 2,
			text: "boxes: 9",
			reason: "Boxes takes 0 to 5, or a range like 2-4.",
		},
	]);
});

test("a shared link's stats come in with it, and typed stat lines win over them", () => {
	const link = `https://example.com/combi-name/${shareHashFor(
		"1-0M0000000",
		"",
		{
			money: { min: 1, max: 2 },
			time: 60,
		},
	)}`;

	expect(parseSaved(`${link}\ntime: 90`).entries).toEqual([
		{
			code: "1-0M0000000",
			description: "",
			stats: { money: { min: 1, max: 2 }, time: 90 },
		},
	]);
});

test("importing keeps the stats that came in", () => {
	const held = storage();

	importSaved(
		held,
		[{ code: "1-0M0000000", description: "a", stats: { time: 60 } }],
		5,
	);

	expect(readSaved(held)[0]?.stats).toEqual({ time: 60 });
});

const LIST: readonly SavedCode[] = [
	{
		code: "A",
		description: "",
		savedAt: 3,
		stats: { money: { min: 1, max: 5 } },
	},
	{ code: "B", description: "", savedAt: 1, stats: { time: 90 } },
	{
		code: "C",
		description: "",
		savedAt: 2,
		stats: { money: { min: 4, max: 9 }, time: 30 },
	},
	{
		code: "D",
		description: "",
		savedAt: 4,
		stats: { money: { min: 2, max: 5 } },
	},
];

const codes = (entries: readonly SavedCode[]) =>
	entries.map((entry) => entry.code);

test("newest is the list as stored, and oldest is it the other way up", () => {
	expect(codes(sortSaved(LIST, "newest"))).toEqual(["A", "B", "C", "D"]);
	expect(codes(sortSaved(LIST, "oldest"))).toEqual(["D", "C", "B", "A"]);
});

test("a stat sort puts the most first, by the top of a range, and entries without it last", () => {
	// A and D tie on the top of their range, so the higher floor leads.
	expect(codes(sortSaved(LIST, "money"))).toEqual(["C", "D", "A", "B"]);
	expect(codes(sortSaved(LIST, "time"))).toEqual(["B", "C", "A", "D"]);
	// Nobody has exp: the stored order stands.
	expect(codes(sortSaved(LIST, "exp"))).toEqual(["A", "B", "C", "D"]);
});

test("saved codes sort by the highest score", () => {
	const list: SavedCode[] = [
		{ code: "A", description: "", savedAt: 2 },
		{
			code: "B",
			description: "",
			savedAt: 1,
			stats: { score: { min: 1, max: 9 } },
		},
	];
	expect(SAVED_SORTS).toContain("score");
	expect(SAVED_SORT_LABELS.score).toBe("Highest score");
	expect(codes(sortSaved(list, "score"))).toEqual(["B", "A"]);
});

test("exported text carries the score as a line of its own", () => {
	const text = formatSaved([
		{
			code: "1-0S0000000",
			description: "",
			stats: { score: { min: 1200000, max: 1500000 } },
			savedAt: 1,
		},
	]);

	expect(text).toBe("1-0S0000000\nscore: 1200000-1500000\n");
	expect(parseSaved("1-0S0000000\nScore: 1,200,000").entries).toEqual([
		{
			code: "1-0S0000000",
			description: "",
			stats: { score: { min: 1200000, max: 1200000 } },
		},
	]);
});

test("sorting leaves the list it was given alone", () => {
	const before = codes(LIST);
	sortSaved(LIST, "oldest");
	expect(codes(LIST)).toEqual(before);
});

test("the chosen sort is remembered, and anything else reads as newest", () => {
	const held = storage();
	expect(storedSort(held)).toBe("newest");

	rememberSort(held, "money");
	expect(storedSort(held)).toBe("money");

	expect(storedSort(storage("sideways"))).toBe("newest");
	expect(storedSort(REFUSING)).toBe("newest");
	expect(() => rememberSort(REFUSING, "time")).not.toThrow();
	expect(SAVED_SORT_KEY).not.toBe(SAVED_KEY);
	expect(SAVED_SORTS[0]).toBe("newest");
});

const RUNS: readonly SavedCode[] = [
	{ code: "1-0M3000000", description: "Coin farm", savedAt: 4 },
	{ code: "1-0B3000000", description: "Box\nslow but safe", savedAt: 3 },
	{ code: "1-AE0000000", description: "", savedAt: 2 },
	{ code: "NOT A CODE", description: "old money run", savedAt: 1 },
];

test("a run's facets are the mode, goal and episode its row reads as", () => {
	expect(runFacets("1-0M3000000")).toEqual({
		mode: "Manual",
		goal: "Money",
		episode: "EP. 3",
	});
	expect(runFacets("1-AE0000000")).toEqual({
		mode: "Auto",
		goal: "Exp",
		episode: "Any episode",
	});
	expect(runFacets("NOT A CODE")).toBeNull();
});

// A run aiming for several goals is one of each of them: filtering on Exp
// keeps it, and the goal filter offers each goal once, never the pair.
test("a run aiming for several goals matches and offers each of them", () => {
	const runs: readonly SavedCode[] = [
		...RUNS,
		{ code: "1-063000000", description: "", savedAt: 0 },
	];

	expect(codes(filterSaved(runs, { ...NO_FILTER, goal: "Exp" }))).toEqual([
		"1-AE0000000",
		"1-063000000",
	]);
	expect(facetValues(runs, "goal")).toEqual(["Box", "Exp", "Money"]);
});

test("no filter keeps every entry", () => {
	expect(isFiltering(NO_FILTER)).toBe(false);
	expect(codes(filterSaved(RUNS, NO_FILTER))).toEqual(codes(RUNS));
});

test("the search matches the note, the code and the run, in any case", () => {
	const search = (text: string) =>
		codes(filterSaved(RUNS, { ...NO_FILTER, text }));

	expect(isFiltering({ ...NO_FILTER, text: "x" })).toBe(true);
	expect(search("MONEY")).toEqual(["1-0M3000000", "NOT A CODE"]);
	expect(search("safe")).toEqual(["1-0B3000000"]);
	expect(search("ae00")).toEqual(["1-AE0000000"]);
	// Every word has to match, wherever it is.
	expect(search("manual box")).toEqual(["1-0B3000000"]);
	expect(search("   ")).toEqual(codes(RUNS));
});

test("a facet keeps only the runs that read as it, and a code that no longer reads is not one", () => {
	expect(codes(filterSaved(RUNS, { ...NO_FILTER, mode: "Manual" }))).toEqual([
		"1-0M3000000",
		"1-0B3000000",
	]);
	expect(
		codes(filterSaved(RUNS, { ...NO_FILTER, mode: "Manual", goal: "Box" })),
	).toEqual(["1-0B3000000"]);
	expect(
		codes(filterSaved(RUNS, { ...NO_FILTER, episode: "Any episode" })),
	).toEqual(["1-AE0000000"]);
});

test("a facet offers only the values the list holds, once each, in reading order", () => {
	expect(facetValues(RUNS, "mode")).toEqual(["Auto", "Manual"]);
	expect(facetValues(RUNS, "goal")).toEqual(["Box", "Exp", "Money"]);
	expect(
		facetValues(
			[
				{ code: "1-0M3000000", description: "", savedAt: 1 },
				{ code: "1-AE0000000", description: "", savedAt: 1 },
			],
			"episode",
		),
	).toEqual(["Any episode", "EP. 3"]);
});
