/**
 * What a saved run brought home, beside the note: the money and exp it earned,
 * the boxes it opened, and how long it lasted. A run varies, so the first
 * three may be a range; time is one number of seconds.
 *
 * None of it is part of the code. It belongs to a saved entry, travels in a
 * shared link's query and in the exported text, and like everything else read
 * back from either, a value that is not well formed is dropped on the way in.
 */

export interface StatRange {
	readonly min: number;
	readonly max: number;
}

export interface RunStats {
	readonly money?: StatRange;
	readonly exp?: StatRange;
	readonly boxes?: StatRange;
	/** Seconds. */
	readonly time?: number;
}

export type StatField = keyof RunStats;

/** The order stats are shown, linked and exported in. */
export const STAT_FIELDS: readonly StatField[] = [
	"money",
	"exp",
	"boxes",
	"time",
];

export const STAT_LABELS: Readonly<Record<StatField, string>> = {
	money: "Money",
	exp: "Exp",
	boxes: "Boxes",
	time: "Time",
};

export type StatValue<F extends StatField> = NonNullable<RunStats[F]>;

/** Stats being put together, a field at a time. */
export type StatsDraft = { -readonly [K in StatField]?: RunStats[K] };

/** Sets one field; `null`, a blank stat, leaves it unset. */
export function putStat<F extends StatField>(
	stats: StatsDraft,
	field: F,
	value: StatValue<F> | null,
): void {
	if (value === null) delete stats[field];
	else stats[field] = value;
}

const LIMITS: Readonly<
	Record<StatField, { min: number; max: number; range: boolean; takes: string }>
> = {
	money: {
		min: 1,
		max: Number.MAX_SAFE_INTEGER,
		range: true,
		takes: "a positive whole number, or a range like 12000-15000",
	},
	exp: {
		min: 1,
		max: Number.MAX_SAFE_INTEGER,
		range: true,
		takes: "a positive whole number, or a range like 300-450",
	},
	boxes: { min: 0, max: 5, range: true, takes: "0 to 5, or a range like 2-4" },
	time: {
		min: 1,
		max: Number.MAX_SAFE_INTEGER,
		range: false,
		takes: "seconds, as a positive whole number",
	},
};

function inLimits(field: StatField, value: number): boolean {
	const limits = LIMITS[field];
	return (
		Number.isSafeInteger(value) && value >= limits.min && value <= limits.max
	);
}

function isRange(field: StatField, value: unknown): value is StatRange {
	if (typeof value !== "object" || value === null) return false;
	const range = value as { min?: unknown; max?: unknown };
	return (
		typeof range.min === "number" &&
		typeof range.max === "number" &&
		inLimits(field, range.min) &&
		inLimits(field, range.max) &&
		range.min <= range.max
	);
}

/** One whole number as people type it: digits, maybe grouped with commas. */
function wholeNumber(text: string): number | null {
	const digits = text.replace(/[,\s]/g, "");
	return /^\d+$/.test(digits) ? Number(digits) : null;
}

export type StatResult<F extends StatField> =
	| { ok: true; value: StatValue<F> | null }
	| { ok: false; error: string };

/**
 * Reads what someone typed for one stat. Blank is no stat. A range may use a
 * hyphen, an en dash or a tilde, and one written high to low is turned round.
 */
export function parseStat<F extends StatField>(
	field: F,
	text: string,
): StatResult<F> {
	const trimmed = text.trim();
	if (trimmed === "") return { ok: true, value: null };
	const limits = LIMITS[field];
	const refused = {
		ok: false as const,
		error: `${STAT_LABELS[field]} takes ${limits.takes}.`,
	};

	const parts = trimmed.split(/[-–~]/);
	if (parts.length > 2 || (parts.length === 2 && !limits.range)) return refused;
	const numbers = parts.map(wholeNumber);
	if (numbers.some((n) => n === null || !inLimits(field, n))) return refused;
	const [a = 0, b = a] = numbers as number[];

	const value = limits.range ? { min: Math.min(a, b), max: Math.max(a, b) } : a;
	return { ok: true, value: value as StatValue<F> };
}

/** A stat the way someone would type it, which is also how it travels. */
export function formatStat(value: StatRange | number): string {
	if (typeof value === "number") return String(value);
	return value.min === value.max
		? String(value.min)
		: `${value.min}-${value.max}`;
}

/** Stats read back from storage, keeping only the fields that are well formed. */
export function readStats(value: unknown): RunStats {
	if (typeof value !== "object" || value === null) return {};
	const raw = value as { [K in StatField]?: unknown };
	const stats: StatsDraft = {};
	for (const field of ["money", "exp", "boxes"] as const) {
		const range = raw[field];
		if (isRange(field, range)) {
			stats[field] = { min: range.min, max: range.max };
		}
	}
	if (typeof raw.time === "number" && inLimits("time", raw.time)) {
		stats.time = raw.time;
	}
	return stats;
}

export function isEmptyStats(stats: RunStats): boolean {
	return STAT_FIELDS.every((field) => stats[field] === undefined);
}

const grouped = new Intl.NumberFormat("en-US");

/** The stats as one line for the saved list, or "" when there are none. */
export function statsSentence(stats: RunStats): string {
	return STAT_FIELDS.flatMap((field) => {
		const value = stats[field];
		if (value === undefined) return [];
		if (typeof value === "number") {
			return [`${STAT_LABELS[field]} ${grouped.format(value)}s`];
		}
		const { min, max } = value;
		const shown =
			min === max
				? grouped.format(min)
				: `${grouped.format(min)}–${grouped.format(max)}`;
		return [`${STAT_LABELS[field]} ${shown}`];
	}).join(" · ");
}
