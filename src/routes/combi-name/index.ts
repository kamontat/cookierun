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
	ALL_MODES,
	ALL_RANDOM_BOOSTS,
	AUTO_GOALS,
	type Boost,
	CODE_LENGTH,
	type Combi,
	type CookiePower,
	type Episode,
	type Goal,
	limitsOf,
	MANUAL_GOALS,
	type Mode,
	type RandomBoost,
	SOLO_GOAL,
} from "./codec";
import { describeBuild, describeRun } from "./describe";
import { attachResize } from "./drawer-width";
import {
	combiSectionOf,
	decodeFull,
	encodeFull,
	type FullCode,
	isSemiAutoBuild,
	SECTION_SEPARATOR,
} from "./full-code";
import { hintsFor } from "./hints";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	GOAL_LABELS,
	MODE_LABELS,
	RANDOM_BOOST_LABELS,
} from "./labels";
import { type Loadout, treasurePick } from "./loadout";
import {
	clearSaved,
	descriptionTitle,
	facetValues,
	filterSaved,
	formatSaved,
	importSaved,
	isFiltering,
	parseSaved,
	RUN_FACETS,
	type RunFacet,
	readSaved,
	rememberSort,
	removeSaved,
	SAVED_SORT_LABELS,
	SAVED_SORTS,
	type SavedCode,
	type SavedFilter,
	type SavedSort,
	saveCode,
	sortSaved,
	storedSort,
	updateSaved,
} from "./saved";
import {
	codeInHash,
	hashFor,
	noteInHash,
	rememberCode,
	rememberFullCode,
	rememberTab,
	shareHashFor,
	startingCode,
	statsInHash,
	storedFullCode,
	storedTab,
	TAB_NAMES,
	type TabName,
} from "./state";
import {
	formatStat,
	isEmptyStats,
	parseStat,
	putStat,
	type RunStats,
	STAT_FIELDS,
	type StatField,
	type StatsDraft,
	statsSentence,
} from "./stats";
import { summaryOf } from "./summary";

import "#components/build-summary";
import "#components/card-group";
import "#components/chip-group";
import "#components/code-bar";
import "#components/entry-grid";
import "#components/entry-tiles";
import "#components/notice-bar";
import "#components/site-footer";
import "#components/site-nav";
import "#components/tab-strip";

import type { BuildSummary } from "#components/build-summary";
import type { CardGroup } from "#components/card-group";
import type { ChipGroup } from "#components/chip-group";
import type { CodeBar } from "#components/code-bar";
import type { EntryGrid } from "#components/entry-grid";
import type { EntryTiles } from "#components/entry-tiles";
import type {
	NoticeBar,
	NoticeOptions,
	NoticeType,
} from "#components/notice-bar";
import type { TabOption, TabStrip } from "#components/tab-strip";
import { lockPageScroll } from "#components/tile";

/** Exported for this route's test, which drives the page through the same lookups. */
export function need<T extends HTMLElement>(id: string): T {
	const node = document.getElementById(id);
	if (node === null) throw new Error(`the page is missing #${id}`);
	return node as T;
}

const codeBar = need<CodeBar>("code");
const summaryCard = need<BuildSummary>("summary");
const verdictLine = need("verdict");
const notice = need<NoticeBar>("notice");
const editCodeButton = need<HTMLButtonElement>("edit-code");
const copyCodeButton = need<HTMLButtonElement>("copy-code");
const fullCodeButton = need<HTMLButtonElement>("code-full");
const copyLinkButton = need<HTMLButtonElement>("copy-link");
const resetButton = need<HTMLButtonElement>("reset");
const codeMenu = need<HTMLDetailsElement>("code-menu");

const tabStrip = need<TabStrip>("tabs");
const buildForm = need<HTMLFormElement>("build");
const modeChips = need<ChipGroup>("mode");
const goalChips = need<ChipGroup>("goal");
const episodeGrid = need<EntryGrid>("episode");
const floorField = need("field-floor");
const floorInput = need<HTMLInputElement>("floor");
const boostCards = need<CardGroup>("boosts");
const randomBoostChips = need<ChipGroup>("randomBoost");
const cookiePowerCards = need<CardGroup>("cookiePowers");
const actionChips = need<ChipGroup>("action");

const cookieGrid = need<EntryGrid>("cookie");
const relayGrid = need<EntryGrid>("relay");
const petGrid = need<EntryGrid>("pet");
const rolesBox = need("roles");
const roleClear = need<HTMLButtonElement>("role-clear");
const treasureSlots = [
	need<EntryTiles>("treasure1"),
	need<EntryTiles>("treasure2"),
	need<EntryTiles>("treasure3"),
];
const orderChips = need<ChipGroup>("treasureOrder");
const relayNote = need("relay-note");

const saveForm = need<HTMLFormElement>("save-form");
const saveDescription = need<HTMLTextAreaElement>("save-description");
const codeHeading = need("code-heading");
const statInputs = Object.fromEntries(
	STAT_FIELDS.map((field) => [field, need<HTMLInputElement>(`stat-${field}`)]),
) as Record<StatField, HTMLInputElement>;
const saveButton = need<HTMLButtonElement>("save");
const saveNewButton = need<HTMLButtonElement>("save-new");
const saveCancelButton = need<HTMLButtonElement>("save-cancel");
const savedEmpty = need("saved-empty");
const savedList = need<HTMLUListElement>("saved-list");
const savedTools = need("saved-tools");
const savedSearch = need<HTMLInputElement>("saved-search");
const savedFacets: Record<RunFacet, HTMLSelectElement> = {
	mode: need<HTMLSelectElement>("saved-mode"),
	goal: need<HTMLSelectElement>("saved-goal"),
	episode: need<HTMLSelectElement>("saved-episode"),
};
const savedClear = need<HTMLButtonElement>("saved-clear");
const savedSort = need<HTMLSelectElement>("saved-sort");
const savedNoMatch = need("saved-nomatch");
const savedCount = need("saved-count");
const savedDrawer = need<HTMLDialogElement>("saved-drawer");
const deleteAll = need("delete-all");
const deleteButton = need<HTMLButtonElement>("delete-saved");
const deleteConfirm = need("delete-confirm");
const deleteQuestion = need("delete-question");
const deleteYesButton = need<HTMLButtonElement>("delete-yes");
const deleteCancelButton = need<HTMLButtonElement>("delete-cancel");
const helpDrawer = need<HTMLDialogElement>("help-drawer");

const exportCopyButton = need<HTMLButtonElement>("export-copy");
const exportDownloadButton = need<HTMLButtonElement>("export-download");
const importInput = need<HTMLTextAreaElement>("import-text");
const importButton = need<HTMLButtonElement>("import");
const importFile = need<HTMLInputElement>("import-file");

/** The fields an episode or a mode can take off the board. */
const offFields = {
	boosts: need("field-boosts"),
	randomBoost: need("field-randomBoost"),
	cookiePowers: need("field-cookiePowers"),
	action: need("field-action"),
	treasures: need("field-treasures"),
};

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
 * The same list without the kind, for the three `<entry-grid>` pickers. Nothing
 * a cookie or a pet picker holds evolves, so the kind is always null there and
 * the element has no field for one.
 *
 * Any leads the list, under the grid's own None. The two are different answers
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
		cookie: cookieGrid.value,
		relay: relayGrid.value,
		pet: petGrid.value,
		// Empty slots are not gaps in the wire format, so they drop out.
		treasures: treasureSlots
			.map((slot) => {
				const { levels } = slot;
				return slot.selected.map((id) => treasurePick(id, levels[id] ?? [0]));
			})
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
	cookieGrid.value = loadout.cookie;
	relayGrid.value = loadout.relay;
	petGrid.value = loadout.pet;
	orderChips.value = loadout.ordered ? "ordered" : "any";
	treasureSlots.forEach((slot, index) => {
		const carried = loadout.treasures[index] ?? [];
		const ids = carried.map((pick) => pick.id);
		// Options, then picks, then levels: each is a separate write, a slot
		// prunes a pick its options do not hold, and a level its picks do not.
		slot.options = treasureOptions(ids);
		slot.selected = ids;
		slot.levels = Object.fromEntries(
			carried.map((pick) => [pick.id, pick.levels]),
		);
	});
}

type Role = "cookie" | "relay" | "pet";

const ROLES: readonly Role[] = ["cookie", "relay", "pet"];

const ROLE_NAMES: Record<Role, string> = {
	cookie: "Cookie",
	relay: "Relay",
	pet: "Pet",
};

const ROLE_GRIDS: Record<Role, EntryGrid> = {
	cookie: cookieGrid,
	relay: relayGrid,
	pet: petGrid,
};

function isRole(group: string): group is Role {
	return (ROLES as readonly string[]).includes(group);
}

/**
 * Which role the Cookies tab's one visible grid writes. Held in memory only: it
 * is where someone is looking, not part of the build.
 */
let role: Role = "cookie";

/** The build `render` last drew, which the role cards read their faces from. */
let shownFull: FullCode | null = null;

/** The role on screen: the one picked, unless the episode has no relay. */
function shownRole(episode: Episode): Role {
	return role === "relay" && !limitsOf(episode).relay ? "cookie" : role;
}

/**
 * Draws the three role cards from the code, and shows the grid of the role
 * picked. Each card is the role's face and name, or None.
 */
function showRoles(): void {
	if (shownFull === null) return;
	const { combi, loadout } = shownFull;
	const hasRelay = limitsOf(combi.episode).relay;
	const shown = shownRole(combi.episode);

	for (const each of ROLES) {
		const card = rolesBox.querySelector<HTMLButtonElement>(
			`button[data-role="${each}"]`,
		);
		if (card === null) continue;
		const off = each === "relay" && !hasRelay;
		const id = off ? null : loadout[each];
		const section = each === "pet" ? "pets" : "cookies";
		const image = id === null ? null : imageFor(section, id);

		let face: HTMLElement;
		if (image === null) {
			face = document.createElement("span");
			face.className = "placeholder";
			face.setAttribute("aria-hidden", "true");
		} else {
			const img = document.createElement("img");
			img.src = ASSET_BASE + image;
			img.alt = "";
			face = img;
		}
		const name = document.createElement("small");
		name.textContent = ROLE_NAMES[each];
		const label = document.createElement("span");
		label.className = "name";
		label.textContent = off
			? "No relay here"
			: id === null
				? "None"
				: labelFor(section, id);

		card.replaceChildren(face, name, label);
		card.disabled = off;
		card.setAttribute("aria-pressed", String(each === shown));
		ROLE_GRIDS[each].hidden = each !== shown;
	}
	roleClear.hidden = ROLE_GRIDS[shown].value === null;
}

rolesBox.addEventListener("click", (event) => {
	const card = (event.target as Element | null)?.closest<HTMLButtonElement>(
		"button[data-role]",
	);
	const picked = card?.getAttribute("data-role") ?? "";
	if (card === null || card === undefined || card.disabled) return;
	if (!isRole(picked)) return;
	role = picked;
	showRoles();
});

roleClear.addEventListener("click", () => {
	const shown = shownRole(currentEpisode());
	ROLE_GRIDS[shown].value = null;
	render();
	// Clear hides itself once the role is empty, and a hidden button drops
	// focus to <body>; the card for the role just emptied is where it lands.
	rolesBox
		.querySelector<HTMLButtonElement>(`button[data-role="${shown}"]`)
		?.focus();
});

const FLOOR_MAX = 100;

/**
 * The floor box as the codec takes it: empty, or anything that is not a floor
 * yet, is any floor, and a number past either end is held to it.
 */
function readFloor(): number | null {
	const floor = Number.parseInt(floorInput.value, 10);
	if (Number.isNaN(floor) || floor < 1) return null;
	return Math.min(floor, FLOOR_MAX);
}

function readForm(): Combi {
	return {
		goals: goalChips.values as Goal[],
		mode: modeChips.value as Mode,
		// The grid offers no None of its own — `any` is the episode's — so the
		// fallback is a type-level one and never a value the page can produce.
		episode: (episodeGrid.value ?? "any") as Episode,
		floor: readFloor(),
		boosts: boostCards.selected as Boost[],
		// The chips' None is "", since a chip row always holds a value.
		randomBoost:
			randomBoostChips.value === ""
				? null
				: (randomBoostChips.value as RandomBoost),
		cookiePowers: cookiePowerCards.selected as CookiePower[],
		action: actionChips.value as Action,
	};
}

function writeForm(combi: Combi): void {
	// A semi-auto code lands on the Auto chip: semi-auto is what the flag slots
	// make of an auto run, not a mode anyone picks, so there is no chip for it.
	modeChips.value = combi.mode === "semiauto" ? "auto" : combi.mode;
	goalChips.values = combi.goals;
	episodeGrid.value = combi.episode;
	floorInput.value = combi.floor === null ? "" : String(combi.floor);
	randomBoostChips.value = combi.randomBoost ?? "";
	actionChips.value = combi.action;
	boostCards.selected = combi.boosts;
	cookiePowerCards.selected = combi.cookiePowers;
}

/**
 * Whether the banner is showing something about the code on screen — a decode
 * warning or error, typing progress, a paste, a copy of the code or its link.
 * Those answer a question about that code, so the next build change clears
 * them; everything else (a save, a delete, an import) stays until it is
 * dismissed, replaced, or, for info, times out.
 */
let aboutCode = false;

/** Puts a message in the banner, the page's one place for one. */
function say(
	type: NoticeType,
	text: string | readonly string[],
	options?: NoticeOptions,
): void {
	notice.show(type, text, options);
	aboutCode = false;
}

/** The same, for a message about the code on screen. */
function sayAboutCode(
	type: NoticeType,
	text: string | readonly string[],
	options?: NoticeOptions,
): void {
	notice.show(type, text, options);
	aboutCode = true;
}

/** Takes down a message that is not about the code. */
function unsay(): void {
	if (!aboutCode) notice.clear();
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

/**
 * A code read with changes says what changed; a build change otherwise takes
 * down whatever the banner said about the code before it.
 */
function showWarnings(warnings: readonly string[]): void {
	if (warnings.length > 0) {
		sayAboutCode("warn", warnings, { title: "Read with changes" });
	} else if (aboutCode) {
		notice.clear();
		aboutCode = false;
	}
}

/**
 * The sentence under the mode chips: why an auto run needs a hand, or that it
 * needs none. A manual run is played by hand anyway, so it says nothing.
 */
function verdictText(full: FullCode): string {
	const verdict = describeBuild(full);
	if (verdict === null) return "";
	return verdict.semi
		? `Plays as semi-auto because of ${verdict.reasons.join(", ")}.`
		: "Plays itself all the way: full auto.";
}

/**
 * The one render. Everything the page shows is derived from the controls, so
 * every change — a chip, a card, a typed code already applied — comes back
 * through here.
 */
function render(warnings: readonly string[] = []): void {
	// Before the form is read: an auto run has no Score to aim for, so the goal
	// row has to have dropped it by the time its values are taken.
	goalChips.options = goalOptions(modeChips.value as Mode);
	const code = encodeFull({ loadout: readLoadout(), combi: readForm() });
	codeBar.value = code;

	// Read the code back so the verdict reflects the character actually written
	// into slot 1, not the type the chips still show.
	const { full } = decodeFull(code);
	const { episode } = full.combi;
	// After the value: setting it drops the old hints, which described the code
	// before this one. A run with nothing to jump to — no control owns it, or
	// its tab is off for this episode — is drawn as plain text.
	codeBar.hints = hintsFor(code).map((hint) => ({
		...hint,
		inert: !canJump(hint.group, episode),
	}));
	// A live region reads out every write, so the same words are not written
	// twice: a click that leaves the verdict as it was says nothing.
	const verdict = verdictText(full);
	if (verdictLine.textContent !== verdict) verdictLine.textContent = verdict;
	const summary = summaryOf(full, ASSET_BASE);
	summaryCard.rows = summary.rows;
	summaryCard.compact = summary.compact;
	summaryCard.hint = summary.hint;
	// The one chip that says what it is rather than what you picked: an auto run
	// with Fast Start, a random boost, an action or a relay is a semi-auto run,
	// and the chip reading Auto beside a code reading H is the disagreement the
	// page exists to prevent.
	modeChips.options = modeOptions(isSemiAutoBuild(full));
	showLimits(full.combi);
	tabStrip.options = tabOptions(full);
	shownFull = full;
	showRoles();

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

	// A message about the code in front of you does not outlive it. The callers
	// that have something to say about the code they just applied say it after
	// this returns.
	showWarnings(warnings);
	showTab();
	markCurrent(code);
	publish(code);
}

/**
 * Takes off the board whatever the episode or the mode has no room for. The
 * controls keep what they hold — switching back to an episode that takes
 * boosts brings the same boosts back — while the code, written through
 * `normalize`, already leaves them out.
 */
function showLimits(combi: Combi): void {
	const limits = limitsOf(combi.episode);
	const episode = EPISODE_LABELS[combi.episode];

	floorField.hidden = !limits.floor;

	const off = (field: HTMLElement, reason: string | null): void => {
		field.toggleAttribute("data-off", reason !== null);
		const note = field.querySelector(".unavailable");
		if (note !== null) note.textContent = reason ?? "";
	};

	const noBoosts = limits.boosts ? null : `${episode} takes none.`;
	off(offFields.boosts, noBoosts);
	off(offFields.randomBoost, noBoosts);
	off(offFields.cookiePowers, noBoosts);
	off(
		offFields.treasures,
		limits.treasures ? null : `${episode} takes no treasures.`,
	);
	off(
		offFields.action,
		combi.mode === "manual" ? "Only an auto run starts with an action." : null,
	);

	relayNote.hidden = limits.relay;
	relayNote.textContent = limits.relay ? "" : `${episode} takes no relay.`;
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

	// Progress is held up for as long as the editor is open — it would
	// otherwise clear itself mid-word — and let go when it closes.
	if (canonical === "") {
		sayAboutCode("info", "Type or paste a code.", { hold: true });
		return;
	}

	const combiPart = combiSectionOf(canonical);
	if (combiPart.length !== CODE_LENGTH) {
		sayAboutCode("info", `${combiPart.length} of ${CODE_LENGTH} characters.`, {
			hold: true,
		});
		return;
	}

	try {
		const { warnings } = decodeFull(canonical);
		// `render` shows the warnings, or clears the progress line.
		applyCode(canonical, warnings);
	} catch (error) {
		sayAboutCode(
			"error",
			error instanceof Error ? error.message : String(error),
		);
	}
}

/** The saved list as the page last drew it. */
let savedEntries: readonly SavedCode[] = readSaved(localStorage);

/**
 * The entry open for editing, by its code, or null when the form adds the
 * build on screen as a new entry. Editing an entry is loading it with a promise
 * to write back: Update puts whatever the board and the box then hold into it.
 */
let editing: string | null = null;

const savedAtFormat = new Intl.DateTimeFormat(undefined, {
	dateStyle: "medium",
	timeStyle: "short",
});

/** How an entry is named in a sentence or a button's label. */
function entryName(entry: SavedCode): string {
	return entry.description === ""
		? entry.code
		: descriptionTitle(entry.description);
}

type SavedAction = "load" | "copy" | "share" | "delete";

/**
 * Whether the browser has a share sheet. Asked each time the list is drawn
 * rather than once, so it is the browser's answer and not a guess cached at
 * load. Without one, Share could only do what Copy link already does, so the
 * row does not offer it.
 */
function canShare(): boolean {
	return typeof navigator.share === "function";
}

function savedButton(
	label: string,
	action: SavedAction,
	entry: SavedCode,
): HTMLButtonElement {
	const button = document.createElement("button");
	button.type = "button";
	button.setAttribute("data-action", action);
	button.setAttribute("data-code", entry.code);
	button.setAttribute("aria-label", `${label} ${entryName(entry)}`);
	button.textContent = label;
	return button;
}

/**
 * Everything a row does besides Load, behind one button. A `<details>` rather
 * than a hand-rolled popup: it opens and closes from the keyboard and tells a
 * screen reader its state with nothing written for it. What the platform does
 * not do — close on a pick, on Escape, on a click elsewhere, or when another
 * menu opens — is wired once on the document, below, for these and the code
 * panel's menu alike.
 */
function savedMenu(entry: SavedCode): HTMLDetailsElement {
	const menu = document.createElement("details");
	menu.className = "more";
	const summary = document.createElement("summary");
	summary.className = "moretoggle";
	summary.setAttribute("aria-label", `More for ${entryName(entry)}`);
	const dots = document.createElement("span");
	dots.setAttribute("aria-hidden", "true");
	dots.textContent = "⋯";
	summary.append(dots);

	const items = document.createElement("div");
	items.className = "menu";
	items.append(savedButton("Copy link", "copy", entry));
	if (canShare()) items.append(savedButton("Share", "share", entry));
	items.append(savedButton("Delete", "delete", entry));

	menu.append(summary, items);
	return menu;
}

function closeMenus(except: Element | null = null): void {
	for (const menu of document.querySelectorAll<HTMLDetailsElement>(
		"details.more[open]",
	)) {
		if (menu !== except) menu.open = false;
	}
}

// `toggle` does not bubble, so the document hears it in the capture phase.
document.addEventListener(
	"toggle",
	(event) => {
		const menu = event.target as Element;
		if (
			menu instanceof HTMLDetailsElement &&
			menu.matches("details.more") &&
			menu.open
		) {
			closeMenus(menu);
		}
	},
	true,
);

document.addEventListener("keydown", (event) => {
	if (event.key !== "Escape") return;
	const menu = (event.target as Element | null)?.closest<HTMLDetailsElement>(
		"details.more[open]",
	);
	if (menu === null || menu === undefined) return;
	event.preventDefault();
	menu.open = false;
	menu.querySelector("summary")?.focus();
});

document.addEventListener("click", (event) => {
	const target = event.target as Element | null;
	closeMenus(target?.closest("details.more") ?? null);
});

// A pick from the code panel's menu is the menu's answer; it closes behind it.
// The pick's own handler has run by now (this listens on an ancestor), so a
// handler that sent focus somewhere — Cancel, to the note — keeps it there;
// otherwise focus would go down with the hidden button, to <body>, and the
// menu's toggle takes it instead.
codeMenu.addEventListener("click", (event) => {
	if (!(event.target as Element | null)?.closest(".menu button")) return;
	codeMenu.open = false;
	const focused = document.activeElement;
	const dropped =
		focused === null ||
		focused === document.body ||
		codeMenu.querySelector(".menu")?.contains(focused) === true;
	if (dropped) codeMenu.querySelector("summary")?.focus();
});

/**
 * What a saved row plays, as chips: the code itself means nothing at a glance,
 * so the row reads it instead. A code a later format cannot read says so, and
 * Load is where it says why.
 */
function runChips(code: string): HTMLUListElement {
	const list = document.createElement("ul");
	list.className = "run";
	list.setAttribute("aria-label", "Run");
	let chips: string[];
	try {
		chips = describeRun(decodeFull(code).full);
	} catch {
		chips = ["Code no longer reads"];
	}
	list.append(
		...chips.map((text) => {
			const chip = document.createElement("li");
			chip.textContent = text;
			return chip;
		}),
	);
	return list;
}

function optionOf(value: string, label: string): HTMLOptionElement {
	const option = document.createElement("option");
	option.value = value;
	option.textContent = label;
	return option;
}

savedSort.replaceChildren(
	...SAVED_SORTS.map((sort) => optionOf(sort, SAVED_SORT_LABELS[sort])),
);
savedSort.value = storedSort(localStorage);

const FACET_ALL: Readonly<Record<RunFacet, string>> = {
	mode: "All modes",
	goal: "All goals",
	episode: "All episodes",
};

/**
 * Rewrites each facet's choices from the list as it now stands. A value the
 * list no longer holds goes, and the filter on it with it, rather than
 * narrowing to rows that cannot come back.
 */
function writeFacets(entries: readonly SavedCode[]): void {
	for (const facet of RUN_FACETS) {
		const select = savedFacets[facet];
		const values = facetValues(entries, facet);
		const kept = values.includes(select.value) ? select.value : "";
		select.replaceChildren(
			optionOf("", FACET_ALL[facet]),
			...values.map((value) => optionOf(value, value)),
		);
		select.value = kept;
	}
}

function clearFilter(): void {
	savedSearch.value = "";
	for (const facet of RUN_FACETS) savedFacets[facet].value = "";
}

function currentFilter(): SavedFilter {
	return {
		text: savedSearch.value,
		mode: savedFacets.mode.value,
		goal: savedFacets.goal.value,
		episode: savedFacets.episode.value,
	};
}

/**
 * Draws the saved list from scratch, narrowed by the filter and in the order
 * Sort by asks for. It is short and changes only on a click or a keystroke in
 * the search, so there is nothing to gain from patching it in place.
 * `savedEntries` keeps the whole list in its stored order.
 */
function showSaved(entries: readonly SavedCode[]): void {
	savedEntries = entries;
	savedCount.textContent = String(entries.length);
	savedEmpty.hidden = entries.length > 0;
	// With one row or none there is nothing to narrow or order, and a filter
	// left on behind hidden tools could hide the last row with no way back.
	savedTools.hidden = entries.length < 2;
	if (savedTools.hidden) clearFilter();
	writeFacets(entries);
	const filter = currentFilter();
	savedClear.hidden = !isFiltering(filter);
	const shown = filterSaved(entries, filter);
	savedNoMatch.hidden = entries.length === 0 || shown.length > 0;
	// The question names a count, so a list that changed under it is asked
	// about afresh.
	deleteAll.hidden = entries.length === 0;
	askDelete(false);
	savedList.replaceChildren(
		...sortSaved(shown, savedSort.value as SavedSort).map((entry) => {
			const item = document.createElement("li");
			item.setAttribute("data-code", entry.code);

			const text = document.createElement("div");
			text.className = "entry";
			// The run first, what it brought home next, and the note last; a
			// row with no note or no stats simply has no such line.
			text.append(runChips(entry.code));
			const sentence = statsSentence(entry.stats ?? {});
			if (sentence !== "") {
				const stats = document.createElement("span");
				stats.className = "stats";
				stats.textContent = sentence;
				text.append(stats);
			}
			if (entry.description !== "") {
				const description = document.createElement("span");
				description.className = "description";
				description.textContent = entry.description;
				text.append(description);
			}
			const time = document.createElement("time");
			const when = new Date(entry.savedAt);
			time.dateTime = when.toISOString();
			time.textContent = `Saved ${savedAtFormat.format(when)}`;

			// When it was saved rides with the buttons, ahead of Load, so the
			// entry's own lines are only what the run is.
			const buttons = document.createElement("div");
			buttons.className = "buttons";
			buttons.append(
				time,
				savedButton("Load", "load", entry),
				savedMenu(entry),
			);

			item.append(text, buttons);
			return item;
		}),
	);
	markCurrent(codeBar.value);
}

/**
 * Marks the saved entry, if any, that holds the code on screen, and the one
 * open for editing — which, once the board has moved, is a different entry or
 * none, so the two marks are kept apart.
 */
function markCurrent(code: string): void {
	for (const item of savedList.children) {
		const current = item.getAttribute("data-code") === code;
		item.setAttribute("aria-current", String(current));
		item.toggleAttribute(
			"data-editing",
			item.getAttribute("data-code") === editing,
		);
	}
	showEditing(code);
}

/**
 * Puts the form in step with `editing`: one form, two jobs. While an entry is
 * open the submit button rewrites it and the code panel's heading says so, so
 * whether this is a new code or a saved one is the first thing the panel
 * reads; the banner has already named the entry, so nothing repeats it.
 *
 * Save as new shows only while `code` is one no entry holds: the list keeps
 * each code once, so saving a saved code "as new" would overwrite that entry.
 */
function showEditing(code: string): void {
	const open =
		editing !== null && savedEntries.some((saved) => saved.code === editing);
	if (!open) editing = null;

	saveNewButton.hidden =
		!open || savedEntries.some((saved) => saved.code === code);
	saveCancelButton.hidden = !open;
	saveButton.textContent = open ? "Update" : "Save";
	codeHeading.textContent = open ? "Editing saved code" : "New code";
	codeHeading.toggleAttribute("data-editing", open);
}

/** Fills the stat boxes, or empties them for `{}`. */
function writeStats(stats: RunStats): void {
	for (const field of STAT_FIELDS) {
		const value = stats[field];
		statInputs[field].value = value === undefined ? "" : formatStat(value);
		statInputs[field].removeAttribute("aria-invalid");
	}
}

/**
 * Reads the stat boxes. Every box that does not read is marked, the first is
 * focused, each is named in the banner, and nothing is returned: a save or a
 * link with a stat silently dropped would be something other than what was
 * typed.
 */
function readStats(): RunStats | null {
	const stats: StatsDraft = {};
	const errors: string[] = [];
	let first: HTMLInputElement | null = null;
	for (const field of STAT_FIELDS) {
		const input = statInputs[field];
		const parsed = parseStat(field, input.value);
		if (parsed.ok) {
			input.removeAttribute("aria-invalid");
			putStat(stats, field, parsed.value);
		} else {
			input.setAttribute("aria-invalid", "true");
			first ??= input;
			errors.push(parsed.error);
		}
	}
	if (first === null) return stats;
	first.focus();
	if (errors.length === 1) say("error", errors[0] ?? "");
	else say("error", errors, { title: `${errors.length} stats do not read` });
	return null;
}

for (const input of Object.values(statInputs)) {
	input.addEventListener("input", () => {
		input.removeAttribute("aria-invalid");
	});
}

/** Empties the note and the stat boxes under it. */
function clearNote(): void {
	saveDescription.value = "";
	writeStats({});
}

/** Closes the entry open for editing, and clears the boxes it filled. */
function stopEditing(): void {
	editing = null;
	clearNote();
	markCurrent(codeBar.value);
}

const REFUSED_SAVE =
	"The browser refused to store it. It is listed for this visit only.";

function saveAsNew(): void {
	const stats = readStats();
	if (stats === null) return;
	const code = codeBar.value;
	const { entries, stored } = saveCode(localStorage, code, {
		description: saveDescription.value,
		stats,
	});
	// The new entry opens on its code, note and stats as typed, the way an
	// Update leaves one, so a second change is one more Update.
	editing = code;
	showSaved(entries);
	if (stored) {
		say("info", `Saved ${code}.`);
	} else {
		say("error", REFUSED_SAVE);
	}
}

function updateEntry(from: string): void {
	const stats = readStats();
	if (stats === null) return;
	const code = codeBar.value;
	const result = updateSaved(localStorage, from, {
		code,
		description: saveDescription.value,
		stats,
	});

	if (!result.ok) {
		if (result.reason === "missing") {
			// Deleted in another tab since it was opened. Nothing left to update.
			showSaved(result.entries);
			stopEditing();
			say("warn", "That entry is gone. Save adds it again.");
			return;
		}
		const other = result.entries.find((saved) => saved.code === code);
		say(
			"error",
			`This build is already saved as ${other === undefined ? code : entryName(other)}. Change the build, or delete that entry first.`,
		);
		return;
	}

	// The entry stays open on its new code, note and stats as typed, so a
	// second change is one more Update rather than a Load.
	editing = code;
	showSaved(result.entries);
	const updated = result.entries.find((saved) => saved.code === code);
	if (result.stored) {
		say(
			"info",
			`Updated ${updated === undefined ? code : entryName(updated)}.`,
		);
	} else {
		say("error", REFUSED_SAVE);
	}
}

saveForm.addEventListener("submit", (event) => {
	event.preventDefault();
	if (editing === null) saveAsNew();
	else updateEntry(editing);
});

saveNewButton.addEventListener("click", () => {
	saveAsNew();
	// The code is saved now, so Save as new hides behind its own click; Save beside
	// it takes focus rather than letting it fall to <body>.
	if (saveNewButton.hidden) saveButton.focus();
});

saveCancelButton.addEventListener("click", () => {
	stopEditing();
	unsay();
	saveDescription.focus();
});

// A description takes line breaks, so Enter is a new line and Ctrl+Enter (or
// Cmd+Enter) is the shortcut for the button beside it; in a stat box Enter
// alone submits, as it does in any one-line field. Escape backs out of an
// edit the way it backs out of the code editor, from any box in the form.
saveForm.addEventListener("keydown", (event) => {
	if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
		event.preventDefault();
		saveForm.requestSubmit();
	} else if (event.key === "Escape" && editing !== null) {
		event.preventDefault();
		stopEditing();
		unsay();
	}
});

/**
 * Applies a saved code and hands back what it was read with, or says it no
 * longer reads and hands back null.
 */
function openSaved(code: string): readonly string[] | null {
	try {
		const { warnings } = decodeFull(code);
		codeBar.editing = false;
		applyCode(code, warnings);
		return warnings;
	} catch (error) {
		// The drawer stays open on a failed Load, and the banner is in it.
		say(
			"error",
			`${code} no longer reads: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}

/** The page's own address with a hash that carries a code, its note and stats. */
function shareLink(entry: SavedCode): string {
	const page = location.href.split("#")[0] ?? "";
	return `${page}${shareHashFor(entry.code, entry.description, entry.stats)}`;
}

/**
 * The share sheet, where someone sending a build to a friend on a phone
 * expects to end up. Only offered where the browser has one (`canShare`).
 * Cancelling the sheet is not a failure worth a sentence.
 */
function shareEntry(entry: SavedCode): void {
	const text = entry.description === "" ? {} : { text: entry.description };
	void navigator
		.share({ title: entryName(entry), ...text, url: shareLink(entry) })
		.catch(() => {});
}

/** Copy link: the link alone, to the clipboard, wherever the browser is. */
function copyEntryLink(entry: SavedCode): void {
	const url = shareLink(entry);
	void navigator.clipboard
		.writeText(url)
		// The menu the button sits in has closed by now, so the word goes in
		// the banner, which is in the drawer while it is open.
		.then(() => {
			say("info", `Copied the link to ${entryName(entry)}.`);
		})
		.catch(() => {
			say("error", `The browser blocked the clipboard. The link is ${url}`);
		});
}

savedList.addEventListener("click", (event) => {
	const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
		"button[data-action]",
	);
	if (button === null || button === undefined) return;
	const code = button.getAttribute("data-code") ?? "";
	const entry = savedEntries.find((saved) => saved.code === code);
	// Where the row sits on screen, which a sort may make other than its
	// place in the stored list.
	const index = [...savedList.children].findIndex(
		(row) => row.getAttribute("data-code") === code,
	);
	if (entry === undefined) return;
	const action = button.getAttribute("data-action") as SavedAction;
	// A pick from a row's menu is the menu's answer; it closes behind it.
	const menu = button.closest<HTMLDetailsElement>("details.more");
	if (menu !== null) menu.open = false;

	if (action === "load") {
		// Loading opens the entry too: there used to be an Edit beside Load, and
		// the two differed only in whether a later save wrote back. The box now
		// asks that question itself — Update or Save as new — so one action
		// serves both. Focus goes back to the Saved button with the closing
		// drawer, not to the note: someone who only wanted the build has not
		// asked to type.
		editing = code;
		const warnings = openSaved(code);
		if (warnings === null) {
			stopEditing();
			return;
		}
		// Closed first, so the build it loaded and the note it filled are what
		// is on screen. The banner comes home at once rather than on the close
		// event, so what follows is announced from the page and not from the
		// dialog on its way out.
		savedDrawer.close();
		bringNoticeHome();
		saveDescription.value = entry.description;
		writeStats(entry.stats ?? {});
		// A code read with changes keeps its warning up (render put it there):
		// it says more than "loaded" does. Otherwise "Loaded" replaces whatever
		// was showing, a stale warning about something else included.
		if (warnings.length === 0) say("info", `Loaded ${entryName(entry)}.`);
		return;
	}

	if (action === "copy") {
		copyEntryLink(entry);
		return;
	}

	if (action === "share") {
		shareEntry(entry);
		return;
	}

	if (editing === code) {
		editing = null;
		clearNote();
	}
	const { entries, stored } = removeSaved(localStorage, code);
	showSaved(entries);
	if (stored) {
		say("info", `Deleted ${code}.`);
	} else {
		say(
			"error",
			"The browser refused to store the change. It is gone for this visit only.",
		);
	}
	// Focus takes the gone entry's place, or falls back to the drawer's Close
	// button: the note that adds one sits behind the modal.
	// Counted on screen: a filter may show fewer rows than the list holds.
	const loads = savedList.querySelectorAll<HTMLButtonElement>(
		'button[data-action="load"]',
	);
	const next = loads[Math.min(index, loads.length - 1)];
	(
		next ?? savedDrawer.querySelector<HTMLButtonElement>("[data-close]")
	)?.focus();
});

savedSort.addEventListener("change", () => {
	rememberSort(localStorage, savedSort.value as SavedSort);
	showSaved(savedEntries);
});

// The filter is for this look at the list only, so unlike the sort it is not
// remembered.
savedSearch.addEventListener("input", () => showSaved(savedEntries));
for (const facet of RUN_FACETS) {
	savedFacets[facet].addEventListener("change", () => showSaved(savedEntries));
}
savedClear.addEventListener("click", () => {
	clearFilter();
	showSaved(savedEntries);
	savedSearch.focus();
});

/**
 * Swaps Delete all for its question and back. The question carries its own
 * Delete all, so the button that asked it steps aside rather than showing two.
 */
function askDelete(asking: boolean): void {
	deleteButton.hidden = asking;
	deleteConfirm.hidden = !asking;
}

// Asked on the page rather than through confirm(): a dialog the browser draws
// can be switched off, and then the question would answer itself.
deleteButton.addEventListener("click", () => {
	const count = savedEntries.length;
	deleteQuestion.textContent = `Delete all ${plural(count, "saved code")}? This cannot be undone; export them first to keep a copy.`;
	askDelete(true);
	// Focus lands on the safe answer, so a second Enter keeps the list.
	deleteCancelButton.focus();
});

deleteCancelButton.addEventListener("click", () => {
	askDelete(false);
	deleteButton.focus();
});

deleteYesButton.addEventListener("click", () => {
	const count = savedEntries.length;
	if (editing !== null) {
		editing = null;
		clearNote();
	}
	const { entries, stored } = clearSaved(localStorage);
	showSaved(entries);
	if (stored) {
		say("info", `Deleted all ${plural(count, "saved code")}.`);
	} else {
		say(
			"error",
			"The browser refused to store the change. They are gone for this visit only.",
		);
	}
	// The button that was pressed is hidden now, and so is everything around
	// it; Close is what is left to press.
	savedDrawer.querySelector<HTMLButtonElement>("[data-close]")?.focus();
});

/** Undoes `lockPageScroll` for whichever drawer is open, if one is. */
let unlockPage: (() => void) | null = null;

/**
 * Where the banner lives while no drawer is open: inside the sticky code
 * panel, right after the code bar. Looked up rather than assumed, so the
 * markup decides.
 */
const noticeHome = notice.previousElementSibling;

/**
 * Opens a drawer as a modal sheet and holds the page still behind it. A modal
 * makes everything behind it inert, the banner included, so the same banner
 * goes into the drawer's sheet, under its header, and comes back on close —
 * one notification area, always the one in view.
 */
function openDrawer(dialog: HTMLDialogElement): void {
	if (dialog.open) return;
	dialog.showModal();
	// Moving an element disconnects and reconnects it; <notice-bar> restarts an
	// info message's timer on reconnect, so a message carried in still goes.
	dialog.querySelector(".sheet > header")?.after(notice);
	unlockPage ??= lockPageScroll();
}

/** Puts the banner back in the code panel. */
function bringNoticeHome(): void {
	if (noticeHome !== null && notice.previousElementSibling !== noticeHome) {
		noticeHome.after(notice);
	}
}

for (const drawer of [savedDrawer, helpDrawer]) {
	const handle = drawer.querySelector<HTMLElement>(":scope > .resize");
	if (handle !== null) attachResize(drawer, handle, localStorage);

	// Which element the press itself landed on. A click fires on the nearest
	// common ancestor of the press and the release, so a drag that starts in
	// the sheet and ends past its edge targets the dialog just as a backdrop
	// click does; only a press that also started there is a dismiss.
	let pressedBackdrop = false;
	drawer.addEventListener("pointerdown", (event) => {
		pressedBackdrop = event.target === drawer;
	});
	drawer.addEventListener("click", (event) => {
		const target = event.target as Element | null;
		if (target?.closest("[data-close]")) {
			drawer.close();
		} else if (pressedBackdrop && target === drawer) {
			// A native dialog does not light-dismiss; this is its backdrop click.
			drawer.close();
		}
	});
	// Escape, Close and the backdrop all pass through here. A row menu left
	// open goes too: Safari can keep focus outside the menu, so the Escape
	// that closed the drawer never reached the menu's own handler.
	drawer.addEventListener("close", () => {
		closeMenus();
		// A Delete all left asking is not still asking next time.
		askDelete(false);
		bringNoticeHome();
		unlockPage?.();
		unlockPage = null;
	});
}

need("open-saved").addEventListener("click", () => {
	openDrawer(savedDrawer);
});
need("open-help").addEventListener("click", () => {
	openDrawer(helpDrawer);
});

/*
 * The tab strip sticks under the code panel on a wide screen, and a jump has
 * to scroll clear of both, so the stylesheet needs the panel's height. It
 * changes as the code wraps and the buttons swap, so it is measured rather
 * than guessed. An enhancement only: without it the strip sticks at the top
 * and the scroll padding keeps a fixed allowance.
 */
const codePanel = codeBar.closest(".codepanel");
if (codePanel !== null && typeof ResizeObserver !== "undefined") {
	new ResizeObserver(() => {
		document.documentElement.style.setProperty(
			"--codepanel-h",
			`${codePanel.getBoundingClientRect().height}px`,
		);
	}).observe(codePanel);
}

/*
 * On a phone the code panel is not pinned, so once it scrolls out of view a
 * floating button offers the way back. The stylesheet keeps the button off a
 * wide screen, where the panel never leaves; this only says whether the panel
 * is in view. Without IntersectionObserver the button simply never shows.
 */
const toTop = need<HTMLButtonElement>("to-top");
if (codePanel !== null && typeof IntersectionObserver !== "undefined") {
	new IntersectionObserver(([entry]) => {
		toTop.hidden = entry?.isIntersecting ?? true;
	}).observe(codePanel);
}
toTop.addEventListener("click", () => {
	const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	window.scrollTo({ top: 0, behavior: still ? "auto" : "smooth" });
	// The button hides once the panel is back in view, and focus would go
	// down with it; the panel's Save is where a keyboard picks up again.
	saveButton.focus({ preventScroll: true });
});

/**
 * A link someone sent may carry a note and run stats. They are offered, not
 * saved: they go into the boxes, and keeping them is one click on Save — a
 * link that filled someone's list on its own would be a link nobody dared
 * follow.
 */
function offerNote(
	code: string,
	note: string | null,
	stats: RunStats,
	warnings: readonly string[] = [],
): void {
	if ((note === null && isEmptyStats(stats)) || editing !== null) return;
	const saved = savedEntries.find((entry) => entry.code === code);
	let sentence: string;
	if (saved !== undefined) {
		sentence = `This link's code is already saved as ${entryName(saved)}.`;
	} else {
		saveDescription.value = note ?? "";
		writeStats(stats);
		sentence =
			note === null
				? "This link came with run stats. Save keeps them."
				: isEmptyStats(stats)
					? "This link came with a note. Save keeps it."
					: "This link came with a note and run stats. Save keeps them.";
	}
	// A code read with changes has a warning up already: the offer joins it as
	// one more line rather than replacing it, so both are seen.
	if (warnings.length > 0) {
		sayAboutCode("warn", [...warnings, sentence], {
			title: "Read with changes",
		});
	} else {
		say("info", sentence);
	}
}

function plural(count: number, word: string): string {
	return `${count} ${word}${count === 1 ? "" : "s"}`;
}

/** Reads text into the saved list and says what came of every line. */
function importText(text: string): boolean {
	const { entries: incoming, skipped } = parseSaved(text);
	const lines = skipped.map((line) => line.line).join(", ");
	const skippedNote =
		skipped.length === 0
			? ""
			: ` Skipped line${skipped.length === 1 ? "" : "s"} ${lines}.`;

	if (incoming.length === 0) {
		if (skipped.length === 0) say("warn", "Nothing to import.");
		else say("error", `No code read.${skippedNote}`);
		return false;
	}

	const { entries, stored, added, kept } = importSaved(localStorage, incoming);
	showSaved(entries);
	const keptNote =
		kept === 0 ? "" : ` ${kept} ${kept === 1 ? "was" : "were"} already saved.`;
	if (!stored) {
		say(
			"error",
			"The browser refused to store them. They are listed for this visit only.",
		);
	} else {
		// A skipped line is something to go and look at, so it is a warning.
		say(
			skipped.length === 0 ? "info" : "warn",
			`Added ${plural(added, "code")}.${keptNote}${skippedNote}`,
		);
	}
	return true;
}

importButton.addEventListener("click", () => {
	if (importText(importInput.value)) importInput.value = "";
});

importFile.addEventListener("change", () => {
	const file = importFile.files?.[0];
	if (file === undefined) return;
	void file.text().then((text) => {
		importText(text);
		// Cleared so picking the same file again is a change the input hears.
		importFile.value = "";
	});
});

// Nothing failed when there is nothing to move, so these are warnings: error
// is kept for what the browser or a code refused.
const NOTHING_TO_EXPORT = "Nothing saved to export yet.";

exportCopyButton.addEventListener("click", () => {
	if (savedEntries.length === 0) {
		say("warn", NOTHING_TO_EXPORT);
		return;
	}
	const count = savedEntries.length;
	void navigator.clipboard
		.writeText(formatSaved(savedEntries))
		.then(() => {
			say("info", `Copied ${plural(count, "code")} as text.`);
		})
		.catch(() => {
			say(
				"error",
				"The browser blocked the clipboard. Download the list instead.",
			);
		});
});

exportDownloadButton.addEventListener("click", () => {
	if (savedEntries.length === 0) {
		say("warn", NOTHING_TO_EXPORT);
		return;
	}
	const blob = new Blob([formatSaved(savedEntries)], { type: "text/plain" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = "combi-codes.txt";
	link.click();
	URL.revokeObjectURL(url);
	say("info", "Downloaded combi-codes.txt.");
});

/** Which control writes each group of characters the hints mark out. */
const OWNER: Record<string, HTMLElement> = {
	goal: goalChips,
	mode: modeChips,
	episode: episodeGrid,
	floor: floorInput,
	boosts: boostCards,
	randomBoost: randomBoostChips,
	cookiePowers: cookiePowerCards,
	action: actionChips,
	cookie: cookieGrid,
	relay: relayGrid,
	pet: petGrid,
	treasures: treasureSlots[0] as HTMLElement,
	// The code draws the treasure group as the order flag and one run per
	// slot, each jumping to its own control; the summary's one row still
	// jumps to the first slot.
	treasureOrder: orderChips,
	treasure1: treasureSlots[0] as HTMLElement,
	treasure2: treasureSlots[1] as HTMLElement,
	treasure3: treasureSlots[2] as HTMLElement,
};

/**
 * Focus lands on the host, not on the first control inside it: a page reaching
 * into a component's shadow root is the one thing the component boundary is
 * for. The host is made focusable here rather than in the markup, since it is
 * this wiring that needs it and not the page's structure.
 */
for (const element of new Set(Object.values(OWNER))) element.tabIndex = -1;

/** Which tab holds each control in `OWNER`. */
const TAB_OF: Record<string, TabName> = {
	goal: "main",
	mode: "main",
	episode: "main",
	floor: "main",
	action: "main",
	cookie: "cookies",
	relay: "cookies",
	pet: "cookies",
	treasures: "treasures",
	treasureOrder: "treasures",
	treasure1: "treasures",
	treasure2: "treasures",
	treasure3: "treasures",
	boosts: "boosts",
	randomBoost: "boosts",
	cookiePowers: "boosts",
};

/**
 * Why a tab is off for an episode, or null where it is not. The episode decides
 * what a run may carry (`limitsOf`), and a tab whose every control the code
 * would drop is a tab that hides nothing worth showing.
 */
function disabledReason(tab: TabName, episode: Episode): string | null {
	const limits = limitsOf(episode);
	const name = EPISODE_LABELS[episode];
	if (tab === "boosts" && !limits.boosts) return `${name} takes no boosts.`;
	if (tab === "treasures" && !limits.treasures) {
		return `${name} takes no treasures.`;
	}
	return null;
}

/** The episode the controls hold, which is the one the code was written with. */
function currentEpisode(): Episode {
	return (episodeGrid.value ?? "any") as Episode;
}

/**
 * Whether a group of the code leads anywhere: a control owns it, its tab is on
 * for this episode, and — for the relay — the episode takes one at all.
 */
function canJump(group: string, episode: Episode): boolean {
	const tab = TAB_OF[group];
	if (!Object.hasOwn(OWNER, group) || tab === undefined) return false;
	if (group === "relay" && !limitsOf(episode).relay) return false;
	return disabledReason(tab, episode) === null;
}

/**
 * The tab picked, as last stored. Held here as well as in storage so a browser
 * that refuses storage still keeps the pick for the visit.
 */
let chosenTab: TabName = storedTab(localStorage);

function chooseTab(tab: TabName): void {
	chosenTab = tab;
	rememberTab(localStorage, tab);
}

/**
 * Each tab's panel, by id. Not `panel-${tab}`: content blockers hide
 * `#panel-cookies` outright — EasyList Cookie and AdGuard's cookie-notice list
 * both carry it as a generic rule for consent banners — so the Cookies tab's
 * panel is named for the roles it picks instead.
 */
const PANEL_IDS: Record<TabName, string> = {
	main: "panel-main",
	cookies: "panel-roles",
	treasures: "panel-treasures",
	boosts: "panel-boosts",
};

const panels = new Map<TabName, HTMLElement>(
	TAB_NAMES.map((tab) => [tab, need(PANEL_IDS[tab])]),
);

/**
 * Shows the tab picked, or Main while the episode has that one off. The pick
 * itself is left alone, so an episode that has the tab again reopens it.
 */
function showTab(): void {
	const tab =
		disabledReason(chosenTab, currentEpisode()) === null ? chosenTab : "main";
	tabStrip.value = tab;
	for (const [name, panel] of panels) panel.hidden = name !== tab;
}

const TAB_LABELS: Record<TabName, string> = {
	main: "Main",
	cookies: "Cookies",
	treasures: "Treasures",
	boosts: "Boosts",
};

/** A count as a badge, or nothing at all for none. */
function badge(count: number): string {
	return count === 0 ? "" : String(count);
}

/** The tabs as the strip draws them, counted from the code itself. */
function tabOptions(full: FullCode): readonly TabOption[] {
	const { combi, loadout } = full;
	const limits = limitsOf(combi.episode);
	const people = [
		loadout.cookie,
		limits.relay ? loadout.relay : null,
		loadout.pet,
	].filter((id) => id !== null).length;
	const boosts = limits.boosts
		? combi.boosts.length +
			(combi.randomBoost === null ? 0 : 1) +
			combi.cookiePowers.length
		: 0;
	const badges: Record<TabName, string> = {
		main: "",
		cookies: badge(people),
		treasures: limits.treasures ? `${loadout.treasures.length}/3` : "",
		boosts: badge(boosts),
	};
	return TAB_NAMES.map(
		(tab) =>
			[
				tab,
				TAB_LABELS[tab],
				badges[tab],
				disabledReason(tab, combi.episode),
			] as const,
	);
}

tabStrip.addEventListener("tab-change", (event) => {
	const tab = (event as CustomEvent<string>).detail;
	if (!(TAB_NAMES as readonly string[]).includes(tab)) return;
	chooseTab(tab as TabName);
	showTab();
});

function jumpTo(group: string): void {
	const owner = OWNER[group];
	const tab = TAB_OF[group];
	if (owner === undefined || tab === undefined) return;
	if (!canJump(group, currentEpisode())) return;
	if (isRole(group)) {
		role = group;
		showRoles();
	}
	chooseTab(tab);
	showTab();
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
 * Every mode but semi-auto. That one is derived, not chosen: `encode` writes
 * slot 1 from the flag slots — Fast Start, a random boost, a jump action — so
 * an auto run becomes semi-auto by what else is on, and a chip for it could
 * only disagree with the code. The codec still knows the value, and a code
 * carrying `S` or `J` still decodes to it; `writeForm` lands that on the Auto chip.
 */
const PICKABLE_MODES = ALL_MODES.filter((mode) => mode !== "semiauto");

/**
 * Every pickable mode, with the Auto chip wearing whichever of the two names
 * the build has earned. Semi-auto is still not a choice — picking it and
 * picking Auto are the same click — but the chip says which one you are on.
 */
function modeOptions(semi: boolean): readonly (readonly [string, string])[] {
	return PICKABLE_MODES.map(
		(mode) =>
			[
				mode,
				mode === "auto" && semi ? MODE_LABELS.semiauto : MODE_LABELS[mode],
			] as const,
	);
}

/**
 * The goals a mode can aim for, at least one. Score is played by hand and on
 * its own — the row's `exclusive` keeps it alone — so an auto run is offered
 * the other three, and a run aiming for Score falls to Money on the way to
 * auto, the way a chip row reads picks its options no longer hold.
 */
function goalOptions(mode: Mode): readonly (readonly [string, string])[] {
	const goals = mode === "manual" ? MANUAL_GOALS : AUTO_GOALS;
	return pairs(goals, GOAL_LABELS);
}

modeChips.options = modeOptions(false);
goalChips.options = goalOptions("manual");
goalChips.multiple = true;
goalChips.exclusive = [SOLO_GOAL];
// A set starts empty, and no code says an empty set: the page opens on a
// manual run aiming for Score.
goalChips.values = [SOLO_GOAL];
// Twelve landscape cards is a grid, not a row: an episode is a place, and the
// picture is what anyone recognises it by. `any` has no icon and falls back to
// the lettered cell the catalog pickers already use.
episodeGrid.options = ALL_EPISODES.map(
	(episode) =>
		[
			episode,
			EPISODE_LABELS[episode],
			episodeArt(episode, ASSET_BASE),
		] as const,
);
// `any` is the episode's own none, so the grid must not offer a second one.
episodeGrid.required = true;
// None first, as "": a chip row always holds a value, and this is the one the
// code writes as 0. Resettable, so clicking the chosen chip goes back to it.
randomBoostChips.options = [
	["", "None"],
	...pairs(ALL_RANDOM_BOOSTS, RANDOM_BOOST_LABELS),
];
randomBoostChips.resettable = true;
randomBoostChips.labelHidden = true;
// Twelve fit on the screen whole; a filter over a list you can already see is a
// box to tab past. Set here rather than in the markup for the reason
// `resettable` is: an attribute the markup ships is invisible to the property
// in the route's test harness.
episodeGrid.searchable = false;
actionChips.options = pairs(ALL_ACTIONS, ACTION_LABELS);

// The one row left whose first option is a none of its own: clicking the chip
// already picked goes back to it. Set here rather than in the markup because
// it is the same decision as putting that option first, which happens here.
actionChips.resettable = true;
orderChips.options = ORDER_OPTIONS;

boostCards.options = ALL_BOOSTS.map(
	(boost) => [boost, BOOST_LABELS[boost], boostArt(boost, ASSET_BASE)] as const,
);
// Every field on the board carries a heading of its own now, so each control
// keeps its name for a screen reader and hands the screen back to that
// heading. Set here rather than in the markup for the reason `resettable` is:
// an attribute the markup ships is invisible to the property in the route's
// test harness. The treasure order switch is the exception — its "Order" is
// not the field's name but a second question asked beside it.
boostCards.legendHidden = true;
cookiePowerCards.legendHidden = true;
modeChips.labelHidden = true;
goalChips.labelHidden = true;
actionChips.labelHidden = true;
// The order switch keeps its name for a screen reader and hands the screen
// back to its own two chips, which say "Any order" and "Exact order" and so
// need no word above them.
orderChips.labelHidden = true;
cookiePowerCards.options = ALL_COOKIE_POWERS.map(
	(power) =>
		[
			power,
			COOKIE_POWER_LABELS[power],
			cookiePowerArt(power, ASSET_BASE),
		] as const,
);

const cookieOptions = tileOptions("cookies");

cookieGrid.options = cookieOptions;
relayGrid.options = cookieOptions;
petGrid.options = tileOptions("pets");
// Ninety-odd cookies is a list to search, not to scan.
for (const grid of [cookieGrid, relayGrid, petGrid]) grid.searchable = true;
for (const slot of treasureSlots) slot.options = treasureCatalog;

summaryCard.addEventListener("summary-jump", (event) => {
	jumpTo((event as CustomEvent<string>).detail);
});

buildForm.addEventListener("input", () => {
	render();
});

// Enter in the floor box submits this form, and with no action to submit to
// the browser would reload the page and lose the build. Every control already
// writes the code as it changes, so a submit has nothing left to do.
buildForm.addEventListener("submit", (event) => {
	event.preventDefault();
});

codeBar.addEventListener("code-draft", (event) => {
	readDraft((event as CustomEvent<string>).detail);
});

// Leaving the editor without a usable code puts the built one back, since that
// is the code the controls still describe.
codeBar.addEventListener("code-cancel", () => {
	render();
});

// Typing progress was held up while the editor was open; however it closed,
// the line can now go on its own.
codeBar.addEventListener("code-close", () => {
	// The bar shows the built code again, so an error about a draft that never
	// applied is about nothing on screen.
	if (aboutCode && notice.type === "error") {
		notice.clear();
		aboutCode = false;
		return;
	}
	notice.release();
});

// The ✕ leaves with the message, so focus on it would fall to <body>: it goes
// to the drawer's Close when the banner is in a drawer, else to Save beside it.
notice.addEventListener("notice-dismiss", (event) => {
	if (!(event as CustomEvent<{ focused: boolean }>).detail.focused) return;
	const drawer = notice.closest("dialog");
	const target =
		drawer?.querySelector<HTMLButtonElement>("[data-close]") ?? saveButton;
	target.focus();
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
	// An open drawer makes the page behind it inert; a code pasted there would
	// change a board nobody can see.
	if (document.querySelector("dialog[open]") !== null) return;

	const text = (event as ClipboardEvent).clipboardData
		?.getData("text")
		?.trim()
		.toUpperCase();
	if (text === undefined || text === "") return;

	try {
		const { warnings } = decodeFull(text);
		applyCode(text, warnings);
		// A code read with changes keeps its warning up: it says more.
		if (warnings.length === 0) sayAboutCode("info", "Code pasted.");
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
	if (code === null) return;
	const note = noteInHash(location.hash);
	const stats = statsInHash(location.hash);
	let warnings: readonly string[] = [];

	if (code === codeBar.value) {
		// The build already stands; only a note or stats are news, and the
		// address goes back to holding the build alone once they are in the boxes.
		if (note === null && isEmptyStats(stats)) return;
		publish(code);
	} else {
		try {
			({ warnings } = decodeFull(code));
			applyCode(code, warnings);
		} catch {
			// Someone else's fragment, or a typo. The build stands.
			return;
		}
	}
	offerNote(codeBar.value, note, stats, warnings);
});

// The panel's own Edit and Copy are turned off: both live in the ⋯ menu, so
// the panel's row is Save (or Update and Save as new), Reset and the menu.
codeBar.copyable = false;
codeBar.editable = false;

editCodeButton.addEventListener("click", () => {
	codeBar.editing = true;
});

// The bar draws the ten characters the game takes and nothing before them: the
// loadout is the summary's to show, and it still rides in the link, the saves
// and the editor, which all keep the whole code. The menu swaps it to the whole
// code and back, and the choice is remembered.
function showFullCode(full: boolean): void {
	codeBar.showAfter = full ? "" : SECTION_SEPARATOR;
	fullCodeButton.setAttribute("aria-pressed", String(full));
	fullCodeButton.textContent = full ? "Show game code only" : "Show full code";
}

showFullCode(storedFullCode(localStorage));

fullCodeButton.addEventListener("click", () => {
	const full = codeBar.showAfter !== "";
	showFullCode(full);
	rememberFullCode(localStorage, full);
});

// The menu has closed by the time the clipboard answers, so both copies say
// how it went in the banner. A refusal has an instruction to give.
copyCodeButton.addEventListener("click", () => {
	// What the panel shows: the ten characters the game takes, or the whole
	// code once the menu has asked for it.
	const code =
		codeBar.showAfter === "" ? codeBar.value : combiSectionOf(codeBar.value);
	void navigator.clipboard
		.writeText(code)
		.then(() => {
			sayAboutCode("info", `Copied ${code}.`);
		})
		.catch(() => {
			sayAboutCode(
				"error",
				"The browser blocked the clipboard. Select the code and copy it by hand.",
			);
		});
});

// The link hands over what is on screen: the code, and the note and stats in
// the boxes under it — the link a saved row's Copy link makes, before saving.
copyLinkButton.addEventListener("click", () => {
	const stats = readStats();
	if (stats === null) return;
	const page = location.href.split("#")[0] ?? "";
	const url = `${page}${shareHashFor(codeBar.value, saveDescription.value, stats)}`;
	void navigator.clipboard
		.writeText(url)
		.then(() => {
			sayAboutCode("info", "Copied the link.");
		})
		.catch(() => {
			sayAboutCode(
				"error",
				`The browser blocked the clipboard. The link is ${url}`,
			);
		});
});

// What the controls say before anyone touches them, captured before a link or a
// remembered code overwrites them — that is what Reset goes back to.
const DEFAULT_CODE = encodeFull({ loadout: readLoadout(), combi: readForm() });

resetButton.addEventListener("click", () => {
	codeBar.editing = false;
	// Starting over, so Update must not stay aimed at the entry last loaded.
	if (editing !== null) stopEditing();
	applyCode(DEFAULT_CODE);
});

showSaved(savedEntries);

/**
 * A code in the link wins over the one left from last time; neither is trusted,
 * since both outlive the page that wrote them and a link can be typed by hand.
 */
const opening = startingCode(location.hash, localStorage);
// Read before the first render rewrites the hash without it.
const openingNote = noteInHash(location.hash);
const openingStats = statsInHash(location.hash);
if (opening !== null) {
	try {
		applyCode(opening);
		// A note only ever arrives in the hash, and a hash wins over storage, so
		// a note present here belongs to the code just applied.
		offerNote(codeBar.value, openingNote, openingStats);
	} catch {
		render();
	}
} else {
	render();
}
