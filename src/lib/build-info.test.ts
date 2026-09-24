import { expect, test } from "bun:test";

import { formatBuiltAt, REPO_URL, readBuildInfo } from "./build-info";

const SHA = "e2c43291f4b0a7c6d5e8f9a0b1c2d3e4f5a6b7c8";

test("a commit becomes a short name and a link to the commit", () => {
	const info = readBuildInfo({ commit: SHA, builtAt: undefined });

	expect(info.commit).toBe(SHA);
	expect(info.shortCommit).toBe("e2c4329");
	expect(info.commitUrl).toBe(`${REPO_URL}/commit/${SHA}`);
});

// A local build inlines nothing, and the dev server does not inline at all,
// so the empty string is the ordinary case rather than the broken one.
test("no commit leaves nothing to link to", () => {
	const info = readBuildInfo({ commit: "", builtAt: undefined });

	expect(info.commit).toBeNull();
	expect(info.shortCommit).toBeNull();
	expect(info.commitUrl).toBeNull();
});

test("an undefined commit reads the same as an empty one", () => {
	const info = readBuildInfo({ commit: undefined, builtAt: undefined });

	expect(info.commitUrl).toBeNull();
});

test("a timestamp becomes the instant the build ran", () => {
	const info = readBuildInfo({
		commit: undefined,
		builtAt: "2026-09-24T14:02:11Z",
	});

	expect(info.builtAt?.toISOString()).toBe("2026-09-24T14:02:11.000Z");
});

// Whatever the workflow writes lands here unchecked, so a date that does not
// parse has to read as "no date" rather than as an Invalid Date on the page.
test("a timestamp that does not parse reads as no timestamp", () => {
	const info = readBuildInfo({ commit: undefined, builtAt: "last Tuesday" });

	expect(info.builtAt).toBeNull();
});

test("no timestamp reads as no timestamp", () => {
	const info = readBuildInfo({ commit: undefined, builtAt: "" });

	expect(info.builtAt).toBeNull();
});

// UTC for everyone, so two people comparing what they are looking at are
// reading the same string.
test("a timestamp is shown in UTC to the minute", () => {
	expect(formatBuiltAt(new Date("2026-09-24T14:02:11Z"))).toBe(
		"2026-09-24 14:02 UTC",
	);
});

test("a timestamp is shown in UTC whatever the reader's clock says", () => {
	expect(formatBuiltAt(new Date("2026-01-05T23:45:00+07:00"))).toBe(
		"2026-01-05 16:45 UTC",
	);
});

// The default argument is the whole point of the environment read: a build
// inlines the values into it, and nothing else ever passes one.
test("the default environment is read without a process to read it from", () => {
	expect(() => readBuildInfo()).not.toThrow();
});
