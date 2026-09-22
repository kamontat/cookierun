import { expect, test } from "bun:test";

import {
	BOOST_ART,
	boostArt,
	COOKIE_POWER_ART,
	cookiePowerArt,
	EPISODE_ART,
	episodeArt,
} from "./art";
import { ALL_BOOSTS, ALL_COOKIE_POWERS, ALL_EPISODES } from "./codec";

// The same key-for-key parity labels.ts is held to: a cookie power added to
// the codec cannot ship without the page deciding what face it wears.
test("every cookie power has an art entry", () => {
	expect(Object.keys(COOKIE_POWER_ART).sort()).toEqual(
		[...ALL_COOKIE_POWERS].sort(),
	);
});

test("a cookie power that names one cookie resolves to that cookie's portrait", () => {
	expect(cookiePowerArt("fairy", "../assets/")).toEqual([
		"../assets/cookies/ch26.png",
	]);
});

// Serenade of Love is a pair of pets rather than a cookie, so the card wears
// both of their faces.
test("a cookie power that names a pair of pets resolves to both", () => {
	expect(cookiePowerArt("serenadeOfLove", "../assets/")).toEqual([
		"../assets/pets/pet57.png",
		"../assets/pets/pet58.png",
	]);
});

// EXP Party is the four cookies that bring it.
test("a cookie power that names four cookies resolves to all four", () => {
	expect(cookiePowerArt("expParty", "../assets/")).toEqual([
		"../assets/cookies/ch95.png",
		"../assets/cookies/ch93.png",
		"../assets/cookies/ch91.png",
		"../assets/cookies/ch92.png",
	]);
});

test("every entry every power names resolves to a real file", () => {
	for (const power of ALL_COOKIE_POWERS) {
		const art = cookiePowerArt(power, "");
		expect(art).toHaveLength(COOKIE_POWER_ART[power].length);
		for (const image of art) {
			expect(image).toMatch(/^(cookies|pets)\/.+\.png$/);
		}
	}
});

// A key the catalog has lost would otherwise become a broken image, silently.
test("an entry the catalog cannot resolve is dropped rather than linked", () => {
	expect(cookiePowerArt("expParty", "")).not.toContain("");
});

// The same parity, for the two rows whose icons come from the index's authored
// sections: a boost or episode added to the codec cannot ship undecided.
test("every boost has an art entry", () => {
	expect(Object.keys(BOOST_ART).sort()).toEqual([...ALL_BOOSTS].sort());
});

test("every episode has an art entry", () => {
	expect(Object.keys(EPISODE_ART).sort()).toEqual([...ALL_EPISODES].sort());
});

test("a boost resolves to the one icon the index files it under", () => {
	expect(boostArt("fastStart", "../assets/")).toEqual([
		"../assets/boosts/fast-start.png",
	]);
});

test("an episode resolves to its own icon", () => {
	expect(episodeArt("episode1", "../assets/")).toBe(
		"../assets/episodes/ep1.png",
	);
	expect(episodeArt("specialExp", "../assets/")).toBe(
		"../assets/episodes/eexp.png",
	);
});

// `any` is the absence of a choice rather than a place to run, so its chip is
// drawn bare — the same way every chip looked before the icons arrived.
test("the any episode has no icon", () => {
	expect(EPISODE_ART.any).toBe(null);
	expect(episodeArt("any", "../assets/")).toBe(null);
});

// A key renamed in assets/index.json is caught here rather than on the page.
test("every key these two name is in the index", () => {
	for (const boost of ALL_BOOSTS) {
		expect(boostArt(boost, "")).toEqual([
			expect.stringMatching(/^boosts\/.+\.png$/),
		]);
	}

	for (const episode of ALL_EPISODES) {
		if (EPISODE_ART[episode] === null) continue;
		expect(episodeArt(episode, "")).toMatch(/^episodes\/.+\.png$/);
	}
});
