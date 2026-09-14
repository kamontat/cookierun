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
 * write that file, and it refuses when any covered id has changed meaning — a
 * fingerprint blessing corruption is worse than no fingerprint at all. What it
 * will do is extend coverage to ids a scrape appended, and record display
 * fields a scrape rewrote, which is the whole reason it exists.
 */

import { fileURLToPath } from "node:url";

import {
	type Fingerprints,
	fingerprintProblems,
	fingerprintsFor,
	migrate,
	SECTIONS,
	verifyCovered,
	verifyIndex,
	verifyStructure,
} from "./utils/asset-ids.ts";

const ASSETS = fileURLToPath(new URL("../assets/", import.meta.url));
const INDEX = `${ASSETS}index.json`;
const FINGERPRINT = `${ASSETS}fingerprint.json`;

function report(problems: string[], label: string): never {
	console.error(`${label} (${problems.length}):`);
	for (const problem of problems) console.error(`  ${problem}`);
	process.exit(1);
}

if (!(await Bun.file(INDEX).exists())) {
	report(["assets/index.json does not exist"], "nothing to verify");
}

const text = await Bun.file(INDEX).text();
const update = process.argv.slice(2).includes("--update");
const onDisk = await Bun.file(FINGERPRINT).exists();

if (update) {
	// Bootstrapping has nothing to compare against, so structure is the whole
	// gate. Otherwise every covered id must still name what it named — the one
	// thing `--update` may never paper over.
	const problems = onDisk
		? verifyCovered(text, await readFingerprints())
		: verifyStructure(text);
	if (problems.length > 0) {
		report(problems, "refusing to update: assets/index.json is not intact");
	}

	const next = fingerprintsFor(migrate(JSON.parse(text)));
	await Bun.write(FINGERPRINT, `${JSON.stringify(next, null, 2)}\n`);

	for (const section of SECTIONS) {
		const { through, identity, display } = next[section];
		console.log(
			`${section}: covering ${through} entries, identity ${identity}, display ${display}`,
		);
	}
	console.log(
		"fingerprint updated — the diff is the record that this was deliberate",
	);
	process.exit(0);
}

if (!onDisk) {
	report(
		[
			"assets/fingerprint.json does not exist — run `bun run verify:assets --update` to create it",
		],
		"nothing to verify against",
	);
}

const expected = await readFingerprints();
const problems = verifyIndex(text, expected);

if (problems.length > 0) {
	console.error(`assets/index.json failed verification (${problems.length}):`);
	for (const problem of problems) console.error(`  ${problem}`);
	console.error("");
	console.error(
		"An identity mismatch with unchanged counts is not a stale fingerprint: it",
	);
	console.error(
		"means an id changed meaning. Read `git diff assets/index.json` first —",
	);
	console.error("`--update` refuses to run while one is outstanding.");
	process.exit(1);
}

const index = migrate(JSON.parse(text));
console.log(
	`intact: ${SECTIONS.map(
		(section) => `${section}=${Object.keys(index[section]).length}`,
	).join(" ")}, all covered`,
);

async function readFingerprints(): Promise<Fingerprints> {
	let parsed: unknown;
	try {
		parsed = await Bun.file(FINGERPRINT).json();
	} catch (error) {
		report(
			[`assets/fingerprint.json is not valid JSON: ${String(error)}`],
			"cannot read the fingerprint",
		);
	}

	const problems = fingerprintProblems(parsed);
	if (problems.length > 0) report(problems, "cannot read the fingerprint");

	return parsed as Fingerprints;
}
