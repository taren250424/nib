import { describe, expect, it, vi } from "vitest"

import { ShortcutRegistry } from "@renderer/core/ShortcutRegistry"
import type { FocusManager, Task } from "@renderer/core"

function createRegistry(task: Task = "tree") {
	const focusManager = { getFocusedTask: () => task } as FocusManager
	return new ShortcutRegistry(focusManager)
}

function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
	return {
		key,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		repeat: false,
		preventDefault: vi.fn(),
		...modifiers,
	} as unknown as KeyboardEvent
}

describe("ShortcutRegistry.getKeyString", () => {
	const registry = createRegistry()

	it("orders modifiers as Ctrl, Shift, Alt and upper-cases the key", () => {
		const key = registry.getKeyString(keyEvent("a", { ctrlKey: true, shiftKey: true, altKey: true }))
		expect(key).toBe("Ctrl+Shift+Alt+A")
	})

	// The key half is upper-cased last, so bindings are registered as "ESC"/"SPACE".
	it("names the special keys the bindings are registered under", () => {
		expect(registry.getKeyString(keyEvent("Escape"))).toBe("ESC")
		expect(registry.getKeyString(keyEvent(" "))).toBe("SPACE")
		expect(registry.getKeyString(keyEvent("Enter", { shiftKey: true }))).toBe("Shift+ENTER")
		expect(registry.getKeyString(keyEvent("ArrowUp", { shiftKey: true }))).toBe("Shift+ARROWUP")
	})

	// "+" is typed as Shift+"=" on most layouts, so both have to reach "Ctrl++".
	it("collapses = and + onto one binding and drops the Shift that types it", () => {
		expect(registry.getKeyString(keyEvent("=", { ctrlKey: true }))).toBe("Ctrl++")
		expect(registry.getKeyString(keyEvent("+", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl++")
		expect(registry.getKeyString(keyEvent("=", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl++")
	})

	it("keeps Shift on keys that do not produce a character with it", () => {
		expect(registry.getKeyString(keyEvent("-", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+-")
	})
})

describe("ShortcutRegistry.handleKeyEvent", () => {
	it("runs the handler registered for the pressed combination", () => {
		const registry = createRegistry()
		const handler = vi.fn()
		registry.register("Ctrl+S", handler)

		registry.handleKeyEvent(keyEvent("s", { ctrlKey: true }))

		expect(handler).toHaveBeenCalledOnce()
	})

	it("ignores combinations that were never registered", () => {
		const registry = createRegistry()
		const handler = vi.fn()
		registry.register("Ctrl+S", handler)

		registry.handleKeyEvent(keyEvent("s"))

		expect(handler).not.toHaveBeenCalled()
	})

	// Native editing shortcuts (copy, paste, undo) must keep working in the editor.
	it("suppresses the browser default outside the editor but not inside it", () => {
		const outside = keyEvent("s", { ctrlKey: true })
		const treeRegistry = createRegistry("tree")
		treeRegistry.register("Ctrl+S", vi.fn())
		treeRegistry.handleKeyEvent(outside)
		expect(outside.preventDefault).toHaveBeenCalledOnce()

		const inside = keyEvent("s", { ctrlKey: true })
		const editorRegistry = createRegistry("editor")
		editorRegistry.register("Ctrl+S", vi.fn())
		editorRegistry.handleKeyEvent(inside)
		expect(inside.preventDefault).not.toHaveBeenCalled()
	})

	it("drops auto-repeat for commands but keeps it for navigation keys", () => {
		const registry = createRegistry()

		const save = vi.fn()
		registry.register("Ctrl+S", save)
		registry.handleKeyEvent(keyEvent("s", { ctrlKey: true, repeat: true }))
		expect(save).not.toHaveBeenCalled()

		const moveDown = vi.fn()
		registry.register("ARROWDOWN", moveDown)
		registry.handleKeyEvent(keyEvent("ArrowDown", { repeat: true }))
		expect(moveDown).toHaveBeenCalledOnce()
	})
})
