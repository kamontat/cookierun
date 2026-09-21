/**
 * The cookierundb.com client: the requests, and the parsers that read what
 * comes back.
 *
 * It lives apart from `fetch-assets.ts` because that script runs its whole
 * scrape as top-level module code — importing anything from it would scrape —
 * and `verify-assets.ts` needs the listing pages too. Each parser is exported
 * beside its fetcher, so the three patterns below are testable against fixture
 * HTML without touching the network.
 */

import { SECTIONS, type Section } from "./asset-ids";

export const ORIGIN = "https://cookierundb.com";

/**
 * Each listing page renders one `<a class="ecard">` per entry. The icon frame
 * holds an `<img>` for entries with a sprite and a placeholder `<span>` for
 * the handful that have none, so the `<img>` is matched optionally. Only the
 * treasure listing carries `data-evo`, so that attribute is optional too.
 */
const CARD_RE =
	/<a class="ecard" href="([^"]+)"[^>]*?data-name="([^"]*)"(?:[^>]*?data-evo="([^"]*)")?[^>]*>\s*<span class="icon-frame">(?:<img src="([^"]+)")?/g;

/**
 * A treasure detail page renders its relatives as `<a class="rel-card">`, each
 * labelled by an `rc-sub` caption. Two captions matter: `Evolves from` names
 * the base treasure, and `Unblessed form` appears only on a blessed page —
 * an evolved page shows `Blessed form` instead, when a blessed form exists.
 */
const REL_RE =
	/<a class="rel-card" href="\.\.\/treasures\/([^"]+)"[\s\S]*?<span class="rc-sub">([^<]*)<\/span>/g;

const LOC_RE = /<loc>https:\/\/cookierundb\.com\/([^<]*)<\/loc>/g;

export type Card = {
	slug: string;
	name: string;
	icon: string | null;
	evolved: boolean;
};

export function unescapeHtml(text: string): string {
	return text
		.replace(/&#x27;/g, "'")
		.replace(/&#39;/g, "'")
		.replace(/&quot;/g, '"')
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

export async function get(path: string): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(ORIGIN + path);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res;
		} catch (err) {
			if (attempt === 3) throw new Error(`${path}: ${err}`);
			await Bun.sleep(500 * attempt);
		}
	}
}

export function parseListing(html: string): Card[] {
	return [...html.matchAll(CARD_RE)].map(
		([, href = "", name = "", evo = "0", icon]) => ({
			slug: href.split("/").pop() ?? "",
			name: unescapeHtml(name),
			icon: icon ? icon.replace(/^\.\.\//, "/") : null,
			evolved: evo === "1",
		}),
	);
}

export async function fetchListing(section: Section): Promise<Card[]> {
	return parseListing(await (await get(`/${section}/`)).text());
}

/**
 * The base a treasure evolved from, and whether this page is the blessed form.
 * Returns `null` when the page names no base at all, which the caller reports
 * as drift rather than silently writing a chainless evolved treasure.
 */
export function parseEvolution(
	html: string,
): { source: string; type: "E" | "B" } | null {
	let source: string | null = null;
	let blessed = false;
	for (const [, target = "", label = ""] of html.matchAll(REL_RE)) {
		if (label === "Evolves from") source ??= target;
		if (label === "Unblessed form") blessed = true;
	}
	return source === null ? null : { source, type: blessed ? "B" : "E" };
}

export async function fetchEvolution(
	slug: string,
): Promise<{ source: string; type: "E" | "B" } | null> {
	return parseEvolution(await (await get(`/treasures/${slug}`)).text());
}

/** Slugs the sitemap declares for each section, ignoring `/th/` translations. */
export function parseSitemap(xml: string): Record<Section, Set<string>> {
	const slugs: Record<Section, Set<string>> = {
		cookies: new Set(),
		pets: new Set(),
		treasures: new Set(),
	};
	for (const [, loc] of xml.matchAll(LOC_RE)) {
		if (loc === undefined) continue;
		const [section, slug] = loc.split("/");
		if (slug && SECTIONS.includes(section as Section)) {
			slugs[section as Section].add(slug);
		}
	}
	return slugs;
}

export async function fetchSitemap(): Promise<Record<Section, Set<string>>> {
	return parseSitemap(await (await get("/sitemap.xml")).text());
}
