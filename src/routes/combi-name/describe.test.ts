import { expect, test } from "bun:test";

import type { Combi } from "./codec";
import { describeCombi, describeFull, describeLoadout } from "./describe";
import { emptyLoadout } from "./loadout";

const base: Combi = {
	type: "score",
	episode: "episode3",
	boosts: [],
	randomBoost: null,
	cookiePowers: [],
	action: "none",
};

test("describes all six fields, using None for empty selections", () => {
	expect(describeCombi(base).rows).toEqual([
		{ field: "Type", value: "Score" },
		{ field: "Episode", value: "Episode 3" },
		{ field: "Boosts", value: "None" },
		{ field: "Random boost", value: "None" },
		{ field: "Cookie power+", value: "None" },
		{ field: "Action", value: "No action" },
	]);
});

test("joins multiple boosts and cookie powers in slot order", () => {
	const { rows } = describeCombi({
		...base,
		boosts: ["hpExtension", "fastStart"],
		cookiePowers: ["fairy", "expParty"],
	});

	expect(rows[2]).toEqual({
		field: "Boosts",
		value: "HP Extension, Fast Start",
	});
	expect(rows[4]).toEqual({
		field: "Cookie power+",
		value: "Fairy Cookie, EXP Party",
	});
});

test("no auto verdict for a type that is played by hand", () => {
	expect(describeCombi(base).auto).toBeNull();
});

test("a full auto combi gets a verdict with no reasons", () => {
	expect(describeCombi({ ...base, type: "auto" }).auto).toEqual({
		semi: false,
		reasons: [],
	});
});

test("a semi-auto verdict names every reason it needs manual work", () => {
	const { auto } = describeCombi({
		...base,
		type: "auto",
		boosts: ["hpExtension", "fastStart"],
		randomBoost: "revive",
		action: "jumpAtStart",
	});

	expect(auto).toEqual({
		semi: true,
		reasons: ["Fast Start", "Revive once with 80 HP", "Jump at start"],
	});
});

test("an empty loadout reads as four None rows", () => {
	expect(describeLoadout(emptyLoadout())).toEqual([
		{ field: "Cookie", value: "None" },
		{ field: "Relay", value: "None" },
		{ field: "Pet", value: "None" },
		{ field: "Treasures", value: "None" },
	]);
});

test("a picked cookie, relay and pet read as their names", () => {
	const rows = describeLoadout({
		...emptyLoadout(),
		cookie: "00",
		relay: "01",
		pet: "00",
	});

	// The relay is a second cookie, not its own list. Id "01" names
	// GingerBright among cookies and Cheese Drop among pets, so this assertion
	// is what fails if the relay is ever read from the wrong catalog.
	expect(rows[0]).toEqual({ field: "Cookie", value: "GingerBrave" });
	expect(rows[1]).toEqual({ field: "Relay", value: "GingerBright" });
	expect(rows[2]).toEqual({ field: "Pet", value: "Choco Drop" });
});

// Pet ids 0J, 0K and 2L are all named "Sotdae Flock". A reader told only the
// name cannot tell which cookie the code means.
test("a shared display name reads with the id that tells it apart", () => {
	const rows = describeLoadout({ ...emptyLoadout(), pet: "0J" });

	expect(rows[2]).toEqual({ field: "Pet", value: "Sotdae Flock [0J]" });
});

test("alternatives read as or, and slots as a numbered list when order matters", () => {
	const unordered = describeLoadout({
		...emptyLoadout(),
		treasures: [["000", "001"], ["002"]],
		ordered: false,
	});
	expect(unordered[3]?.field).toBe("Treasures");
	expect(unordered[3]?.value).toContain(" or ");
	expect(unordered[3]?.value).toContain("; ");

	const ordered = describeLoadout({
		...emptyLoadout(),
		treasures: [["000"], ["001"]],
		ordered: true,
	});
	expect(ordered[3]?.field).toBe("Treasures (exact order)");
	expect(ordered[3]?.value.startsWith("1. ")).toBe(true);
});

// One slot has nothing to order, so the label must not claim otherwise.
test("a single treasure slot never reads as exact order", () => {
	const rows = describeLoadout({
		...emptyLoadout(),
		treasures: [["000"]],
		ordered: true,
	});

	expect(rows[3]?.field).toBe("Treasures");
});

test("the loadout rows come before the combi rows", () => {
	const { rows } = describeFull({
		loadout: { ...emptyLoadout(), cookie: "00" },
		combi: {
			type: "score",
			episode: "any",
			boosts: [],
			randomBoost: null,
			cookiePowers: [],
			action: "none",
		},
	});

	expect(rows.map(({ field }) => field)).toEqual([
		"Cookie",
		"Relay",
		"Pet",
		"Treasures",
		"Type",
		"Episode",
		"Boosts",
		"Random boost",
		"Cookie power+",
		"Action",
	]);
});
