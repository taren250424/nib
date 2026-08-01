import { describe, expect, it } from "vitest"

import { getKeyString, REPEATABLE_KEYS } from "@renderer/core/keys"

function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
  return { key, ctrlKey: false, shiftKey: false, altKey: false, ...modifiers } as KeyboardEvent
}

describe("getKeyString", () => {
  it("orders modifiers as Ctrl, Shift, Alt and upper-cases the key", () => {
    expect(getKeyString(keyEvent("a", { ctrlKey: true, shiftKey: true, altKey: true }))).toBe("Ctrl+Shift+Alt+A")
  })

  // The key half is upper-cased last, so bindings are written "ESC" and "SPACE".
  it("names the special keys the bindings are written with", () => {
    expect(getKeyString(keyEvent("Escape"))).toBe("ESC")
    expect(getKeyString(keyEvent(" "))).toBe("SPACE")
    expect(getKeyString(keyEvent("Enter", { shiftKey: true }))).toBe("Shift+ENTER")
    expect(getKeyString(keyEvent("ArrowUp", { shiftKey: true }))).toBe("Shift+ARROWUP")
  })

  // "+" is typed as Shift+"=" on most layouts, so both have to reach "Ctrl++".
  it("collapses = and + onto one binding and drops the Shift that types it", () => {
    expect(getKeyString(keyEvent("=", { ctrlKey: true }))).toBe("Ctrl++")
    expect(getKeyString(keyEvent("+", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl++")
    expect(getKeyString(keyEvent("=", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl++")
  })

  it("keeps Shift on keys that do not produce a character with it", () => {
    expect(getKeyString(keyEvent("-", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+-")
  })

  // No binding uses the OS key. It has to disqualify, not disappear: dropped,
  // Win+ArrowUp resolved to the tree's plain ArrowUp and moved the selection.
  it("keeps the OS key in the name so its chords match nothing", () => {
    expect(getKeyString(keyEvent("ArrowUp", { metaKey: true }))).toBe("Meta+ARROWUP")
    expect(getKeyString(keyEvent("Delete", { metaKey: true }))).toBe("Meta+DELETE")
  })
})

describe("REPEATABLE_KEYS", () => {
  // A held Delete must not empty a directory; a held arrow should keep moving.
  it("covers navigation and nothing that mutates", () => {
    expect(REPEATABLE_KEYS.has("ARROWUP")).toBe(true)
    expect(REPEATABLE_KEYS.has("Shift+ARROWDOWN")).toBe(true)
    expect(REPEATABLE_KEYS.has("DELETE")).toBe(false)
    expect(REPEATABLE_KEYS.has("Ctrl+V")).toBe(false)
  })
})
