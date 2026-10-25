import { expect, test } from "bun:test";

import type { HubRow } from "./cookierunhub";
import { entriesFrom } from "./hub-index";

const row = (fields: Partial<HubRow> & { id: number }): HubRow => ({
	english_name: `Entry ${fields.id}`,
	image_path: null,
	...fields,
});

test("a cookie is keyed by its hub number in base 36, and points at its hub page", () => {
	const { entries } = entriesFrom("cookies", [
		row({
			id: 81,
			english_name: "Tiger Lily Cookie",
			image_path: "cookies/jungle_warrior_cookie.png",
		}),
	]);

	expect(entries).toEqual({
		"29": {
			name: "Tiger Lily Cookie",
			url: "https://www.cookierunhub.com/en/encyclopedia/cookies/81",
			image: "cookies/jungle_warrior_cookie.png",
			key: "TigerLilyCookie",
		},
	});
});

test("an icon is filed under its section whichever hub directory serves it", () => {
	const { entries, icons } = entriesFrom("pets", [
		row({ id: 103, image_path: "/uploads/pets/mango_toucan.webp" }),
		row({ id: 1, image_path: "pets/bouncing_bean.png" }),
	]);

	expect(entries["2V"]?.image).toBe("pets/mango_toucan.webp");
	expect(entries["01"]?.image).toBe("pets/bouncing_bean.png");
	expect(icons).toEqual(
		new Map([
			[
				"pets/mango_toucan.webp",
				"https://www.cookierunhub.com/uploads/pets/mango_toucan.webp",
			],
			[
				"pets/bouncing_bean.png",
				"https://www.cookierunhub.com/images/pets/bouncing_bean.png",
			],
		]),
	);
});

// A few of the site's own file names are Korean. macOS writes them decomposed
// and Linux composed, so the same name would not match itself across machines;
// the site's number is a name that cannot drift.
test("an icon whose file name is not plain ASCII is filed under the site's number", () => {
	const { entries, icons } = entriesFrom("treasures", [
		row({ id: 42, category: "limited", image_path: "treasures/쿠키_액자.png" }),
	]);

	expect(entries["016"]?.image).toBe("treasures/hub-42.png");
	expect(icons.get("treasures/hub-42.png")).toBe(
		"https://www.cookierunhub.com/images/treasures/%EC%BF%A0%ED%82%A4_%EC%95%A1%EC%9E%90.png",
	);
});

test("an entry without an icon has a null image and asks for no download", () => {
	const { entries, icons } = entriesFrom("cookies", [row({ id: 5 })]);

	expect(entries["05"]?.image).toBe(null);
	expect(icons.size).toBe(0);
});

test("two hub directories offering one file name is a problem, not an overwrite", () => {
	const { problems } = entriesFrom("pets", [
		row({ id: 1, image_path: "pets/a.webp" }),
		row({ id: 2, image_path: "/uploads/pets/a.webp" }),
	]);

	expect(problems).toEqual([
		"pets/a.webp is served from both https://www.cookierunhub.com/images/pets/a.webp and https://www.cookierunhub.com/uploads/pets/a.webp",
	]);
});

test("a base, its evolved form and the blessed form of that are linked both ways", () => {
	const { entries, problems } = entriesFrom("treasures", [
		row({
			id: 10,
			english_name: "Quick Wheels",
			category: "cookie",
			image_path: "treasures/wheels.png",
		}),
		row({
			id: 50,
			english_name: "Burn Some Rubber Tire",
			category: "cookie",
			image_path: "treasures/tire.webp",
			evolved_from_id: 10,
			has_blessed: true,
			blessed_english_name: "Blessed Burn Some Rubber Tire",
		}),
	]);

	expect(problems).toEqual([]);
	expect(entries["00A"]).toEqual({
		name: "Quick Wheels",
		url: "https://www.cookierunhub.com/en/encyclopedia/treasures/10",
		image: "treasures/wheels.png",
		family: "cookie",
		type: "N",
		targets: ["01E", "I1E"],
		key: "QuickWheels",
	});
	expect(entries["01E"]).toMatchObject({ type: "E", source: "00A" });
	// The blessed form has no page or number of its own on the hub: it borrows
	// its unblessed form's, offset by half the id space.
	expect(entries["I1E"]).toEqual({
		name: "Blessed Burn Some Rubber Tire",
		url: "https://www.cookierunhub.com/en/encyclopedia/treasures/50#blessed",
		image: "treasures/tire.webp",
		family: "cookie",
		type: "B",
		source: "00A",
		key: "BlessedBurnSomeRubberTire",
	});
});

test("a base that is blessed without evolving names its blessed form directly", () => {
	const { entries } = entriesFrom("treasures", [
		row({
			id: 7,
			english_name: "Comb Over Hair Cream",
			category: "limited",
			has_blessed: true,
			blessed_english_name: null,
		}),
	]);

	expect(entries["007"]).toMatchObject({ type: "N", targets: [null, "I07"] });
	expect(entries["I07"]).toMatchObject({
		name: "Blessed Comb Over Hair Cream",
		type: "B",
		source: "007",
	});
});

test("a category outside the known families is a problem", () => {
	const { problems } = entriesFrom("treasures", [
		row({ id: 1, category: "snack" }),
	]);

	expect(problems).toEqual([
		'treasures/1: category "snack" is not one of cookie, gacha, limited, pet, squirrel',
	]);
});

test("an evolved treasure whose base is not listed is a problem", () => {
	const { problems } = entriesFrom("treasures", [
		row({ id: 2, category: "gacha", evolved_from_id: 99 }),
	]);

	expect(problems).toEqual([
		"treasures/2 evolves from 99, which is not listed",
	]);
});

test("a base with two blessed forms is a problem", () => {
	const { problems } = entriesFrom("treasures", [
		row({ id: 1, category: "gacha", has_blessed: true }),
		row({ id: 2, category: "gacha", evolved_from_id: 1, has_blessed: true }),
	]);

	expect(problems).toEqual(["treasures/1 has two blessed forms: I01, I02"]);
});

test("a hub number past what an id can hold is a problem", () => {
	const { problems } = entriesFrom("cookies", [row({ id: 1296 })]);

	expect(problems).toEqual([
		"cookies/1296 does not fit a 2-character id (at most 1295)",
	]);
});
