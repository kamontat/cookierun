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

test("a cookie power that names a cookie resolves to that cookie's portrait", () => {
	expect(cookiePowerArt("fairy", "../assets/")).toBe(
		"../assets/cookies/ch26.png",
	);
});

// Serenade of Love and EXP Party are not cookies, so there is no portrait to
// find and the card falls back to a lettered tile.
test("a cookie power that names no cookie has no art", () => {
	expect(cookiePowerArt("expParty", "../assets/")).toBe(null);
});

test("every mapped cookie power resolves to a real file", () => {
	for (const power of ALL_COOKIE_POWERS) {
		if (COOKIE_POWER_ART[power] === null) continue;
		expect(cookiePowerArt(power, "")).toMatch(/^cookies\/.+\.png$/);
	}
});
