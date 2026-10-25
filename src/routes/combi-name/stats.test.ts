import { expect, test } from "bun:test";

import {
	formatStat,
	isEmptyStats,
	parseStat,
	readStats,
	STAT_FIELDS,
	statsSentence,
} from "./stats";

test("a stat is a whole number or a range of them", () => {
	expect(parseStat("money", "12000")).toEqual({
		ok: true,
		value: { min: 12000, max: 12000 },
	});
	expect(parseStat("money", " 12,000 - 15,000 ")).toEqual({
		ok: true,
		value: { min: 12000, max: 15000 },
	});
	expect(parseStat("exp", "300–450")).toEqual({
		ok: true,
		value: { min: 300, max: 450 },
	});
});

test("a blank stat is no stat", () => {
	expect(parseStat("money", "  ")).toEqual({ ok: true, value: null });
});

test("a range written backwards is read the right way round", () => {
	expect(parseStat("boxes", "4-2")).toEqual({
		ok: true,
		value: { min: 2, max: 4 },
	});
});

test("money and exp are positive", () => {
	expect(parseStat("money", "0").ok).toBe(false);
	expect(parseStat("exp", "0-10").ok).toBe(false);
	expect(parseStat("money", "-5").ok).toBe(false);
	expect(parseStat("money", "1.5").ok).toBe(false);
	expect(parseStat("money", "lots").ok).toBe(false);
});

test("boxes run from 0 to 5", () => {
	expect(parseStat("boxes", "0")).toEqual({
		ok: true,
		value: { min: 0, max: 0 },
	});
	expect(parseStat("boxes", "0-5").ok).toBe(true);
	expect(parseStat("boxes", "6").ok).toBe(false);
	expect(parseStat("boxes", "3-6").ok).toBe(false);
});

test("time is a positive number of seconds, not a range", () => {
	expect(parseStat("time", "245")).toEqual({ ok: true, value: 245 });
	expect(parseStat("time", "0").ok).toBe(false);
	expect(parseStat("time", "200-245").ok).toBe(false);
});

test("a refused stat says what it takes", () => {
	const result = parseStat("boxes", "9");
	expect(result.ok).toBe(false);
	if (!result.ok)
		expect(result.error).toBe("Boxes takes 0 to 5, or a range like 2-4.");
});

test("a stat is written the way it is typed", () => {
	expect(formatStat({ min: 12000, max: 15000 })).toBe("12000-15000");
	expect(formatStat({ min: 300, max: 300 })).toBe("300");
	expect(formatStat(245)).toBe("245");
	for (const field of STAT_FIELDS) {
		const sample = field === "time" ? 3 : { min: 1, max: 3 };
		const parsed = parseStat(field, formatStat(sample));
		expect(parsed).toEqual({ ok: true, value: sample });
	}
});

test("stats read back from storage keep only what is well formed", () => {
	expect(
		readStats({
			money: { min: 1, max: 9 },
			exp: { min: 0, max: 9 },
			boxes: { min: 2, max: 9 },
			time: 61,
		}),
	).toEqual({ money: { min: 1, max: 9 }, time: 61 });
	expect(readStats("junk")).toEqual({});
	expect(readStats(undefined)).toEqual({});
});

test("no stats is empty", () => {
	expect(isEmptyStats({})).toBe(true);
	expect(isEmptyStats({ time: 3 })).toBe(false);
});

test("stats read as one line, in a fixed order", () => {
	expect(
		statsSentence({
			time: 245,
			boxes: { min: 2, max: 3 },
			money: { min: 12000, max: 15000 },
		}),
	).toBe("Money 12,000–15,000 · Boxes 2–3 · Time 245s");
	expect(statsSentence({})).toBe("");
});
