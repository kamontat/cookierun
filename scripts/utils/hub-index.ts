/**
 * Turns the rows cookierunhub.com lists into index entries — pure, so the
 * whole mapping is testable without the network, and shared by `fetch-assets`
 * (which writes the result) and `verify-assets` (which only counts it).
 *
 * Every entry is keyed by `wireId` of the site's own number. A treasure the
 * site marks `has_blessed` yields a second entry, its blessed form, since a
 * loadout can ask for either form and the site gives the blessed one no row of
 * its own. The chain is read straight off the rows: `evolved_from_id` links an
 * evolved treasure to its base, and a blessed form's base is its unblessed
 * form's base — or that form itself, for the few that bless without evolving.
 */

import {
	type Entry,
	ID_WIDTH,
	maxHubId,
	type Section,
	TREASURE_FAMILIES,
	type TreasureEntry,
	type TreasureFamily,
	wireId,
} from "./asset-ids";
import { type HubRow, iconUrl, pageUrl } from "./cookierunhub";

export type HubEntries = {
	entries: Record<string, Entry | TreasureEntry>;
	/** Path under `assets/` → the URL it is downloaded from. */
	icons: Map<string, string>;
	/** One line per thing the rows say that this mapping cannot represent. */
	problems: string[];
};

/** A readable PascalCase handle for a display name. Nothing resolves it but `art.ts`. */
export function keyOf(name: string): string {
	return (name.match(/[A-Za-z0-9]+/g) ?? [])
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join("");
}

export function entriesFrom(section: Section, rows: HubRow[]): HubEntries {
	const entries: Record<string, Entry | TreasureEntry> = {};
	const icons = new Map<string, string>();
	const problems: string[] = [];
	const listed = new Set(rows.map((row) => row.id));

	/**
	 * An icon is filed under its section by file name alone, whichever of the
	 * site's directories serves it. Two directories offering one name would
	 * have one download overwrite the other, so that is reported instead.
	 */
	const imageOf = (row: HubRow): string | null => {
		if (row.image_path === null || row.image_path === undefined) return null;
		const local = `${section}/${fileNameOf(row.id, row.image_path)}`;
		const remote = iconUrl(row.image_path);
		const known = icons.get(local);
		if (known !== undefined && known !== remote) {
			problems.push(`${local} is served from both ${known} and ${remote}`);
		}
		icons.set(local, remote);
		return local;
	};

	for (const row of rows) {
		if (row.id < 0 || row.id > maxHubId(section)) {
			problems.push(
				`${section}/${row.id} does not fit a ${ID_WIDTH[section]}-character id (at most ${maxHubId(section)})`,
			);
			continue;
		}
		const name = row.english_name ?? `#${row.id}`;
		const entry: Entry = {
			name,
			url: pageUrl(section, row.id),
			image: imageOf(row),
			key: keyOf(name),
		};
		if (section !== "treasures") {
			entries[wireId(section, row.id)] = entry;
			continue;
		}

		const family = familyOf(row, problems);
		if (family === null) continue;

		const from = row.evolved_from_id ?? null;
		if (from !== null && !listed.has(from)) {
			problems.push(
				`treasures/${row.id} evolves from ${from}, which is not listed`,
			);
			continue;
		}
		entries[wireId(section, row.id)] =
			from === null
				? { ...entry, family, type: "N", targets: [null, null] }
				: { ...entry, family, type: "E", source: wireId(section, from) };

		if (row.has_blessed === true) {
			const blessed = row.blessed_english_name ?? `Blessed ${name}`;
			entries[wireId(section, row.id, true)] = {
				name: blessed,
				url: pageUrl(section, row.id, true),
				image: entry.image,
				family,
				type: "B",
				source: wireId(section, from ?? row.id),
				key: keyOf(blessed),
			};
		}
	}

	if (section === "treasures") {
		linkTargets(entries as Record<string, TreasureEntry>, problems);
	}
	return { entries, icons, problems };
}

const PLAIN_NAME = /^[A-Za-z0-9._-]+$/;

/**
 * The site's own file name where it is plain ASCII, and `hub-<number>` with the
 * same extension where it is not. A few of the site's names are Korean, which
 * macOS stores decomposed and Linux composed — the same name would then fail
 * to match itself between a contributor's checkout and CI.
 */
function fileNameOf(hubId: number, imagePath: string): string {
	const name = imagePath.split("/").pop() ?? "";
	if (PLAIN_NAME.test(name)) return name;
	const [extension = ""] = name.match(/\.[A-Za-z0-9]+$/) ?? [];
	return `hub-${hubId}${extension}`;
}

function familyOf(row: HubRow, problems: string[]): TreasureFamily | null {
	const category = row.category ?? null;
	if (
		category === null ||
		!(TREASURE_FAMILIES as readonly string[]).includes(category)
	) {
		problems.push(
			`treasures/${row.id}: category ${JSON.stringify(category)} is not one of ${TREASURE_FAMILIES.join(", ")}`,
		);
		return null;
	}
	return category as TreasureFamily;
}

/**
 * Fills each base's `[evolved, blessed]` pair by inverting what its forms point
 * back at. A base has at most one of each; two means the rows no longer mean
 * what this mapping assumes they do.
 */
function linkTargets(
	entries: Record<string, TreasureEntry>,
	problems: string[],
): void {
	for (const [id, entry] of Object.entries(entries).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	)) {
		if (entry.type === "N") continue;
		const base = entries[entry.source];
		if (base?.type !== "N") {
			problems.push(
				`treasures/${id} names ${entry.source} as its base, which is not a base`,
			);
			continue;
		}
		const half = entry.type === "E" ? 0 : 1;
		const taken = base.targets[half];
		if (taken !== null) {
			const form = entry.type === "E" ? "evolved" : "blessed";
			problems.push(
				`treasures/${hubNumber(entry.source)} has two ${form} forms: ${taken}, ${id}`,
			);
			continue;
		}
		base.targets[half] = id;
	}
}

/** The site's number for an unblessed treasure id, for messages. */
function hubNumber(id: string): number {
	return Number.parseInt(id, 36);
}
