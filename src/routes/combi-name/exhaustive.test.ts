import { expect, test } from "bun:test";

import {
	ALL_ACTIONS,
	ALL_BOOSTS,
	ALL_COOKIE_POWERS,
	ALL_EPISODES,
	ALL_GOALS,
	ALL_MODES,
	ALL_RANDOM_BOOSTS,
	type Boost,
	CODE_LENGTH,
	type Combi,
	type CookiePower,
	decode,
	encode,
	type Goal,
	limitsOf,
	normalize,
	type RandomBoost,
} from "./codec";

function subset<T>(values: readonly T[], mask: number): T[] {
	return values.filter((_, index) => (mask & (1 << index)) !== 0);
}

const FLOORS = [null, ...Array.from({ length: 100 }, (_, index) => index + 1)];

/**
 * Every combi a code can carry, in table-declaration order. What an episode has
 * no room for is not varied there — `normalize` would only drop it again, and
 * the codec tests cover that it does.
 */
function* everyCombi(): Generator<Combi> {
	const randomBoosts: (RandomBoost | null)[] = [null, ...ALL_RANDOM_BOOSTS];
	const boostSubsets: Boost[][] = Array.from(
		{ length: 1 << ALL_BOOSTS.length },
		(_, mask) => subset(ALL_BOOSTS, mask),
	);
	const goalSubsets: Goal[][] = Array.from(
		{ length: 1 << ALL_GOALS.length },
		(_, mask) => subset(ALL_GOALS, mask),
	);
	const cookieSubsets: CookiePower[][] = Array.from(
		{ length: 1 << ALL_COOKIE_POWERS.length },
		(_, mask) => subset(ALL_COOKIE_POWERS, mask),
	);

	for (const goals of goalSubsets) {
		for (const mode of ALL_MODES) {
			for (const episode of ALL_EPISODES) {
				const limits = limitsOf(episode);
				const floors = limits.floor ? FLOORS : [null];
				const boostSets = limits.boosts ? boostSubsets : [[]];
				const randoms = limits.boosts ? randomBoosts : [null];
				const cookieSets = limits.boosts ? cookieSubsets : [[]];

				for (const floor of floors) {
					for (const boosts of boostSets) {
						for (const randomBoost of randoms) {
							for (const cookiePowers of cookieSets) {
								for (const action of ALL_ACTIONS) {
									yield {
										goals,
										mode,
										episode,
										floor,
										boosts,
										randomBoost,
										cookiePowers,
										action,
									};
								}
							}
						}
					}
				}
			}
		}
	}
}

const CODE_PATTERN = /^[0-9A-Z]{9}$/;

/**
 * Both tests below walk the whole configuration space, so their runtime is the
 * size of the format rather than anything about the machine. Bun's 5s default
 * was already close when the space was half this size, and a CI runner is
 * slower than a laptop — the explicit budget is what keeps a growing format
 * from reading as a flaky test.
 */
const WHOLE_SPACE_TIMEOUT = 300_000;

test(
	"every combi round-trips through a 10-character code",
	() => {
		const failures: string[] = [];
		let checked = 0;

		for (const combi of everyCombi()) {
			checked++;
			const code = encode(combi);

			if (code.length !== CODE_LENGTH || !CODE_PATTERN.test(code)) {
				failures.push(`${JSON.stringify(combi)} produced bad code "${code}"`);
				continue;
			}

			const { combi: back } = decode(code);
			const expected = normalize(combi);

			// The mode is derived, so it is the one field allowed to come back
			// different: re-encoding is what proves it came back right.
			const same =
				back.goals.join() === expected.goals.join() &&
				back.episode === expected.episode &&
				back.floor === expected.floor &&
				back.randomBoost === expected.randomBoost &&
				back.action === expected.action &&
				back.boosts.join() === expected.boosts.join() &&
				back.cookiePowers.join() === expected.cookiePowers.join() &&
				encode(back) === code;

			if (!same) {
				failures.push(
					`${code} decoded to ${JSON.stringify(back)}, expected ${JSON.stringify(combi)}`,
				);
			}

			if (failures.length >= 5) break;
		}

		expect(failures).toEqual([]);
		// Nine ordinary episodes carry everything; the tower carries a floor; the
		// other two special episodes carry neither.
		const perGoalAndMode = 9 * 16 * 12 * 128 * 2 + 101 * 2 + 2 * 2;
		expect(checked).toBe(16 * 3 * perGoalAndMode);
	},
	WHOLE_SPACE_TIMEOUT,
);

test(
	"codes are unique but for the two derived collapses",
	() => {
		const codes = new Set<string>();
		for (const combi of everyCombi()) codes.add(encode(combi));

		// Auto and semi-auto are one family, since that char is derived; and a
		// manual run drops its action, so its two actions are one code.
		const carried = 9 * 16 * 12 * 128 + 101 + 2;
		expect(codes.size).toBe(16 * (carried + carried * 2));
	},
	WHOLE_SPACE_TIMEOUT,
);
