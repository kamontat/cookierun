import { expect, test } from "bun:test";

import { parseEvolution, parseListing, parseSitemap } from "./cookierundb";

const withIcon =
	'<a class="ecard" href="../cookies/ch01" data-name="GingerBrave">' +
	'<span class="icon-frame"><img src="../img/cookies/ch01.png" alt=""></span></a>';

const spriteless =
	'<a class="ecard" href="../cookies/ch99" data-name="No Sprite">' +
	'<span class="icon-frame"><span class="placeholder"></span></span></a>';

const escaped =
	'<a class="ecard" href="../cookies/ch07" data-name="Dr. Wasabi&#x27;s &quot;Cookie&quot;">' +
	'<span class="icon-frame"><img src="../img/cookies/ch07.png" alt=""></span></a>';

const evolvedCard =
	'<a class="ecard" href="../treasures/stretched-acorn" data-name="Stretched Acorn" data-evo="1">' +
	'<span class="icon-frame"><img src="../img/treasures/tr034.png" alt=""></span></a>';

const familyCard =
	'<a class="ecard" href="../treasures/xp-elixir-l" data-name="XP-Elixir (L)" ' +
	'data-grade="C" data-fam="consumable" data-evo="0">' +
	'<span class="icon-frame"><img src="../img/treasures/tr_medal_03.png" alt=""></span></a>';

test("a listing card yields its slug, name and icon, rooted at the site", () => {
	expect(parseListing(withIcon)).toEqual([
		{
			slug: "ch01",
			name: "GingerBrave",
			icon: "/img/cookies/ch01.png",
			evolved: false,
			family: null,
		},
	]);
});

// The treasure listing sorts its entries into families, and the combi page
// offers only the ones a run can equip. Nothing else carries the attribute.
test("data-fam names a treasure's family", () => {
	expect(parseListing(familyCard)[0]?.family).toBe("consumable");
	expect(parseListing(withIcon)[0]?.family).toBe(null);
});

test("a card whose frame holds no img is spriteless, not skipped", () => {
	expect(parseListing(spriteless)).toEqual([
		{
			slug: "ch99",
			name: "No Sprite",
			icon: null,
			evolved: false,
			family: null,
		},
	]);
});

test("a card name is unescaped", () => {
	expect(parseListing(escaped)[0]?.name).toBe('Dr. Wasabi\'s "Cookie"');
});

// Only the treasure listing carries data-evo, which is why the pattern makes it
// optional — but when it is there, it has to be read.
test("data-evo marks a treasure as evolved", () => {
	expect(parseListing(evolvedCard)[0]?.evolved).toBe(true);
	expect(parseListing(withIcon)[0]?.evolved).toBe(false);
});

test("every card on a page is parsed, not just the first", () => {
	expect(parseListing(withIcon + spriteless + escaped)).toHaveLength(3);
});

const relCard = (slug: string, caption: string) =>
	`<a class="rel-card" href="../treasures/${slug}">` +
	`<span class="rc-name">Whatever</span><span class="rc-sub">${caption}</span></a>`;

test("an evolved page names the base it evolves from", () => {
	expect(parseEvolution(relCard("acorn", "Evolves from"))).toEqual({
		source: "acorn",
		type: "E",
	});
});

// "Unblessed form" appears only on a blessed page; an evolved one shows
// "Blessed form" instead, when a blessed form exists.
test("a page carrying an Unblessed form caption is the blessed one", () => {
	const html =
		relCard("acorn", "Evolves from") +
		relCard("stretched-acorn", "Unblessed form");

	expect(parseEvolution(html)).toEqual({ source: "acorn", type: "B" });
});

test("a page that names no base yields null rather than a chainless treasure", () => {
	expect(parseEvolution(relCard("stretched-acorn", "Blessed form"))).toBe(null);
});

test("the sitemap is read per section, ignoring the /th/ translations", () => {
	const xml =
		"<urlset>" +
		"<url><loc>https://cookierundb.com/</loc></url>" +
		"<url><loc>https://cookierundb.com/cookies/ch01</loc></url>" +
		"<url><loc>https://cookierundb.com/th/cookies/ch01</loc></url>" +
		"<url><loc>https://cookierundb.com/pets/pet01</loc></url>" +
		"<url><loc>https://cookierundb.com/treasures/acorn</loc></url>" +
		"</urlset>";

	const slugs = parseSitemap(xml);

	expect([...slugs.cookies]).toEqual(["ch01"]);
	expect([...slugs.pets]).toEqual(["pet01"]);
	expect([...slugs.treasures]).toEqual(["acorn"]);
});
