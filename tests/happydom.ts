import { GlobalRegistrator } from "@happy-dom/global-registrator";
import {
	type HTMLOptionElement,
	HTMLSelectElement,
	PropertySymbol,
} from "happy-dom";

GlobalRegistrator.register();

/**
 * happy-dom bug workaround — scoped to this one method, and only here: no
 * production file works around a test-environment bug, since `tests/` is
 * where a bug in the harness itself belongs.
 *
 * `HTMLSelectElement`'s selectedness-setting algorithm recomputes from
 * scratch every time an `<option>` connects to a `<select>` one at a time
 * (https://github.com/capricorn86/happy-dom/blob/master/packages/happy-dom/src/nodes/html-select-element/HTMLSelectElement.ts,
 * the `[PropertySymbol.updateSelectedness]` method). Building a ten-option
 * `<select>` where, say, the sixth option is the one meant to be selected
 * passes through a moment where an *earlier* option is briefly selected too —
 * happy-dom's own "nothing picked yet, default to the first" rule, applied
 * before the sixth option has connected. When that sixth option then
 * connects, two options are selected for an instant, and the method's
 * "two or more selected" branch uses the *count* of selected options (always
 * 2 here) as an *index* into the option list, landing on `options[1]`
 * regardless of which option was actually marked `selected` — confirmed by
 * reproducing the bug with plain DOM calls, no Lit involved.
 *
 * Rather than re-implement that method's other branches (multiple-select
 * handling, disabled options, `size`), this wraps it: after the original
 * runs, if exactly one `<option>` carries the authored `selected` attribute
 * and the select disagrees with it, `.value` is set straight to that
 * option's value — the same direct assignment already confirmed correct
 * (it does not re-enter this method, so there is no recursion risk), and
 * the one thing every failure of the bug above has in common.
 */
const original = HTMLSelectElement.prototype[PropertySymbol.updateSelectedness];
HTMLSelectElement.prototype[PropertySymbol.updateSelectedness] = function (
	this: HTMLSelectElement,
	selectedOption?: HTMLOptionElement | null,
): void {
	original.call(this, selectedOption);
	if (this.hasAttribute("multiple")) return;
	const marked = [
		...this.querySelectorAll<HTMLOptionElement>("option[selected]"),
	];
	const [only] = marked;
	if (marked.length === 1 && only !== undefined && this.value !== only.value) {
		this.value = only.value;
	}
};
