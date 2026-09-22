import { cookiePowerArt } from "./art";
import { optionsFor } from "./catalog";
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
import { describeCombi, describeFull } from "./describe";
import { combiSectionOf, decodeFull, encodeFull } from "./full-code";
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

import "#components/card-group";
import "#components/chip-group";
import "#components/code-bar";
import "#components/entry-tile";
import "#components/entry-tiles";
import "#components/site-nav";
import "#components/verdict-line";

import type { CardGroup } from "#components/card-group";
import type { ChipGroup } from "#components/chip-group";
import type { CodeBar } from "#components/code-bar";
import type { EntryTile } from "#components/entry-tile";
import type { EntryTiles } from "#components/entry-tiles";
import type { VerdictLine } from "#components/verdict-line";

/** Exported for this route's test, which drives the page through the same lookups. */
export function need<T extends HTMLElement>(id: string): T {
	const node = document.getElementById(id);
	if (node === null) throw new Error(`the page is missing #${id}`);
	return node as T;
}

const codeBar = need<CodeBar>("code");
const verdictLine = need<VerdictLine>("verdict");
const warningList = need<HTMLUListElement>("warnings");
const copyLinkButton = need<HTMLButtonElement>("copy-link");
const resetButton = need<HTMLButtonElement>("reset");
const linkStatus = need("link-status");

const buildForm = need<HTMLFormElement>("build");
const typeChips = need<ChipGroup>("type");
const episodeChips = need<ChipGroup>("episode");
const boostCards = need<CardGroup>("boosts");
const randomBoostChips = need<ChipGroup>("randomBoost");
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
): readonly (readonly [string, string, string | null])[] {
	return optionsFor(section).map(
		([id, label, image]) =>
			[id, label, image === null ? null : ASSET_BASE + image] as const,
	);
}

const ORDER_OPTIONS = [
	["any", "Any order"],
	["ordered", "Exact order"],
] as const;

const NO_RANDOM_BOOST = "";

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

function writeLoadout(loadout: Loadout): void {
	cookieTile.value = loadout.cookie;
	relayTile.value = loadout.relay;
	petTile.value = loadout.pet;
	orderChips.value = loadout.ordered ? "ordered" : "any";
	treasureSlots.forEach((slot, index) => {
		slot.selected = loadout.treasures[index] ?? [];
	});
}

function readForm(): Combi {
	const randomBoost = randomBoostChips.value;

	return {
		type: typeChips.value as CombiType,
		episode: episodeChips.value as Episode,
		boosts: boostCards.selected as Boost[],
		randomBoost:
			randomBoost === NO_RANDOM_BOOST ? null : (randomBoost as RandomBoost),
		cookiePowers: cookiePowerCards.selected as CookiePower[],
		action: actionChips.value as Action,
	};
}

function writeForm(combi: Combi): void {
	typeChips.value = combi.type;
	episodeChips.value = combi.episode;
	randomBoostChips.value = combi.randomBoost ?? NO_RANDOM_BOOST;
	actionChips.value = combi.action;
	boostCards.selected = combi.boosts;
	cookiePowerCards.selected = combi.cookiePowers;
}

function setStatus(host: HTMLElement, text: string, isError = false): void {
	host.textContent = text;
	host.classList.toggle("error", isError);
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
 * What a field reads as when it is switched off. Such a field is left out of
 * the summary: a line that lists what you did not choose is a longer line
 * saying less.
 */
const UNSET = new Set(["None", ACTION_LABELS.none]);

/**
 * The build as one line of prose. The loadout is left out on purpose: its
 * controls show the art of whatever is picked a screen below, so repeating the
 * names here would say twice what the page already says once.
 */
function summaryOf(combi: Combi): string[] {
	return describeCombi(combi)
		.rows.filter((row) => !UNSET.has(row.value))
		.map((row) => row.value);
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
	const described = describeFull(full);
	verdictLine.summary = summaryOf(full.combi);
	verdictLine.verdict = described.auto;
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
	episode: episodeChips,
	boost1: boostCards,
	boost2: boostCards,
	boost3: boostCards,
	randomBoost: randomBoostChips,
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

typeChips.options = pairs(ALL_TYPES, TYPE_LABELS);
episodeChips.options = pairs(ALL_EPISODES, EPISODE_LABELS);
randomBoostChips.options = [
	// `as const` or this literal infers as string[] and will not assign to a
	// [value, label] tuple.
	[NO_RANDOM_BOOST, "None"] as const,
	...pairs(ALL_RANDOM_BOOSTS, RANDOM_BOOST_LABELS),
];
actionChips.options = pairs(ALL_ACTIONS, ACTION_LABELS);
orderChips.options = ORDER_OPTIONS;

// The boosts have no art of their own; their cards wear the lettered tile.
boostCards.options = ALL_BOOSTS.map(
	(boost) => [boost, BOOST_LABELS[boost], null] as const,
);
cookiePowerCards.options = ALL_COOKIE_POWERS.map(
	(power) =>
		[
			power,
			COOKIE_POWER_LABELS[power],
			cookiePowerArt(power, ASSET_BASE),
		] as const,
);

const cookieOptions = pickerOptions("cookies");
const treasureOptions = pickerOptions("treasures");

cookieTile.options = cookieOptions;
relayTile.options = cookieOptions;
petTile.options = pickerOptions("pets");
for (const slot of treasureSlots) slot.options = treasureOptions;

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
			setStatus(linkStatus, "Link copied.");
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
