import { describe, expect, it } from "vitest"

import { Dispatcher } from "@renderer/dispatch/Dispatcher"
import type { FocusManager, Task } from "@renderer/core"
import type { CommandManager } from "@renderer/modules"

/**
 * Snapshot of the [event][task][source] routing the dispatcher performs today,
 * so the move to a command registry can be checked against it.
 */
function createDispatcher(task: Task) {
	const calls: string[] = []

	const commandManager = new Proxy(
		{},
		{
			get:
				(_target, property: string) =>
				(...args: unknown[]) => {
					calls.push(args.length ? `${property}:${args.join(",")}` : property)
				},
		}
	) as unknown as CommandManager

	const focusManager = { getFocusedTask: () => task } as FocusManager

	return { dispatcher: new Dispatcher(focusManager, commandManager), calls }
}

describe("Dispatcher routing", () => {
	it("prefers the handler registered for the focused task", async () => {
		const tree = createDispatcher("tree")
		await tree.dispatcher.dispatch("undo", "shortcut")
		expect(tree.calls).toEqual(["performUndoTree"])

		const editor = createDispatcher("editor")
		await editor.dispatcher.dispatch("undo", "menu")
		expect(editor.calls).toEqual(["performUndoEditor"])
	})

	// Replace leaves focus in the widget; undo there belongs to the editor history.
	it("routes undo and redo from the find widget to the editor", async () => {
		const { dispatcher, calls } = createDispatcher("find-replace")

		await dispatcher.dispatch("undo", "shortcut")
		await dispatcher.dispatch("redo", "shortcut")

		expect(calls).toEqual(["performUndoEditor", "performRedoEditor"])
	})

	it("falls back to the default task when the focused one has no entry", async () => {
		const { dispatcher, calls } = createDispatcher("tab")
		await dispatcher.dispatch("newTab", "shortcut")
		expect(calls).toEqual(["performNewTab"])
	})

	it("distinguishes handlers by source within one task", async () => {
		const contextMenu = createDispatcher("tree")
		await contextMenu.dispatcher.dispatch("paste", "context-menu")
		expect(contextMenu.calls).toEqual(["performPasteTreeWithContextmenu"])

		const shortcut = createDispatcher("tree")
		await shortcut.dispatcher.dispatch("paste", "shortcut")
		expect(shortcut.calls).toEqual(["performPasteTreeWithShortcut"])

		const drag = createDispatcher("tree")
		await drag.dispatcher.dispatch("paste", "drag")
		expect(drag.calls).toEqual(["performPasteTreeWithDrag"])
	})

	it("falls back to the default source when the given one has no entry", async () => {
		const { dispatcher, calls } = createDispatcher("tree")
		await dispatcher.dispatch("cut", "element")
		expect(calls).toEqual(["performCutTree"])
	})

	it("forwards the dispatch arguments to the handler", async () => {
		const { dispatcher, calls } = createDispatcher("editor")
		await dispatcher.dispatch("openFile", "menu", "C:/notes/todo.md")
		expect(calls).toEqual(["performOpenFile:C:/notes/todo.md"])
	})

	// A shortcut that means nothing in the focused zone has to fall through
	// untouched, or native editor keys would be swallowed.
	it("ignores a shortcut with no entry for the focused task or source", async () => {
		const noTask = createDispatcher("editor")
		await expect(noTask.dispatcher.dispatch("create", "shortcut")).resolves.toBeUndefined()
		expect(noTask.calls).toEqual([])

		const noSource = createDispatcher("editor")
		await expect(noSource.dispatcher.dispatch("copy", "shortcut")).resolves.toBeUndefined()
		expect(noSource.calls).toEqual([])
	})

	it("reports a non-shortcut dispatch that lands nowhere while in dev", async () => {
		const { dispatcher } = createDispatcher("editor")
		await expect(dispatcher.dispatch("create", "menu")).rejects.toThrow(/Missing task node/)
	})

	it("awaits the handler so callers can sequence work after it", async () => {
		const order: string[] = []
		const commandManager = {
			performSave: async () => {
				await Promise.resolve()
				order.push("handler")
			},
		} as unknown as CommandManager
		const focusManager = { getFocusedTask: () => "editor" as Task } as FocusManager

		await new Dispatcher(focusManager, commandManager).dispatch("save", "menu")
		order.push("after")

		expect(order).toEqual(["handler", "after"])
	})
})
