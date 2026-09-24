import { boostArt, cookiePowerArt, episodeArt } from "./art";
import {
	anyIdFor,
	type EntryKind,
	imageFor,
	kindFor,
	labelFor,
	optionsFor,
} from "./catalog";
import {
	type Action,
	ALL_ACTIONS,
	ALL_BOOSTS,
	ALL_COOKIE_POWERS,
	ALL_EPISODES,
	ALL_RANDOM_BOOSTS,
	ALL_TYPES,
	type Boost,
	CODE_LENGTH,
	type Combi,
	type CombiType,
	type CookiePower,
	type Episode,
	type RandomBoost,
} from "./codec";
import { describeBuild } from "./describe";
import {
	combiSectionOf,
	decodeFull,
	encodeFull,
	isSemiAutoBuild,
} from "./full-code";
import { hintsFor } from "./hints";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	RANDOM_BOOST_LABELS,
	TYPE_LABELS,
} from "./labels";
import type { Loadout } from "./loadout";
import { codeInHash, hashFor, rememberCode, startingCode } from "./state";

import "#components/build-summary";
import "#components/card-group";
import "#components/chip-group";
import "#components/code-bar";
import "#components/entry-tile";
import "#components/entry-tiles";
import "#components/site-nav";

import type { BuildSummary } from "#components/build-summary";
import type { CardGroup } from "#components/card-group";
import type { ChipGroup } from "#components/chip-group";
import type { CodeBar } from "#components/code-bar";
import type { EntryTile } from "#components/entry-tile";
import type { EntryTiles } from "#components/entry-tiles";

/** Exported for this route's test, which drives the page through the same lookups. */
export function need<T extends HTMLElement>(id: string): T {
	const node = document.getElementById(id);
	if (node === null) throw new Error(`the page is missing #${id}`);
	return node as T;
}

const codeBar = need<CodeBar>("code");
const summaryCard = need<BuildSummary>("summary");
const warningList = need<HTMLUListElement>("warnings");
const copyLinkButton = need<HTMLButtonElement>("copy-link");
const resetButton = need<HTMLButtonElement>("reset");
const linkStatus = need("link-status");

const buildForm = need<HTMLFormElement>("build");
const typeChips = need<ChipGroup>("type");
const episodeTile = need<EntryTile>("episode");
const boostCards = need<CardGroup>("boosts");
const randomBoostTile = need<EntryTile>("randomBoost");
const cookiePowerCards = need<CardGroup>("cookiePowers");
const actionChips = need<ChipGroup>("action");

const cookieTile = need<EntryTile>("cookie");
const relayTile = need<EntryTile>("relay");
const petTile = need<EntryTile>("pet");
const treasureSlots = [
	need<EntryTiles>("treasure1"),
	need<EntryTiles>("treasure2"),
	need<EntryTiles>("treasure3"),
];
const orderChips = need<ChipGroup>("treasureOrder");

/** Icons sit beside the built page, one directory up from this route. */
const ASSET_BASE = "../assets/";

function pickerOptions(
	section: "cookies" | "pets" | "treasures",
): readonly (readonly [string, string, string | null, EntryKind | null])[] {
	return optionsFor(section).map(
		([id, label, image, kind]) =>
			[id, label, image === null ? null : ASSET_BASE + image, kind] as const,
	);
}

/**
 * The same list without the kind, for the three `<entry-tile>` pickers. Nothing
 * a cookie or a pet picker holds evolves, so the kind is always null there and
 * the element has no field for one.
 *
 * Any leads the list, under the tile's own None. The two are different answers
 * — a slot the build says anything fits, against one it never mentions — and
 * the order puts them together at the top rather than burying Any in the
 * catalog it is not part of.
 */
function tileOptions(
	section: "cookies" | "pets",
): readonly (readonly [string, string, string | null])[] {
	const any = anyIdFor(section);
	return [
		[any, labelFor(section, any), null] as const,
		...pickerOptions(section).map(
			([id, label, image]) => [id, label, image] as const,
		),
	];
}

/** What the treasure slots offer: the families a run can equip. */
const treasureCatalog = pickerOptions("treasures");

const ORDER_OPTIONS = [
	["any", "Any order"],
	["ordered", "Exact order"],
] as const;

function readLoadout(): Loadout {
	return {
		cookie: cookieTile.value,
		relay: relayTile.value,
		pet: petTile.value,
		// Empty slots are not gaps in the wire format, so they drop out.
		treasures: treasureSlots
			.map((slot) => slot.selected)
			.filter((slot) => slot.length > 0),
		ordered: orderChips.value === "ordered",
	};
}

/**
 * The treasure list the slots offer, plus whatever this code already carries.
 *
 * The picker leaves out the families a run cannot equip, but a code can carry
 * one all the same — written by hand, or before the list was narrowed. A slot
 * drops any pick its `options` do not contain, so without this the page would
 * quietly rewrite someone's saved build on the way in.
 */
function treasureOptions(
	carried: readonly string[],
): readonly (readonly [string, string, string | null, EntryKind | null])[] {
	const offered = treasureCatalog;
	const extra = carried
		.filter((id) => !offered.some(([candidate]) => candidate === id))
		.map(
			(id) =>
				[
					id,
					labelFor("treasures", id),
					imageFor("treasures", id) === null
						? null
						: ASSET_BASE + imageFor("treasures", id),
					kindFor("treasures", id),
				] as const,
		);
	if (extra.length === 0) return offered;

	// Id order, the order every wire-format sort uses.
	return [...offered, ...extra].sort(([a], [b]) =>
		a === b ? 0 : a < b ? -1 : 1,
	);
}

function writeLoadout(loadout: Loadout): void {
	cookieTile.value = loadout.cookie;
	relayTile.value = loadout.relay;
	petTile.value = loadout.pet;
	orderChips.value = loadout.ordered ? "ordered" : "any";
	treasureSlots.forEach((slot, index) => {
		const carried = loadout.treasures[index] ?? [];
		// Options before the picks: the two are separate writes, and a slot
		// prunes a pick its current options do not hold.
		slot.options = treasureOptions(carried);
		slot.selected = carried;
	});
}

function readForm(): Combi {
	return {
		type: typeChips.value as CombiType,
		// The tile offers no None of its own — `any` is the episode's — so the
		// fallback is a type-level one and never a value the page can produce.
		episode: (episodeTile.value ?? "any") as Episode,
		boosts: boostCards.selected as Boost[],
		randomBoost: randomBoostTile.value as RandomBoost | null,
		cookiePowers: cookiePowerCards.selected as CookiePower[],
		action: actionChips.value as Action,
	};
}

function writeForm(combi: Combi): void {
	// A semi-auto code lands on the Auto chip: semi-auto is what the flag slots
	// make of an auto run, not a type anyone picks, so there is no chip for it.
	typeChips.value = combi.type === "semiauto" ? "auto" : combi.type;
	episodeTile.value = combi.episode;
	// No sentinel in either direction: the tile's own empty pick is null, which
	// is exactly what a combi carrying no random boost holds.
	randomBoostTile.value = combi.randomBoost;
	actionChips.value = combi.action;
	boostCards.selected = combi.boosts;
	cookiePowerCards.selected = combi.cookiePowers;
}

function setStatus(host: HTMLElement, text: string, isError = false): void {
	host.textContent = text;
	host.classList.toggle("error", isError);
}

/** How long a button says it worked before going back to its own label. */
const CONFIRM_FOR = 2000;

const confirmTimers = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

/**
 * Says a button's work is done on the button itself, by swapping which of its
 * two labels is visible. The alternative is a line under it that stands open
 * for a sentence it shows two seconds at a time, and in a panel pinned to the
 * top of the screen an empty line costs the same room as a full one.
 */
function confirmOn(button: HTMLButtonElement): void {
	const swap = button.querySelector(".swap");
	if (swap === null) return;

	clearTimeout(confirmTimers.get(button));
	swap.classList.add("done");
	confirmTimers.set(
		button,
		setTimeout(() => {
			swap.classList.remove("done");
			confirmTimers.delete(button);
		}, CONFIRM_FOR),
	);
}

/**
 * The address bar is the page's own copy of the code, so a build is a link
 * someone can send. `replaceState` rather than assigning the hash: one history
 * entry per keystroke would bury the page someone arrived from.
 */
function publish(code: string): void {
	try {
		history.replaceState(null, "", hashFor(code));
	} catch {}
	rememberCode(localStorage, code);
}

function showWarnings(warnings: readonly string[]): void {
	warningList.replaceChildren(
		...warnings.map((warning) => {
			const item = document.createElement("li");
			item.textContent = warning;
			return item;
		}),
	);
}

/**
 * The one render. Everything the page shows is derived from the controls, so
 * every change — a chip, a card, a typed code already applied — comes back
 * through here.
 */
function render(warnings: readonly string[] = []): void {
	const code = encodeFull({ loadout: readLoadout(), combi: readForm() });
	// The line under the code answers a question about the code in front of you,
	// so a new code clears it. The two callers that have something to say about
	// the code they just applied say it after this returns.
	codeBar.message = "";
	codeBar.invalid = false;
	codeBar.value = code;
	// After the value: setting it drops the old hints, which described the code
	// before this one.
	codeBar.hints = hintsFor(code);

	// Read the code back so the verdict reflects the character actually written
	// into slot 2, not the type the chips still show.
	const { full } = decodeFull(code);
	summaryCard.verdict = describeBuild(full);
	// The one chip that says what it is rather than what you picked: an auto run
	// with Fast Start, a random boost, an action or a relay is a semi-auto run,
	// and the chip reading Auto beside a code reading H is the disagreement the
	// page exists to prevent.
	typeChips.options = typeOptions(isSemiAutoBuild(full));

	// A numbered slot claims a position, and the code only carries one when the
	// order is exact. Read from the decoded code, not the switch: the code's truth
	// is what matters. With fewer than two slots filled, the code carries no order,
	// so the labels read "Any slot" even when the switch says "Exact order".
	treasureSlots.forEach((slot, index) => {
		slot.setAttribute(
			"legend",
			full.loadout.ordered ? `Slot ${index + 1}` : "Any slot",
		);
	});

	showWarnings(warnings);
	publish(code);
}

function applyCode(code: string, warnings: readonly string[] = []): void {
	const { full } = decodeFull(code);
	writeForm(full.combi);
	writeLoadout(full.loadout);
	render(warnings);
}

/**
 * A code typed into the bar, decoded on every keystroke. A code that does not
 * read yet is not an error to argue with — it is someone mid-way through
 * typing — so the controls are left exactly where they are and the bar says how
 * far along the code is.
 */
function readDraft(text: string): void {
	const canonical = text.trim().toUpperCase();

	if (canonical === "") {
		codeBar.message = "Type or paste a code.";
		codeBar.invalid = false;
		return;
	}

	const combiPart = combiSectionOf(canonical);
	if (combiPart.length !== CODE_LENGTH) {
		codeBar.message = `${combiPart.length} of ${CODE_LENGTH} characters.`;
		codeBar.invalid = false;
		return;
	}

	try {
		const { warnings } = decodeFull(canonical);
		applyCode(canonical, warnings);
		// `render` has already rewritten the bar's value and cleared its status;
		// the message has to be cleared after it, not before.
		codeBar.message = "";
		codeBar.invalid = false;
	} catch (error) {
		codeBar.message = error instanceof Error ? error.message : String(error);
		codeBar.invalid = true;
	}
}

/** Which control writes each group of characters the hints mark out. */
const OWNER: Record<string, HTMLElement> = {
	type: typeChips,
	episode: episodeTile,
	boosts: boostCards,
	randomBoost: randomBoostTile,
	cookiePowers: cookiePowerCards,
	action: actionChips,
	cookie: cookieTile,
	relay: relayTile,
	pet: petTile,
	treasures: treasureSlots[0] as HTMLElement,
};

/**
 * Focus lands on the host, not on the first control inside it: a page reaching
 * into a component's shadow root is the one thing the component boundary is
 * for. The host is made focusable here rather than in the markup, since it is
 * this wiring that needs it and not the page's structure.
 */
for (const element of new Set(Object.values(OWNER))) element.tabIndex = -1;

function jumpTo(group: string): void {
	const owner = OWNER[group];
	if (owner === undefined) return;
	owner.scrollIntoView({ block: "center", behavior: "smooth" });
	owner.focus();
}

/**
 * Whether a keystroke is going into a field somewhere — including one inside a
 * component's shadow root, which is where every search box on this page lives.
 * A paste there belongs to that field, not to the code bar.
 */
function isTyping(): boolean {
	let node: Element | null = document.activeElement;
	while (node !== null) {
		if (
			node instanceof HTMLInputElement ||
			node instanceof HTMLTextAreaElement
		) {
			return true;
		}
		node =
			(node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot
				?.activeElement ?? null;
	}
	return false;
}

function pairs<K extends string>(
	values: readonly K[],
	labels: Record<K, string>,
): readonly (readonly [string, string])[] {
	return values.map((value) => [value, labels[value]] as const);
}

/**
 * Every type but semi-auto. That one is derived, not chosen: `encode` writes
 * slot 2 from the flag slots — Fast Start, a random boost, a jump action — so
 * an auto run becomes semi-auto by what else is on, and a chip for it could
 * only disagree with the code. The codec still knows the value, and a code
 * carrying `H` still decodes to it; `writeForm` lands that on the Auto chip.
 */
const PICKABLE_TYPES = ALL_TYPES.filter((type) => type !== "semiauto");

/**
 * Every pickable type, with the Auto chip wearing whichever of the two names
 * the build has earned. Semi-auto is still not a choice — picking it and
 * picking Auto are the same click — but the chip says which one you are on.
 */
function typeOptions(semi: boolean): readonly (readonly [string, string])[] {
	return PICKABLE_TYPES.map(
		(type) =>
			[
				type,
				type === "auto" && semi ? TYPE_LABELS.semiauto : TYPE_LABELS[type],
			] as const,
	);
}

typeChips.options = typeOptions(false);
// Twelve landscape cards is a grid, not a row: an episode is a place, and the
// picture is what anyone recognises it by. `any` has no icon and falls back to
// the lettered cell the catalog pickers already use.
episodeTile.options = ALL_EPISODES.map(
	(episode) =>
		[
			episode,
			EPISODE_LABELS[episode],
			episodeArt(episode, ASSET_BASE),
		] as const,
);
// `any` is the episode's own none, so the tile must not offer a second one.
episodeTile.required = true;
randomBoostTile.options = ALL_RANDOM_BOOSTS.map(
	(boost) => [boost, RANDOM_BOOST_LABELS[boost], null] as const,
);
// Twelve and six both fit on the screen whole; a filter over a list you can
// already see is a box to tab past. Set here rather than in the markup for the
// reason `resettable` is: an attribute the markup ships is invisible to the
// property in the route's test harness.
episodeTile.searchable = false;
randomBoostTile.searchable = false;
actionChips.options = pairs(ALL_ACTIONS, ACTION_LABELS);

// The one row left whose first option is a none of its own: clicking the chip
// already picked goes back to it. Set here rather than in the markup because
// it is the same decision as putting that option first, which happens here.
actionChips.resettable = true;
orderChips.options = ORDER_OPTIONS;

boostCards.options = ALL_BOOSTS.map(
	(boost) => [boost, BOOST_LABELS[boost], boostArt(boost, ASSET_BASE)] as const,
);
// The board's own heading already says "Cookie power+", so the fieldset keeps
// the name for a screen reader and hands the screen back to the heading. Set
// here rather than in the markup for the reason `resettable` is: an attribute
// the markup ships is invisible to the property in the route's test harness.
cookiePowerCards.legendHidden = true;
cookiePowerCards.options = ALL_COOKIE_POWERS.map(
	(power) =>
		[
			power,
			COOKIE_POWER_LABELS[power],
			cookiePowerArt(power, ASSET_BASE),
		] as const,
);

const cookieOptions = tileOptions("cookies");

cookieTile.options = cookieOptions;
relayTile.options = cookieOptions;
petTile.options = tileOptions("pets");
for (const slot of treasureSlots) slot.options = treasureCatalog;

buildForm.addEventListener("input", () => {
	render();
});

codeBar.addEventListener("code-draft", (event) => {
	readDraft((event as CustomEvent<string>).detail);
});

// Leaving the editor without a usable code puts the built one back, since that
// is the code the controls still describe.
codeBar.addEventListener("code-cancel", () => {
	codeBar.message = "";
	codeBar.invalid = false;
	render();
});

codeBar.addEventListener("slot-jump", (event) => {
	jumpTo((event as CustomEvent<string>).detail);
});

/**
 * A code arriving from the clipboard is the commonest way one arrives at all —
 * someone sent it — so it does not need the editor opened first. Anything that
 * is not a code is left alone for the browser to paste wherever it was going.
 */
document.addEventListener("paste", (event) => {
	if (isTyping()) return;

	const text = (event as ClipboardEvent).clipboardData
		?.getData("text")
		?.trim()
		.toUpperCase();
	if (text === undefined || text === "") return;

	try {
		const { warnings } = decodeFull(text);
		applyCode(text, warnings);
		codeBar.message = "Code pasted.";
		codeBar.invalid = false;
		event.preventDefault();
	} catch {
		// Not a code. The browser can have it.
	}
});

/**
 * A link that differs from the open page only by its hash does not reload it,
 * so someone pasting a code into the address bar of an open tab would otherwise
 * see nothing happen — and then watch the page overwrite their hash on the next
 * click. The page's own writes go through `replaceState`, which fires no
 * `hashchange`, so everything heard here came from outside.
 */
window.addEventListener("hashchange", () => {
	const code = codeInHash(location.hash);
	if (code === null || code === codeBar.value) return;

	try {
		const { warnings } = decodeFull(code);
		applyCode(code, warnings);
	} catch {
		// Someone else's fragment, or a typo. The build stands.
	}
});

copyLinkButton.addEventListener("click", () => {
	void navigator.clipboard
		.writeText(location.href)
		.then(() => {
			setStatus(linkStatus, "");
			confirmOn(copyLinkButton);
		})
		.catch(() => {
			setStatus(
				linkStatus,
				"The browser blocked the clipboard. Copy the address bar by hand.",
				true,
			);
		});
});

// What the controls say before anyone touches them, captured before a link or a
// remembered code overwrites them — that is what Reset goes back to.
const DEFAULT_CODE = encodeFull({ loadout: readLoadout(), combi: readForm() });

resetButton.addEventListener("click", () => {
	codeBar.editing = false;
	codeBar.message = "";
	codeBar.invalid = false;
	applyCode(DEFAULT_CODE);
	setStatus(linkStatus, "");
});

/**
 * A code in the link wins over the one left from last time; neither is trusted,
 * since both outlive the page that wrote them and a link can be typed by hand.
 */
const opening = startingCode(location.hash, localStorage);
if (opening !== null) {
	try {
		applyCode(opening);
	} catch {
		render();
	}
} else {
	render();
}
