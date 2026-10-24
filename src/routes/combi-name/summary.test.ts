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
		goal: "money",
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
	const { full } = decodeFull("10M3000000");
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
	const { full } = decodeFull("1A00000000");
	const { items } = row(summaryOf(full, BASE).rows, "Run");

	expect(texts(items)).toEqual(["Auto", "Any goal", "Any episode"]);
});

test("Cookies reads cookie → relay · pet, and drops the relay where the episode takes none", () => {
	const { items } = row(summaryOf(fullBuild(), BASE).rows, "Cookies");

	expect(texts(items)).toEqual([
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
	expect(texts(special)).toEqual([
		labelFor("cookies", COOKIE),
		labelFor("pets", PET),
	]);
});

test("Any reads as its catalog label", () => {
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

test("exact order puts → between slots and an exact order tag", () => {
	const full = fullBuild({}, { ordered: true });
	const { items } = row(summaryOf(full, BASE).rows, "Treasures");

	expect(seps(items)).toEqual(["→"]);
	expect(items.at(-1)).toEqual({ kind: "tag", text: "exact order" });

	const loose = row(summaryOf(fullBuild(), BASE).rows, "Treasures").items;
	expect(seps(loose)).toEqual([]);
	expect(loose.some((item) => item.kind === "tag")).toBe(false);
});

test("a hidden treasure still has its picture and name", () => {
	const hidden = Object.entries(
		index.treasures as Record<string, { family?: string }>,
	).find(([, entry]) => entry.family === "consumable")?.[0];
	if (hidden === undefined) throw new Error("no consumable treasure");
	const full = fullBuild({}, { treasures: [[treasurePick(hidden)]] });
	const [picture] = images(row(summaryOf(full, BASE).rows, "Treasures").items);

	expect(picture?.src?.endsWith(imageFor("treasures", hidden) ?? "-")).toBe(
		true,
	);
	expect(picture?.title).toContain(labelFor("treasures", hidden));
});

test("empty rows are left out and the hint shows for a bare build", () => {
	const bare = summaryOf(decodeFull("10S0000000").full, BASE);

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

test("Power+ shows at most two faces and drops the trailing Cookie", () => {
	const full = fullBuild({ cookiePowers: ["fairy", "expParty"] });
	const { items } = row(summaryOf(full, BASE).rows, "Power+");
	const stacks = items.flatMap((item) => (item.kind === "stack" ? [item] : []));

	expect(stacks.map((each) => each.text)).toEqual(["Fairy", "EXP Party"]);
	expect(stacks[0]?.srcs).toEqual(cookiePowerArt("fairy", BASE));
	expect(stacks[1]?.srcs.length).toBe(2);
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
	expect(texts(compact).at(-1)).toBe("5 boosts");
});
