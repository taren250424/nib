import { afterEach, describe, expect, it, vi } from "vitest"

import { FocusManager } from "@renderer/core/FocusManager"
import { UI_ZONES } from "@renderer/core/types/ui_zones"

/**
 * Stands in for document.activeElement. `zones` are the selectors the element
 * would match via closest(), i.e. the zones it sits inside.
 */
function focusElementIn(...zones: string[]) {
	const element = { closest: (selector: string) => (zones.includes(selector) ? element : null) }
	vi.stubGlobal("document", { activeElement: element })
}

function focusNothing() {
	vi.stubGlobal("document", { activeElement: null })
}

afterEach(() => {
	vi.unstubAllGlobals()
})

describe("FocusManager.getFocusedTask", () => {
	it("reports the task of the zone the focused element sits in", () => {
		focusElementIn(UI_ZONES.SIDE.dom)
		expect(new FocusManager().getFocusedTask()).toBe("tree")
	})

	// The find widget is listed before the editor so it wins when both match.
	it("prefers the more specific of two matching zones", () => {
		focusElementIn(UI_ZONES.FIND_REPLACE_CONTAINER.dom, UI_ZONES.EDITOR_CONTAINER.dom)
		expect(new FocusManager().getFocusedTask()).toBe("find-replace")
	})

	it("keeps the stored task for zones that carry none", () => {
		const focusManager = new FocusManager()
		focusManager.setFocusedTask("tree")

		focusElementIn(UI_ZONES.MENU_ITEM.dom)
		expect(focusManager.getFocusedTask()).toBe("tree")
	})

	it("falls back to the stored task when nothing is focused", () => {
		const focusManager = new FocusManager()
		focusManager.setFocusedTask("editor")

		focusNothing()
		expect(focusManager.getFocusedTask()).toBe("editor")
	})
})

describe("FocusManager.syncFocus", () => {
	it("notifies subscribers with the new task", () => {
		const focusManager = new FocusManager()
		const listener = vi.fn()
		focusManager.onDidChangeFocus(listener)

		focusElementIn(UI_ZONES.SIDE.dom)
		focusManager.syncFocus()

		expect(listener).toHaveBeenCalledExactlyOnceWith("tree")
	})

	// Focus moving between two nodes of the same zone must not repaint anything.
	it("stays quiet while the task is unchanged", () => {
		const focusManager = new FocusManager()
		const listener = vi.fn()
		focusManager.onDidChangeFocus(listener)

		focusElementIn(UI_ZONES.SIDE.dom)
		focusManager.syncFocus()
		focusManager.syncFocus()
		focusManager.syncFocus()

		expect(listener).toHaveBeenCalledOnce()
	})

	it("reports each transition between zones", () => {
		const focusManager = new FocusManager()
		const seen: string[] = []
		focusManager.onDidChangeFocus((task) => seen.push(task))

		focusElementIn(UI_ZONES.SIDE.dom)
		focusManager.syncFocus()

		focusElementIn(UI_ZONES.EDITOR_CONTAINER.dom)
		focusManager.syncFocus()

		focusElementIn(UI_ZONES.SIDE.dom)
		focusManager.syncFocus()

		expect(seen).toEqual(["tree", "editor", "tree"])
	})

	it("stops notifying once unsubscribed", () => {
		const focusManager = new FocusManager()
		const listener = vi.fn()
		const unsubscribe = focusManager.onDidChangeFocus(listener)

		unsubscribe()
		focusElementIn(UI_ZONES.SIDE.dom)
		focusManager.syncFocus()

		expect(listener).not.toHaveBeenCalled()
	})
})
