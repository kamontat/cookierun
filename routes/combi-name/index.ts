import { optionsFor } from "./catalog.ts";
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
} from "./codec.ts";
import { describeFull } from "./describe.ts";
import type { FullCode } from "./full-code.ts";
import { combiSectionOf, decodeFull, encodeFull } from "./full-code.ts";
import { hintsFor } from "./hints.ts";
import {
	ACTION_LABELS,
	BOOST_LABELS,
	COOKIE_POWER_LABELS,
	EPISODE_LABELS,
	RANDOM_BOOST_LABELS,
	TYPE_LABELS,
} from "./labels.ts";
import type { Loadout } from "./loadout.ts";
import { hashFor, rememberCode, startingCode } from "./state.ts";

import "#components/auto-verdict.ts";
import "#components/check-group.ts";
import "#components/copy-code.ts";
import "#components/entry-picker.ts";
import "#components/entry-set.ts";
import "#components/labelled-select.ts";
import "#components/site-nav.ts";

import type { AutoVerdictElement } from "#components/auto-verdict.ts";
import type { CheckGroup } from "#components/check-group.ts";
import type { CopyCode } from "#components/copy-code.ts";
import type { EntryPicker } from "#components/entry-picker.ts";
import type { EntrySet } from "#components/entry-set.ts";
import type { LabelledSelect } from "#components/labelled-select.ts";

/** Exported for this route's test, which drives the page through the same lookups. */
export function need<T extends HTMLElement>(id: string): T {
	const node = document.getElementById(id);
	if (node === null) throw new Error(`the page is missing #${id}`);
	return node as T;
}

const typeSelect = need<LabelledSelect>("type");
const episodeSelect = need<LabelledSelect>("episode");
const boostsGroup = need<CheckGroup>("boosts");
const randomBoostSelect = need<LabelledSelect>("randomBoost");
const cookiePowersGroup = need<CheckGroup>("cookiePowers");
const actionSelect = need<LabelledSelect>("action");

const builderForm = need<HTMLFormElement>("builder");
const codeOutput = need<CopyCode>("code-output");
const builderVerdict = need<AutoVerdictElement>("builder-verdict");
const copyLinkButton = need<HTMLButtonElement>("copy-link");
const resetButton = need<HTMLButtonElement>("reset");
const linkStatus = need("link-status");

const codeInput = need<HTMLInputElement>("code-input");
const readerMessage = need("reader-message");
const readerRows = need<HTMLDListElement>("reader-rows");
const readerVerdict = need<AutoVerdictElement>("reader-verdict");
const readerWarnings = need<HTMLUListElement>("reader-warnings");
const loadButton = need<HTMLButtonElement>("load");

const cookiePicker = need<EntryPicker>("cookie");
const relayPicker = need<EntryPicker>("relay");
const petPicker = need<EntryPicker>("pet");
const treasureSets = [
	need<EntrySet>("treasure1"),
	need<EntrySet>("treasure2"),
	need<EntrySet>("treasure3"),
];
const orderSelect = need<LabelledSelect>("treasureOrder");
const loadoutForm = need<HTMLFormElement>("loadout");

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

function readLoadout(): Loadout {
	return {
		cookie: cookiePicker.value,
		relay: relayPicker.value,
		pet: petPicker.value,
		// Empty slots are not gaps in the wire format, so they drop out.
		treasures: treasureSets
			.map((set) => set.selected)
			.filter((slot) => slot.length > 0),
		ordered: orderSelect.value === "ordered",
	};
}

function writeLoadout(loadout: Loadout): void {
	cookiePicker.value = loadout.cookie;
	relayPicker.value = loadout.relay;
	petPicker.value = loadout.pet;
	orderSelect.value = loadout.ordered ? "ordered" : "any";
	treasureSets.forEach((set, index) => {
		set.selected = loadout.treasures[index] ?? [];
	});
}

const NO_RANDOM_BOOST = "";

function readForm(): Combi {
	const randomBoost = randomBoostSelect.value;

	return {
		type: typeSelect.value as CombiType,
		episode: episodeSelect.value as Episode,
		boosts: boostsGroup.selected as Boost[],
		randomBoost:
			randomBoost === NO_RANDOM_BOOST ? null : (randomBoost as RandomBoost),
		cookiePowers: cookiePowersGroup.selected as CookiePower[],
		action: actionSelect.value as Action,
	};
}

function writeForm(combi: Combi): void {
	typeSelect.value = combi.type;
	episodeSelect.value = combi.episode;
	randomBoostSelect.value = combi.randomBoost ?? NO_RANDOM_BOOST;
	actionSelect.value = combi.action;
	boostsGroup.selected = combi.boosts;
	cookiePowersGroup.selected = combi.cookiePowers;
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

function renderBuilder(): void {
	const code = encodeFull({ loadout: readLoadout(), combi: readForm() });
	codeOutput.value = code;
	// After the value: setting it drops the old hints, which described the code
	// before this one.
	codeOutput.hints = hintsFor(code);

	// Read the code back so the verdict reflects the character actually written
	// into slot 2, not the type the select still shows.
	const { full } = decodeFull(code);
	builderVerdict.verdict = describeFull(full).auto;
	publish(code);
}

function applyCode(code: string): void {
	const { full } = decodeFull(code);
	writeForm(full.combi);
	writeLoadout(full.loadout);
	renderBuilder();
}

function clearReader(): void {
	readerRows.replaceChildren();
	readerWarnings.replaceChildren();
	readerVerdict.verdict = null;
	loadButton.hidden = true;
}

function renderReader(): void {
	const canonical = codeInput.value.toUpperCase();
	if (codeInput.value !== canonical) {
		const caret = codeInput.selectionStart;
		codeInput.value = canonical;
		if (caret !== null) codeInput.setSelectionRange(caret, caret);
	}

	if (canonical.length === 0) {
		setStatus(readerMessage, "");
		clearReader();
		return;
	}

	const combiPart = combiSectionOf(canonical);
	if (combiPart.length !== CODE_LENGTH) {
		setStatus(
			readerMessage,
			`${combiPart.length} of ${CODE_LENGTH} characters.`,
		);
		clearReader();
		return;
	}

	let full: FullCode;
	let warnings: string[];
	try {
		({ full, warnings } = decodeFull(canonical));
	} catch (error) {
		setStatus(
			readerMessage,
			error instanceof Error ? error.message : String(error),
			true,
		);
		clearReader();
		return;
	}

	const described = describeFull(full);

	setStatus(readerMessage, "");
	readerRows.replaceChildren(
		...described.rows.flatMap(({ field, value }) => {
			const term = document.createElement("dt");
			term.textContent = field;
			const detail = document.createElement("dd");
			detail.textContent = value;
			return [term, detail];
		}),
	);
	readerWarnings.replaceChildren(
		...warnings.map((warning) => {
			const item = document.createElement("li");
			item.textContent = warning;
			return item;
		}),
	);
	readerVerdict.verdict = described.auto;
	loadButton.hidden = false;
}

/** Pairs the canonical value list with its labels, keeping the list's order. */
function pairs<K extends string>(
	values: readonly K[],
	labels: Record<K, string>,
): readonly (readonly [string, string])[] {
	return values.map((value) => [value, labels[value]] as const);
}

typeSelect.options = pairs(ALL_TYPES, TYPE_LABELS);
episodeSelect.options = pairs(ALL_EPISODES, EPISODE_LABELS);
randomBoostSelect.options = [
	// `as const` or this literal infers as string[] and will not assign to a
	// [value, label] tuple.
	[NO_RANDOM_BOOST, "None"] as const,
	...pairs(ALL_RANDOM_BOOSTS, RANDOM_BOOST_LABELS),
];
actionSelect.options = pairs(ALL_ACTIONS, ACTION_LABELS);
boostsGroup.options = pairs(ALL_BOOSTS, BOOST_LABELS);
cookiePowersGroup.options = pairs(ALL_COOKIE_POWERS, COOKIE_POWER_LABELS);

const cookieOptions = pickerOptions("cookies");
const treasureOptions = pickerOptions("treasures");

cookiePicker.options = cookieOptions;
relayPicker.options = cookieOptions;
petPicker.options = pickerOptions("pets");
for (const set of treasureSets) set.options = treasureOptions;
orderSelect.options = ORDER_OPTIONS;

builderForm.addEventListener("input", renderBuilder);
loadoutForm.addEventListener("input", renderBuilder);

codeInput.addEventListener("input", renderReader);

loadButton.addEventListener("click", () => {
	applyCode(codeInput.value);
	typeSelect.focus();
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
		renderBuilder();
	}
} else {
	renderBuilder();
}

renderReader();
