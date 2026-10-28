import { expect, test } from "bun:test";
import index from "#assets/index.json";
import type { SummaryItem, SummaryRow } from "#components/build-summary";

import { cookiePowerArt, episodeArt } from "./art";
import { anyIdFor, imageFor, labelFor } from "./catalog";
import type { Combi } from "./codec";
import { describeBuild } from "./describe";
import { decodeFull, type FullCode } from "./full-code";
import { levelRange, treasurePick } from "./loadout";
import { HINT, summaryOf } from "./summary";

const BASE = "../assets/";

// Real entries, read from the catalog rather than typed,
// so a rename upstream does not break a test about layout.
const [COOKIE = "", RELAY = ""] = Object.keys(index.cookies);
const [PET = ""] = Object.keys(index.pets);
const [TA = "", TB = "", TC = ""] = Object.keys(index.treasures);

function combi(overrides: Partial<Combi> = {}): Combi {
	return {
		goals: ["money"],
		mode: "auto",
		episode: "episode3",
		floor: null,
		boosts: ["hpExtension", "powerJellyBoost"],
		randomBoost: "revive",
		cookiePowers: ["fairy", "seaFairy"],
		action: "jumpAtStart",
		...overrides,
	};
}

/** The full build every test that wants "everything" starts from. */
function fullBuild(
	overrides: Partial<Combi> = {},
	loadout: Partial<FullCode["loadout"]> = {},
): FullCode {
	return {
		combi: combi(overrides),
		loadout: {
			cookie: COOKIE,
			relay: RELAY,
			pet: PET,
			treasures: [[treasurePick(TA)], [treasurePick(TB)]],
			ordered: false,
			...loadout,
		},
	};
}

function row(rows: readonly SummaryRow[], label: string): SummaryRow {
	const found = rows.find((each) => each.label === label);
	if (found === undefined) throw new Error(`no ${label} row`);
	return found;
}

/** Every word an item list says, separators left out. */
function texts(items: readonly SummaryItem[]): string[] {
	return items.flatMap((item) =>
		item.kind === "sep" || item.text === undefined ? [] : [item.text],
	);
}

function seps(items: readonly SummaryItem[]): string[] {
	return items.flatMap((item) => (item.kind === "sep" ? [item.text] : []));
}

function images(items: readonly SummaryItem[]) {
	return items.flatMap((item) => (item.kind === "image" ? [item] : []));
}

test("rows follow the tabs: Run, Cookies, Treasures, Boosts, Random boost, Power+", () => {
	const { rows } = summaryOf(fullBuild(), BASE);

	expect(rows.map((each) => each.label)).toEqual([
		"Run",
		"Cookies",
		"Treasures",
		"Boosts",
		"Random boost",
		"Power+",
	]);
	expect(rows.map((each) => each.target)).toEqual([
		"mode",
		"cookie",
		"treasures",
		"boosts",
		"randomBoost",
		"cookiePowers",
	]);
});

test("Run says semi-auto and why, then goal, episode and action", () => {
	const full = fullBuild();
	const { items } = row(summaryOf(full, BASE).rows, "Run");

	expect(items).toContainEqual({
		kind: "pill",
		text: "Semi-auto",
		tone: "semi",
	});
	expect(items).toContainEqual({
		kind: "text",
		text: describeBuild(full)?.reasons.join(", ") ?? "",
		muted: true,
		// Behind the row's toggle, like the pictures' names: the pill says
		// semi-auto, and why is one click away.
		detail: true,
	});
	expect(texts(items)).toContain("Money");
	expect(texts(items)).toContain("Episode 3");
	expect(texts(items).at(-1)).toBe("Jump at start");
	const episode = images(items).find((each) => each.text === "Episode 3");
	expect(episode?.src).toBe(episodeArt("episode3", BASE));
});

test("a full-auto run's pill reads Auto with no reasons beside it", () => {
	const full = fullBuild(
		{ randomBoost: null, action: "none" },
		{ relay: null },
	);
	const { items } = row(summaryOf(full, BASE).rows, "Run");

	expect(items[0]).toEqual({ kind: "pill", text: "Auto" });
	expect(items.some((item) => item.kind === "text" && item.muted)).toBe(false);
});

test("a manual run's Run row has no action and a Manual pill", () => {
	const { full } = decodeFull("1-0M3000000");
	const { items } = row(summaryOf(full, BASE).rows, "Run");

	expect(items[0]).toEqual({ kind: "pill", text: "Manual" });
	expect(texts(items)).toEqual(["Manual", "Money", "Episode 3"]);
});

test("the tower's Run row names the floor", () => {
	const at = fullBuild({ episode: "special2", floor: 42 });
	const any = fullBuild({ episode: "special2", floor: null });

	expect(texts(row(summaryOf(at, BASE).rows, "Run").items)).toContain(
		"Special Episode 2, floor 42",
	);
	expect(texts(row(summaryOf(any, BASE).rows, "Run").items)).toContain(
		"Special Episode 2, any floor",
	);
});

// A bare "Any" between two dots says nothing about what it is any of.
test("the Run row names what Any stands for", () => {
	const { full } = decodeFull("1-A00000000");
	const { items } = row(summaryOf(full, BASE).rows, "Run");

	expect(texts(items)).toEqual(["Auto", "Any goal", "Any episode"]);
});

test("the Run row names every goal the run aims for", () => {
	const { full } = decodeFull("1-AC0000000");
	const { items } = row(summaryOf(full, BASE).rows, "Run");

	expect(texts(items)).toEqual(["Auto", "Money + Exp + Box", "Any episode"]);
});

test("Cookies reads cookie → relay · pet as faces, named only in their titles", () => {
	const { items } = row(summaryOf(fullBuild(), BASE).rows, "Cookies");

	expect(texts(items)).toEqual([]);
	expect(images(items).map((each) => each.title)).toEqual([
		labelFor("cookies", COOKIE),
		labelFor("cookies", RELAY),
		labelFor("pets", PET),
	]);
	expect(seps(items)).toEqual(["→", "·"]);
	expect(images(items)[0]?.src).toBe(BASE + imageFor("cookies", COOKIE));

	const special = row(
		summaryOf(fullBuild({ episode: "specialExp" }), BASE).rows,
		"Cookies",
	).items;
	expect(seps(special)).toEqual(["·"]);
	expect(images(special).map((each) => each.title)).toEqual([
		labelFor("cookies", COOKIE),
		labelFor("pets", PET),
	]);
});

test("Any, which has no face, reads as its catalog label", () => {
	const full = fullBuild({}, { cookie: anyIdFor("cookies") });
	const { items } = row(summaryOf(full, BASE).rows, "Cookies");

	expect(texts(items)[0]).toBe("Any cookie");
	expect(images(items)[0]?.src).toBe(null);
});

test("a treasure slot shows its first pick, +N for alternatives, and levels only when not +0", () => {
	const full = fullBuild(
		{},
		{
			treasures: [
				[
					treasurePick(TA, levelRange(3, 9)),
					treasurePick(TB, levelRange(5, 9)),
				],
				[treasurePick(TC)],
			],
		},
	);
	const [first, second] = images(
		row(summaryOf(full, BASE).rows, "Treasures").items,
	);

	expect(first?.src).toBe(BASE + imageFor("treasures", TA));
	expect(first?.badge).toBe("+1");
	expect(first?.note).toBe("+3–9");
	expect(first?.title).toContain(" or ");
	expect(first?.title).toBe(
		`${labelFor("treasures", TA)} +3–9 or ${labelFor("treasures", TB)} +5–9`,
	);
	expect(second?.badge).toBeUndefined();
	expect(second?.note).toBeUndefined();
});

// An evolved treasure and the blessed one beside it wear one picture, so the
// kind is the only thing on screen that tells them apart.
test("a treasure's kind rides on its picture, and a base one carries none", () => {
	const kinds = index.treasures as Record<string, { type?: string }>;
	const of = (type: string) =>
		Object.keys(kinds).find((id) => kinds[id]?.type === type) ?? "";
	const full = fullBuild(
		{},
		{
			treasures: [
				[treasurePick(of("E"))],
				[treasurePick(of("B"))],
				[treasurePick(of("N"))],
			],
		},
	);
	const pictures = images(row(summaryOf(full, BASE).rows, "Treasures").items);

	expect(pictures.map((each) => each.mark)).toEqual([
		"evolved",
		"blessed",
		undefined,
	]);
});

test("exact order puts → between slots and an exact order tag", () => {
	const full = fullBuild({}, { ordered: true });
	const { items } = row(summaryOf(full, BASE).rows, "Treasures");

	expect(seps(items)).toEqual(["→"]);
	expect(items.at(-1)).toEqual({ kind: "tag", text: "exact order" });

	const loose = row(summaryOf(fullBuild(), BASE).rows, "Treasures").items;
	expect(seps(loose)).toEqual([]);
	expect(loose.some((item) => item.kind === "tag")).toBe(false);
});

test("a treasure with no picture is named rather than left blank", () => {
	const bare = Object.entries(
		index.treasures as Record<string, { image?: string | null }>,
	).find(([, entry]) => !entry.image)?.[0];
	if (bare === undefined) throw new Error("every treasure has a picture");
	const full = fullBuild(
		{},
		{
			treasures: [[treasurePick(bare, levelRange(3, 9)), treasurePick(TA)]],
		},
	);
	const [picture] = images(row(summaryOf(full, BASE).rows, "Treasures").items);

	expect(picture?.src).toBe(null);
	expect(picture?.text).toBe(labelFor("treasures", bare));
	expect(picture?.badge).toBe("+1");
	expect(picture?.note).toBe("+3–9");
});

test("empty rows are left out and the hint shows for a bare build", () => {
	const bare = summaryOf(decodeFull("1-0S0000000").full, BASE);

	expect(bare.rows.map((each) => each.label)).toEqual(["Run"]);
	expect(bare.hint).toBe(
		"Nothing else picked yet. Choose a cookie, boosts or treasures in the tabs below.",
	);
	expect(HINT).toBe(bare.hint ?? "");

	expect(summaryOf(fullBuild(), BASE).hint).toBe(null);
	// A cookie alone is enough to say something has been picked.
	const cookie = fullBuild(
		{ boosts: [], randomBoost: null, cookiePowers: [] },
		{ relay: null, pet: null, treasures: [] },
	);
	expect(summaryOf(cookie, BASE).hint).toBe(null);
});

test("a special episode leaves out the boost rows and an Exp episode the treasures row", () => {
	expect(
		summaryOf(fullBuild({ episode: "special1" }), BASE).rows.map(
			(each) => each.label,
		),
	).toEqual(["Run", "Cookies", "Treasures"]);
	expect(
		summaryOf(fullBuild({ episode: "specialExp" }), BASE).rows.map(
			(each) => each.label,
		),
	).toEqual(["Run", "Cookies"]);
});

test("Power+ shows at most two faces, named only in their title", () => {
	const full = fullBuild({ cookiePowers: ["fairy", "expParty"] });
	const { items } = row(summaryOf(full, BASE).rows, "Power+");
	const stacks = items.flatMap((item) => (item.kind === "stack" ? [item] : []));

	expect(items.every((item) => item.kind === "stack")).toBe(true);
	expect(stacks.map((each) => each.text)).toEqual([undefined, undefined]);
	expect(stacks.map((each) => each.title)).toEqual(["Fairy", "EXP Party"]);
	expect(stacks[0]?.srcs).toEqual(cookiePowerArt("fairy", BASE));
	expect(stacks[1]?.srcs.length).toBe(2);
});

test("Boosts are icons alone, named in their title", () => {
	const { items } = row(summaryOf(fullBuild(), BASE).rows, "Boosts");

	expect(items.every((item) => item.kind === "image")).toBe(true);
	expect(items.map((item) => item.kind === "image" && item.text)).toEqual([
		undefined,
		undefined,
	]);
	expect(items.map((item) => item.kind === "image" && item.title)).toEqual([
		"HP Extension",
		"Power Jelly Boost",
	]);
	expect(
		items.every((item) => item.kind === "image" && item.src !== null),
	).toBe(true);
});

// A phone has no hover, so a title alone would hide every name from it.
test("each picture in the rows has its name as a caption", () => {
	const { rows } = summaryOf(fullBuild(), BASE);
	const captions = (label: string) =>
		row(rows, label).items.flatMap((item) =>
			item.kind === "image" || item.kind === "stack" ? [item.caption] : [],
		);

	expect(captions("Cookies")).toEqual([
		labelFor("cookies", COOKIE),
		labelFor("cookies", RELAY),
		labelFor("pets", PET),
	]);
	expect(captions("Treasures")).toEqual([
		labelFor("treasures", TA),
		labelFor("treasures", TB),
	]);
	expect(captions("Boosts")).toEqual(["HP Extension", "Power Jelly Boost"]);
	expect(captions("Power+")).toEqual(["Fairy", "Sea Fairy"]);
});

test("the one-line compact view carries no captions", () => {
	const { compact } = summaryOf(fullBuild(), BASE);

	expect(
		compact.some(
			(item) =>
				(item.kind === "image" || item.kind === "stack") &&
				item.caption !== undefined,
		),
	).toBe(false);
});

test("compact carries the mode pill, goal, episode icon, faces and the boost count", () => {
	const full = fullBuild();
	const { compact } = summaryOf(full, BASE);

	expect(compact[0]).toEqual({ kind: "pill", text: "Semi-auto", tone: "semi" });
	expect(texts(compact)).toContain("Money");
	const srcs = images(compact).map((each) => each.src);
	expect(srcs).toContain(episodeArt("episode3", BASE));
	expect(srcs).toContain(BASE + imageFor("cookies", COOKIE));
	expect(srcs).toContain(BASE + imageFor("cookies", RELAY));
	expect(srcs).toContain(BASE + imageFor("pets", PET));
	expect(srcs).toContain(BASE + imageFor("treasures", TA));
	// The count comes before the pictures: on a narrow phone the line clips
	// at its end, and a picture is the thing to lose, not the count.
	const words = texts(compact);
	expect(words.indexOf("5 boosts")).toBeGreaterThan(words.indexOf("Money"));
	expect(
		compact.findIndex(
			(each) => each.kind === "text" && each.text === "5 boosts",
		),
	).toBeLessThan(
		compact.findIndex(
			(each) =>
				each.kind === "image" &&
				each.src === BASE + imageFor("cookies", COOKIE),
		),
	);
});

test("the one-line view drops a treasure's level note", () => {
	const full = fullBuild(
		{},
		{ treasures: [[treasurePick(TA, levelRange(3, 9)), treasurePick(TB)]] },
	);
	const { compact } = summaryOf(full, BASE);
	const treasure = images(compact).find(
		(each) => each.src === BASE + imageFor("treasures", TA),
	);

	expect(treasure).toBeDefined();
	expect(treasure?.note).toBeUndefined();
	expect(treasure?.badge).toBe("+1");
});
