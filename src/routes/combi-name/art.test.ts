import { expect, test } from "bun:test";

import { COOKIE_POWER_ART, cookiePowerArt } from "./art";
import { ALL_COOKIE_POWERS } from "./codec";

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
