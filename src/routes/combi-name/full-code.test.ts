import { expect, test } from "bun:test";

import type { Combi } from "./codec";
import {
	combiSectionOf,
	decodeFull,
	encodeFull,
	isSemiAutoBuild,
} from "./full-code";
import { emptyLoadout, type Loadout } from "./loadout";

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
	expect(encodeFull({ loadout: emptyLoadout(), combi })).toBe("1S00--000-");
});

test("a loadout is written before the combi, separated by a dot", () => {
	expect(
		encodeFull({
			loadout: loadout({ cookie: "00", treasures: [["000"]] }),
			combi,
		}),
	).toBe("1C00TU000.1S00--000-");
});

// Every code that worked before this feature has to keep working.
test("a bare code decodes with an empty loadout and the same combi", () => {
	const { full, warnings } = decodeFull("1E36--400J");

	expect(full.loadout).toEqual(emptyLoadout());
	expect(full.combi.type).toBe("exp");
	expect(full.combi.boosts).toEqual(["powerJellyBoost", "fastStart"]);
	expect(full.combi.randomBoost).toBe("revive");
	expect(full.combi.action).toBe("jumpAtStart");
	expect(warnings).toEqual([]);
});

test("both sections decode together", () => {
	const { full } = decodeFull("1C00P02TU000.1S07--014-");

	expect(full.loadout.cookie).toBe("00");
	expect(full.loadout.pet).toBe("02");
	expect(full.loadout.treasures).toEqual([["000"]]);
	expect(full.combi.cookiePowers).toEqual(["fairy", "seaFairy"]);
});

test("the combi section's soft warning survives the join", () => {
	const { warnings } = decodeFull("1C00.1A35--400-");

	expect(warnings).toHaveLength(1);
	expect(warnings[0]).toContain("slot 2 says Auto");
});

test("a second dot is refused", () => {
	expect(() => decodeFull("1C00.1S00--000-.x")).toThrow(
		'a code holds at most one ".", got 2',
	);
});

test("an unreadable combi section still throws from the combi codec", () => {
	expect(() => decodeFull("1C00.1S00--000")).toThrow(
		"code must be exactly 10 characters",
	);
});

test("combiSectionOf picks the right half, or the whole code", () => {
	expect(combiSectionOf("1C00.1S00--000-")).toBe("1S00--000-");
	expect(combiSectionOf("1S00--000-")).toBe("1S00--000-");
	expect(combiSectionOf("1C0")).toBe("1C0");
});

// The loadout space is unbounded once alternatives exist, so the round trip is
// covered by a seeded sample rather than exhaustively.
test("a seeded sample of loadouts round-trips to its canonical form", () => {
	// mulberry32: every step stays in 32-bit range. The obvious LCG
	// (`seed * 1103515245 + 12345`) overflows 2^53 and degenerates into a
	// generator that returns 0 almost always — which silently emptied this loop.
	let seed = 20260912;
	const random = (bound: number): number => {
		seed = (seed + 0x6d2b79f5) >>> 0;
		let t = seed;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) % bound;
	};

	const cookieIds = ["00", "01", "2L"];
	const petIds = ["00", "02", "2U"];
	const treasureIds = ["000", "001", "0FZ", "0QQ", "0VR"];
	const pick = <T>(from: T[]): T => from[random(from.length)] as T;

	let shuffles = 0;
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
			shuffles++;
			const shuffled = {
				loadout: { ...full.loadout, treasures: [...slots].reverse() },
				combi,
			};
			expect(encodeFull(shuffled)).toBe(code);
		}
	}

	// Without this, a generator that stops producing multi-slot loadouts would
	// empty the shuffle check and the suite would still report green.
	expect(shuffles).toBeGreaterThan(100);
});

// A relay cookie is swapped in by hand, so a run carrying one never plays
// itself through — and the ten characters someone pastes into the game say so.
test("a relay writes Semi-auto into slot 2", () => {
	const auto: Combi = {
		type: "auto",
		episode: "any",
		boosts: [],
		randomBoost: null,
		cookiePowers: [],
		action: "none",
	};

	expect(
		encodeFull({ loadout: { ...emptyLoadout(), relay: "0O" }, combi: auto }),
	).toBe("1R0O.1H00--000-");
	// The combi half on its own knows nothing about a relay and never did.
	expect(encodeFull({ loadout: emptyLoadout(), combi: auto })).toBe(
		"1A00--000-",
	);
});

test("a build is semi-auto when the loadout carries a relay", () => {
	const auto: Combi = {
		type: "auto",
		episode: "any",
		boosts: [],
		randomBoost: null,
		cookiePowers: [],
		action: "none",
	};

	expect(
		isSemiAutoBuild({
			loadout: { ...emptyLoadout(), relay: "0O" },
			combi: auto,
		}),
	).toBe(true);
	expect(isSemiAutoBuild({ loadout: emptyLoadout(), combi: auto })).toBe(false);
});

// Hand-typed codes are allowed to contradict themselves; the relay wins, and
// re-encoding snaps the slot back.
test("a code saying Auto beside a relay warns rather than refusing", () => {
	const { full, warnings } = decodeFull("1R0O.1A00--000-");

	expect(full.combi.type).toBe("auto");
	expect(warnings).toEqual([
		"slot 2 says Auto but the loadout carries a relay cookie — treating as Semi-auto",
	]);
	expect(encodeFull(full)).toBe("1R0O.1H00--000-");
});

// The codec's own contradiction warning does not fire for an H the loadout
// explains: nothing is wrong with that code.
test("a relayed code saying Semi-auto draws no warning", () => {
	const { warnings } = decodeFull("1R0O.1H00--000-");

	expect(warnings).toEqual([]);
});
