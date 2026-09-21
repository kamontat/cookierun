import { expect, test } from "bun:test";

import {
	ALL_ACTIONS,
	ALL_BOOSTS,
	ALL_COOKIE_POWERS,
	ALL_EPISODES,
	ALL_RANDOM_BOOSTS,
	ALL_TYPES,
	type Boost,
	CODE_LENGTH,
	type Combi,
	type CookiePower,
	decode,
	encode,
	type RandomBoost,
} from "./codec.ts";

function subset<T>(values: readonly T[], mask: number): T[] {
	return values.filter((_, index) => (mask & (1 << index)) !== 0);
}

/** Every combi the type system allows, in table-declaration order. */
function* everyCombi(): Generator<Combi> {
	const randomBoosts: (RandomBoost | null)[] = [null, ...ALL_RANDOM_BOOSTS];
	const boostSubsets: Boost[][] = Array.from(
		{ length: 1 << ALL_BOOSTS.length },
		(_, mask) => subset(ALL_BOOSTS, mask),
	);
	const cookieSubsets: CookiePower[][] = Array.from(
		{ length: 1 << ALL_COOKIE_POWERS.length },
		(_, mask) => subset(ALL_COOKIE_POWERS, mask),
	);

	for (const type of ALL_TYPES) {
		for (const episode of ALL_EPISODES) {
			for (const boosts of boostSubsets) {
				for (const randomBoost of randomBoosts) {
					for (const cookiePowers of cookieSubsets) {
						for (const action of ALL_ACTIONS) {
							yield {
								type,
								episode,
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

const CODE_PATTERN = /^[0-9A-Z-]{10}$/;

test("every combi round-trips through a 10-character code", () => {
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

		const same =
			back.episode === combi.episode &&
			back.randomBoost === combi.randomBoost &&
			back.action === combi.action &&
			back.boosts.join() === combi.boosts.join() &&
			back.cookiePowers.join() === combi.cookiePowers.join() &&
			encode(back) === code;

		if (!same) {
			failures.push(
				`${code} decoded to ${JSON.stringify(back)}, expected ${JSON.stringify(combi)}`,
			);
		}

		if (failures.length >= 5) break;
	}

	expect(failures).toEqual([]);
	expect(checked).toBe(6 * 12 * 8 * 12 * 128 * 2);
});

test("codes are unique — the auto family is the only collapse", () => {
	const codes = new Set<string>();
	for (const combi of everyCombi()) codes.add(encode(combi));

	// 4 manual types + 1 auto family, since the auto/semi char is derived.
	expect(codes.size).toBe(5 * 12 * 8 * 12 * 128 * 2);
});
