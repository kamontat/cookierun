/**
 * Asks cookierundb.com whether `assets/index.json` is still complete: for each
 * section, how many entries the site lists against how many this index carries
 * without `retired: true`.
 *
 * It does not check the index's own structure. `scripts/utils/asset-ids.test.ts`
 * runs `verifyStructure` over the committed file on every `bun run test`, and
 * duplicating it here would mean two places to keep in step — the thing
 * `scripts/utils/asset-ids.ts` exists to prevent.
 *
 * Network cost is three requests, one listing page per section.
 */

import { fileURLToPath } from "node:url";

import {
	type AssetIndex,
	type Entry,
	migrate,
	SECTIONS,
} from "./utils/asset-ids";
import { fetchListing } from "./utils/cookierundb";

const INDEX = fileURLToPath(new URL("../assets/index.json", import.meta.url));

function fail(lines: string[], label: string): never {
	console.error(`${label} (${lines.length}):`);
	for (const line of lines) console.error(`  ${line}`);
	process.exit(1);
}

async function readIndex(): Promise<AssetIndex> {
	if (!(await Bun.file(INDEX).exists())) {
		fail(["assets/index.json does not exist"], "nothing to verify");
	}
	try {
		return migrate(await Bun.file(INDEX).json());
	} catch (error) {
		fail(
			[`assets/index.json could not be read: ${String(error)}`],
			"nothing to verify",
		);
	}
}

const index = await readIndex();
const width = Math.max(...SECTIONS.map((section) => section.length)) + 2;
const problems: string[] = [];

console.log(`fetched ${index.fetchedAt ?? "never"}`);

for (const section of SECTIONS) {
	let site: number;
	try {
		site = (await fetchListing(section)).length;
	} catch (error) {
		fail([`${section}: ${String(error)}`], "cookierundb.com is unreachable");
	}

	// Annotated, not inferred: `index[section]` is a union of two record types,
	// and calling `.filter` on the union of their value arrays does not typecheck.
	// TreasureEntry extends Entry, so widening to Entry[] is free.
	const entries: Entry[] = Object.values(index[section]);
	const retired = entries.filter((entry) => entry.retired === true).length;
	const listed = entries.length - retired;
	const label = `${section}:`.padEnd(width);
	const tail =
		site === listed
			? "ok"
			: site > listed
				? `${site - listed} missing`
				: `${listed - site} no longer listed`;

	console.log(
		`${label} ${site} on site, ${listed} listed (${retired} retired) — ${tail}`,
	);
	if (tail !== "ok") problems.push(`${section}: ${tail}`);
}

if (problems.length > 0) {
	console.error("");
	console.error(
		"run `bun run fetch:assets` to reconcile, then commit the result",
	);
	process.exit(1);
}
