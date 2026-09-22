/**
 * The faces the combi half of the page wears. Cookie power+ is a list of
 * cookies, so the cards can show the cookies themselves — but the codec does
 * not model a cookie and must not start to, so the mapping lives here and
 * resolves through the catalog's own keys rather than through wire ids.
 */

import { imageForKey } from "./catalog";
import type { CookiePower } from "./codec";

/**
 * Which cookie each power+ belongs to, by the key `assets/index.json` carries.
 * Two of the seven are effects rather than cookies and have no portrait; their
 * cards fall back to a lettered tile.
 */
export const COOKIE_POWER_ART: Record<CookiePower, string | null> = {
	cheerleader: "CheerleaderCookie",
	specialForce: "SpecialForceCookie",
	fairy: "FairyCookie",
	cheesecake: "CheesecakeCookie",
	seaFairy: "SeaFairyCookie",
	serenadeOfLove: null,
	expParty: null,
};

/** The portrait for a cookie power+, under `base`, or null when it has none. */
export function cookiePowerArt(
	power: CookiePower,
	base: string,
): string | null {
	const key = COOKIE_POWER_ART[power];
	if (key === null) return null;

	const image = imageForKey("cookies", key);
	return image === null ? null : base + image;
}
