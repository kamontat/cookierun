/// <reference lib="dom" />

import { expect, test } from "bun:test";

import {
	attachResize,
	clampWidth,
	MIN_WIDTH,
	readWidth,
	writeWidth,
} from "./drawer-width";

function memoryStorage(): Storage {
	const data = new Map<string, string>();
	return {
		get length() {
			return data.size;
		},
		clear: () => data.clear(),
		getItem: (key) => data.get(key) ?? null,
		key: (index) => [...data.keys()][index] ?? null,
		removeItem: (key) => {
			data.delete(key);
		},
		setItem: (key, value) => {
			data.set(key, value);
		},
	};
}

const refusing = {
	getItem: () => {
		throw new Error("denied");
	},
	setItem: () => {
		throw new Error("denied");
	},
	removeItem: () => {
		throw new Error("denied");
	},
};

test("a width stays between the floor and nine tenths of the window", () => {
	expect(clampWidth(100, 1200)).toBe(MIN_WIDTH);
	expect(clampWidth(500, 1200)).toBe(500);
	expect(clampWidth(5000, 1200)).toBe(1080);
	expect(clampWidth(500.6, 1200)).toBe(501);
});

test("a stored width reads back, and anything else reads as none", () => {
	const storage = memoryStorage();
	expect(readWidth(storage, "saved-drawer")).toBeNull();
	writeWidth(storage, "saved-drawer", 480);
	expect(readWidth(storage, "saved-drawer")).toBe(480);
	expect(readWidth(storage, "help-drawer")).toBeNull();
	writeWidth(storage, "saved-drawer", null);
	expect(readWidth(storage, "saved-drawer")).toBeNull();
	storage.setItem("combi-name:drawer-width:help-drawer", "wide");
	expect(readWidth(storage, "help-drawer")).toBeNull();
});

test("a browser that refuses storage still resizes, it only forgets", () => {
	expect(readWidth(refusing, "saved-drawer")).toBeNull();
	expect(() => writeWidth(refusing, "saved-drawer", 480)).not.toThrow();
});

function setUp(storage: Storage = memoryStorage()) {
	const dialog = document.createElement("dialog");
	dialog.id = "saved-drawer";
	const handle = document.createElement("div");
	dialog.append(handle);
	document.body.append(dialog);
	attachResize(dialog, handle, storage);
	return { dialog, handle, storage };
}

const width = (dialog: HTMLElement) =>
	dialog.style.getPropertyValue("--drawer-width");

test("the handle is a labelled vertical separator the keyboard can reach", () => {
	const { handle } = setUp();
	expect(handle.getAttribute("role")).toBe("separator");
	expect(handle.getAttribute("aria-orientation")).toBe("vertical");
	expect(handle.getAttribute("aria-label")).toBe("Resize panel");
	expect(handle.tabIndex).toBe(0);
});

test("a remembered width is put back when the drawer is set up", () => {
	const storage = memoryStorage();
	writeWidth(storage, "saved-drawer", 500);
	const { dialog } = setUp(storage);
	expect(width(dialog)).toBe("500px");
});

test("dragging the handle sizes the drawer from the right edge and remembers it", () => {
	const { dialog, handle, storage } = setUp();
	const right = window.innerWidth;
	handle.dispatchEvent(
		new PointerEvent("pointerdown", { clientX: right - 352, button: 0 }),
	);
	handle.dispatchEvent(
		new PointerEvent("pointermove", { clientX: right - 500 }),
	);
	expect(width(dialog)).toBe("500px");
	handle.dispatchEvent(new PointerEvent("pointerup", { clientX: right - 500 }));
	expect(readWidth(storage, "saved-drawer")).toBe(500);
	// After the release a move no longer drags.
	handle.dispatchEvent(
		new PointerEvent("pointermove", { clientX: right - 600 }),
	);
	expect(width(dialog)).toBe("500px");
});

test("arrow keys widen and narrow the drawer, and a double click forgets it", () => {
	const { dialog, handle, storage } = setUp();
	handle.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
	);
	const wider = Number.parseInt(width(dialog), 10);
	expect(wider).toBeGreaterThan(352);
	expect(handle.getAttribute("aria-valuenow")).toBe(String(wider));
	handle.dispatchEvent(
		new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
	);
	expect(Number.parseInt(width(dialog), 10)).toBeLessThan(wider);
	handle.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
	expect(width(dialog)).toBe("");
	expect(readWidth(storage, "saved-drawer")).toBeNull();
});
