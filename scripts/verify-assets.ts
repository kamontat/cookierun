/**
 * Checks `assets/index.json` against `assets/fingerprint.json`, without
 * touching the network.
 *
 * The ids in the index are a published wire format: an id that comes to mean a
 * different entry invalidates every code that named it. `fetch-assets` guards
 * that during a scrape, by comparing against what was on disk before the run —
 * but a hand edit, a bad merge resolution or a mangled rebase never runs the
 * scraper, and until this script there was nothing else to notice.
 *
 * `--update` recomputes the fingerprint to cover everything currently in the
 * index and rewrites `assets/fingerprint.json`. It is the only thing that may
 * write that file, and it refuses to run on an index that does not verify — a
 * fingerprint blessing a corrupt file is worse than no fingerprint at all.
 */

import { fileURLToPath } from "node:url";

import {
	type Fingerprints,
	fingerprintsFor,
	migrate,
	SECTIONS,
	verifyIndex,
	verifyStructure,
} from "./utils/asset-ids.ts";

const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));
const INDEX = `${ASSETS}index.json`;
const FINGERPRINT = `${ASSETS}fingerprint.json`;

const text = await Bun.file(INDEX).text();

function report(problems: string[], label: string): void {
	console.error(`${label} (${problems.length}):`);
	for (const problem of problems) console.error(`  ${problem}`);
}

if (process.argv.includes("--update")) {
	const problems = verifyStructure(text);
	if (problems.length > 0) {
		report(problems, "refusing to update: assets/index.json is not intact");
		process.exit(1);
	}

	const next = fingerprintsFor(migrate(JSON.parse(text)));
	await Bun.write(FINGERPRINT, `${JSON.stringify(next, null, 2)}\n`);

	for (const section of SECTIONS) {
		console.log(
			`${section}: covering ${next[section].through} entries, ${next[section].hash}`,
		);
	}
	console.log(
		"fingerprint updated — the diff is the record that this was deliberate",
	);
	process.exit(0);
}

const expected = (await Bun.file(FINGERPRINT).json()) as Fingerprints;
const problems = verifyIndex(text, expected);

if (problems.length > 0) {
	report(problems, "assets/index.json failed verification");
	console.error("");
	console.error(
		"A fingerprint mismatch with unchanged counts is not a stale constant: it",
	);
	console.error(
		"means an id changed meaning. Read `git diff assets/index.json` before",
	);
	console.error(
		"reaching for `--update`, which only ever extends coverage to entries a",
	);
	console.error("scrape appended.");
	process.exit(1);
}

const index = migrate(JSON.parse(text));
console.log(
	`intact: ${SECTIONS.map(
		(section) =>
			`${section}=${Object.keys(index[section]).length}/${expected[section].through} covered`,
	).join(" ")}`,
);
