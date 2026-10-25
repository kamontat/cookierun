/**
 * The cookierunhub.com client: where its pages, icons and data live, and the
 * requests that fetch them.
 *
 * The encyclopedia at https://www.cookierunhub.com/en/encyclopedia is a client
 * rendered page over a JSON API, so nothing here parses HTML. One request per
 * section returns every entry the site lists, evolution chain included, which
 * is all `fetch-assets` and `verify-assets` need.
 *
 * It lives apart from `fetch-assets.ts` because that script runs its whole sync
 * as top-level module code — importing anything from it would sync — and
 * `verify-assets.ts` needs the listings too.
 */

import type { Section } from "./asset-ids";

export const ORIGIN = "https://www.cookierunhub.com";

const API = `${ORIGIN}/api/v1/game-data`;

/**
 * One entry as the API lists it, narrowed to the fields this project reads.
 * The API sends many more — abilities, Korean and Thai names, release dates —
 * none of which a loadout code needs.
 *
 * `category`, `evolved_from_id`, `has_blessed` and `blessed_english_name` are
 * treasure fields; a cookie or pet row does not carry them.
 */
export type HubRow = {
	/** The site's own running number, which its page URL carries. */
	id: number;
	english_name: string | null;
	/** Relative to `/images/`, or rooted at the site (`/uploads/...`). */
	image_path: string | null;
	category?: string | null;
	evolved_from_id?: number | null;
	has_blessed?: boolean | null;
	blessed_english_name?: string | null;
};

/**
 * The entry's page. A blessed treasure has no page or number of its own — it
 * is a section of its unblessed form's page — so it borrows that page with a
 * fragment, which keeps every entry's url distinct.
 */
export function pageUrl(
	section: Section,
	hubId: number,
	blessed = false,
): string {
	return `${ORIGIN}/en/encyclopedia/${section}/${hubId}${blessed ? "#blessed" : ""}`;
}

/**
 * Where an icon is served from. Most `image_path`s are relative to `/images/`;
 * entries added through the site's own editor are rooted at `/uploads/`.
 */
export function iconUrl(imagePath: string): string {
	return encodeURI(
		imagePath.startsWith("/")
			? `${ORIGIN}${imagePath}`
			: `${ORIGIN}/images/${imagePath}`,
	);
}

export async function get(url: string): Promise<Response> {
	for (let attempt = 1; ; attempt++) {
		try {
			const res = await fetch(url);
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			return res;
		} catch (err) {
			if (attempt === 3) throw new Error(`${url}: ${err}`);
			await Bun.sleep(500 * attempt);
		}
	}
}

/** Every entry the site lists for one section. */
export async function fetchRows(section: Section): Promise<HubRow[]> {
	const rows: unknown = await (await get(`${API}/${section}`)).json();
	if (!Array.isArray(rows)) {
		throw new Error(`${API}/${section} did not return a list`);
	}
	return rows as HubRow[];
}
