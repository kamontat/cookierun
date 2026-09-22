/**
 * The faces the combi half of the page wears. A cookie power+ belongs to the
 * cookies or pets that bring it — sometimes one, sometimes four — so the cards
 * can show them. The codec does not model a cookie and must not start to, so
 * the mapping lives here and resolves through the catalog's own keys rather
 * than through wire ids.
 *
 * Boosts and episodes work the same way for a different reason: each has an
 * icon in `assets/index.json` under a key someone wrote by hand, and the codec
 * carries a character rather than that key. Which picture a value wears is a
 * page decision either way, so all three mappings live here.
 */

import { type CatalogSection, imageForKey, staticImage } from "./catalog";
import type { Boost, CookiePower, Episode } from "./codec";

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

/**
 * Which icon each boost wears, named by the key the index files it under. The
 * index carries two boosts the codec has no slot for — Cookie Relay and Double
 * XP — so this maps the three a code can say and ignores the rest.
 */
export const BOOST_ART: Record<Boost, string> = {
	hpExtension: "hp-extension",
	powerJellyBoost: "power-jellies",
	fastStart: "fast-start",
};

/**
 * The same for episodes, where `any` is the one value with no icon: it is the
 * absence of a choice rather than a place to run, and the index has nothing
 * filed under it. The index also carries Coin Palace Rush and Party Run, which
 * the codec cannot encode and which therefore appear here not at all.
 */
export const EPISODE_ART: Record<Episode, string | null> = {
	any: null,
	episode1: "ep1",
	episode2: "ep2",
	episode3: "ep3",
	episode4: "ep4",
	episode5: "ep5",
	episode6: "ep6",
	episode7: "ep7",
	special1: "sep1",
	special2: "sep2",
	special3: "sep3",
	specialExp: "eexp",
};

/**
 * A boost's picture under `base`, as the list `<card-group>` takes — one entry
 * or none, where a cookie power+ can have four. An icon the catalog cannot
 * resolve drops out rather than becoming a broken image, and the card falls
 * back to its lettered tile.
 */
export function boostArt(boost: Boost, base: string): readonly string[] {
	const image = staticImage("boosts", BOOST_ART[boost]);
	return image === null ? [] : [base + image];
}

/** An episode's picture under `base`, or `null` where it has none. */
export function episodeArt(episode: Episode, base: string): string | null {
	const key = EPISODE_ART[episode];
	if (key === null) return null;
	const image = staticImage("episodes", key);
	return image === null ? null : base + image;
}
