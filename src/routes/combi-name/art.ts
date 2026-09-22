/**
 * The faces the combi half of the page wears. A cookie power+ belongs to the
 * cookies or pets that bring it — sometimes one, sometimes four — so the cards
 * can show them. The codec does not model a cookie and must not start to, so
 * the mapping lives here and resolves through the catalog's own keys rather
 * than through wire ids.
 */

import { type CatalogSection, imageForKey } from "./catalog";
import type { CookiePower } from "./codec";

/** One entry of a catalog, named the way `assets/index.json` names it. */
export type ArtRef = { section: CatalogSection; key: string };

/**
 * Who each power+ belongs to. Most are a single cookie; Serenade of Love is the
 * pair of pets that sing it, and EXP Party the four cookies that throw it.
 */
export const COOKIE_POWER_ART: Record<CookiePower, readonly ArtRef[]> = {
	cheerleader: [{ section: "cookies", key: "CheerleaderCookie" }],
	specialForce: [{ section: "cookies", key: "SpecialForceCookie" }],
	fairy: [{ section: "cookies", key: "FairyCookie" }],
	cheesecake: [{ section: "cookies", key: "CheesecakeCookie" }],
	seaFairy: [{ section: "cookies", key: "SeaFairyCookie" }],
	serenadeOfLove: [
		{ section: "pets", key: "MsDoReMi" },
		{ section: "pets", key: "MrFaSolLaSi" },
	],
	expParty: [
		{ section: "cookies", key: "BraisedPorkCookie" },
		{ section: "cookies", key: "LotusRootPhantomCookie" },
		{ section: "cookies", key: "KaymakCookie" },
		{ section: "cookies", key: "PineMonkCookie" },
	],
};

/**
 * Every picture a cookie power+ wears, under `base`. An entry the catalog can
 * no longer resolve drops out rather than becoming a broken image, so a card
 * shows the faces it has — and none at all falls back to a lettered tile in the
 * component.
 */
export function cookiePowerArt(
	power: CookiePower,
	base: string,
): readonly string[] {
	return COOKIE_POWER_ART[power].flatMap(({ section, key }) => {
		const image = imageForKey(section, key);
		return image === null ? [] : [base + image];
	});
}
