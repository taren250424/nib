import { describe, expect, it, vi } from "vitest"

import { ContextKeyService } from "@renderer/core/ContextKeyService"

describe("ContextKeyService", () => {
	it("starts from the documented defaults", () => {
		const context = new ContextKeyService()

		expect(context.get("focusedTask")).toBe("none")
		expect(context.get("treeHasClipboard")).toBe(false)
		expect(context.get("hasActiveEditor")).toBe(false)
	})

	it("reads back what was written", () => {
		const context = new ContextKeyService()

		context.set("focusedTask", "tree")
		context.set("treeHasSelection", true)

		expect(context.get("focusedTask")).toBe("tree")
		expect(context.get("treeHasSelection")).toBe(true)
	})

	it("names the keys that moved", () => {
		const context = new ContextKeyService()
		const listener = vi.fn()
		context.onDidChange(listener)

		context.set("focusedTask", "editor")

		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set(["focusedTask"]))
	})

	// Menus repaint from these events, so writing a value that is already set
	// must not cause work.
	it("says nothing when a write does not change the value", () => {
		const context = new ContextKeyService()
		context.set("sideOpen", true)

		const listener = vi.fn()
		context.onDidChange(listener)
		context.set("sideOpen", true)

		expect(listener).not.toHaveBeenCalled()
	})

	it("reports a batch update once, listing only the keys that moved", () => {
		const context = new ContextKeyService()
		context.set("treeHasSelection", true)

		const listener = vi.fn()
		context.onDidChange(listener)

		context.update({ treeHasSelection: true, treeHasClipboard: true, canUndoTree: true })

		expect(listener).toHaveBeenCalledExactlyOnceWith(new Set(["treeHasClipboard", "canUndoTree"]))
	})

	it("stays quiet for a batch in which nothing moved", () => {
		const context = new ContextKeyService()
		const listener = vi.fn()
		context.onDidChange(listener)

		context.update({ treeHasSelection: false, sideOpen: false })

		expect(listener).not.toHaveBeenCalled()
	})

	it("stops notifying once unsubscribed", () => {
		const context = new ContextKeyService()
		const listener = vi.fn()
		const unsubscribe = context.onDidChange(listener)

		unsubscribe()
		context.set("editorIsDirty", true)

		expect(listener).not.toHaveBeenCalled()
	})

	it("hands out a snapshot that later writes do not mutate", () => {
		const context = new ContextKeyService()
		const before = context.snapshot()

		context.set("hasActiveEditor", true)

		expect(before.hasActiveEditor).toBe(false)
		expect(context.get("hasActiveEditor")).toBe(true)
	})
})
