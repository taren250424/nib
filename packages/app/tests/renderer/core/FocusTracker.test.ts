import { afterEach, describe, expect, it, vi } from "vitest"

import { FocusTracker } from "@renderer/core/FocusTracker"
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

describe("FocusTracker.getFocusedTask", () => {
  it("reports the task of the zone the focused element sits in", () => {
    focusElementIn(UI_ZONES.SIDE.dom)
    expect(new FocusTracker().getFocusedTask()).toBe("tree")
  })

  // The find widget is listed before the editor so it wins when both match.
  it("prefers the more specific of two matching zones", () => {
    focusElementIn(UI_ZONES.FIND_REPLACE_CONTAINER.dom, UI_ZONES.EDITOR_CONTAINER.dom)
    expect(new FocusTracker().getFocusedTask()).toBe("find-replace")
  })

  it("keeps the stored task for zones that carry none", () => {
    const focusTracker = new FocusTracker()
    focusTracker.setFocusedTask("tree")

    focusElementIn(UI_ZONES.MENU_ITEM.dom)
    expect(focusTracker.getFocusedTask()).toBe("tree")
  })

  it("falls back to the stored task when nothing is focused", () => {
    const focusTracker = new FocusTracker()
    focusTracker.setFocusedTask("editor")

    focusNothing()
    expect(focusTracker.getFocusedTask()).toBe("editor")
  })
})

describe("FocusTracker.syncFocus", () => {
  it("notifies subscribers with the new task", () => {
    const focusTracker = new FocusTracker()
    const listener = vi.fn()
    focusTracker.onDidChangeFocus(listener)

    focusElementIn(UI_ZONES.SIDE.dom)
    focusTracker.syncFocus()

    expect(listener).toHaveBeenCalledExactlyOnceWith("tree")
  })

  // Focus moving between two nodes of the same zone must not repaint anything.
  it("stays quiet while the task is unchanged", () => {
    const focusTracker = new FocusTracker()
    const listener = vi.fn()
    focusTracker.onDidChangeFocus(listener)

    focusElementIn(UI_ZONES.SIDE.dom)
    focusTracker.syncFocus()
    focusTracker.syncFocus()
    focusTracker.syncFocus()

    expect(listener).toHaveBeenCalledOnce()
  })

  it("reports each transition between zones", () => {
    const focusTracker = new FocusTracker()
    const seen: string[] = []
    focusTracker.onDidChangeFocus((task) => seen.push(task))

    focusElementIn(UI_ZONES.SIDE.dom)
    focusTracker.syncFocus()

    focusElementIn(UI_ZONES.EDITOR_CONTAINER.dom)
    focusTracker.syncFocus()

    focusElementIn(UI_ZONES.SIDE.dom)
    focusTracker.syncFocus()

    expect(seen).toEqual(["tree", "editor", "tree"])
  })

  it("stops notifying once unsubscribed", () => {
    const focusTracker = new FocusTracker()
    const listener = vi.fn()
    const unsubscribe = focusTracker.onDidChangeFocus(listener)

    unsubscribe()
    focusElementIn(UI_ZONES.SIDE.dom)
    focusTracker.syncFocus()

    expect(listener).not.toHaveBeenCalled()
  })
})
