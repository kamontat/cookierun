import { expect, test } from "bun:test";

import type { Combi } from "./codec.ts";
import { combiSectionOf, decodeFull, encodeFull } from "./full-code.ts";
import { emptyLoadout, type Loadout } from "./loadout.ts";

const combi: Combi = {
	type: "score",
	episode: "any",
	boosts: [],
	randomBoost: null,
	cookiePowers: [],
	action: "none",
};

function loadout(over: Partial<Loadout> = {}): Loadout {
	return { ...emptyLoadout(), ...over };
}

test("an empty loadout writes the bare ten-character code", () => {
	expect(encodeFull({ loadout: emptyLoadout(), combi })).toBe("1S0---000-");
});

test("a loadout is written before the combi, separated by a dot", () => {
	expect(
		encodeFull({
			loadout: loadout({ cookie: "00", treasures: [["000"]] }),
			combi,
		}),
	).toBe("1C00TU000.1S0---000-");
});

// Every code that worked before this feature has to keep working.
test("a bare code decodes with an empty loadout and the same combi", () => {
	const { full, warnings } = decodeFull("1E3-PF400J");

	expect(full.loadout).toEqual(emptyLoadout());
	expect(full.combi.type).toBe("exp");
	expect(full.combi.boosts).toEqual(["powerJellyBoost", "fastStart"]);
	expect(full.combi.randomBoost).toBe("revive");
	expect(full.combi.action).toBe("jumpAtStart");
	expect(warnings).toEqual([]);
});

test("both sections decode together", () => {
	const { full } = decodeFull("1C00P02TU000.1S0HPF014-");

	expect(full.loadout.cookie).toBe("00");
	expect(full.loadout.pet).toBe("02");
	expect(full.loadout.treasures).toEqual([["000"]]);
	expect(full.combi.cookiePowers).toEqual(["fairy", "seaFairy"]);
});

test("the combi section's soft warning survives the join", () => {
	const { warnings } = decodeFull("1C00.1A3H-F400-");

	expect(warnings).toHaveLength(1);
	expect(warnings[0]).toContain("slot 2 says Auto");
});

test("a second dot is refused", () => {
	expect(() => decodeFull("1C00.1S0---000-.x")).toThrow(
		'a code holds at most one ".", got 2',
	);
});

test("an unreadable combi section still throws from the combi codec", () => {
	expect(() => decodeFull("1C00.1S0---000")).toThrow(
		"code must be exactly 10 characters",
	);
});

test("combiSectionOf picks the right half, or the whole code", () => {
	expect(combiSectionOf("1C00.1S0---000-")).toBe("1S0---000-");
	expect(combiSectionOf("1S0---000-")).toBe("1S0---000-");
	expect(combiSectionOf("1C0")).toBe("1C0");
});

// The loadout space is unbounded once alternatives exist, so the round trip is
// covered by a seeded sample rather than exhaustively.
test("a seeded sample of loadouts round-trips to its canonical form", () => {
	let seed = 20260912;
	const random = (bound: number): number => {
		seed = (seed * 1103515245 + 12345) % 2147483648;
		return seed % bound;
	};

	const cookieIds = ["00", "01", "2L"];
	const petIds = ["00", "02", "2U"];
	const treasureIds = ["000", "001", "0FZ", "0QQ", "0VR"];
	const pick = <T>(from: T[]): T => from[random(from.length)] as T;

	for (let run = 0; run < 2000; run++) {
		const slots: string[][] = [];
		for (let slot = 0; slot < random(4); slot++) {
			const ids = new Set<string>();
			for (let alt = 0; alt <= random(3); alt++) ids.add(pick(treasureIds));
			slots.push([...ids]);
		}

		const full = {
			loadout: {
				cookie: random(2) === 0 ? null : pick(cookieIds),
				relay: random(2) === 0 ? null : pick(cookieIds),
				pet: random(2) === 0 ? null : pick(petIds),
				treasures: slots,
				ordered: random(2) === 0,
			},
			combi,
		};

		const code = encodeFull(full);
		expect(encodeFull(decodeFull(code).full)).toBe(code);

		// One build, one code: a build is the same build whichever order its
		// slots arrive in, so an unordered loadout must survive a shuffle.
		if (!full.loadout.ordered && slots.length > 1) {
			const shuffled = {
				loadout: { ...full.loadout, treasures: [...slots].reverse() },
				combi,
			};
			expect(encodeFull(shuffled)).toBe(code);
		}
	}
});
