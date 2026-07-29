import { describe, expect, it, vi } from "vitest"

import { CommandRegistry, ContextKeyService, KeybindingService } from "@renderer/core"

function createService() {
	const context = new ContextKeyService()
	const registry = new CommandRegistry(context)
	return { service: new KeybindingService(registry), registry, context }
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

describe("KeybindingService", () => {
	it("runs the command bound to the pressed combination", async () => {
		const { service, registry } = createService()
		const run = vi.fn()
		registry.register({ id: "file.save", run })
		service.register({ key: "Ctrl+S", command: "file.save" })

		service.handleKeyEvent(keyEvent("s", { ctrlKey: true }))
		await vi.waitFor(() => expect(run).toHaveBeenCalledOnce())
	})

	it("passes the binding's arguments to the command", async () => {
		const { service, registry } = createService()
		const run = vi.fn()
		registry.register({ id: "find.toggle", run })
		service.register({ key: "Ctrl+H", command: "find.toggle", args: [true] })

		service.handleKeyEvent(keyEvent("h", { ctrlKey: true }))
		await vi.waitFor(() => expect(run).toHaveBeenCalledExactlyOnceWith(true))
	})

	// Two zones can want the same key; the one whose command applies gets it.
	it("takes the first binding whose command applies", () => {
		const { service, registry, context } = createService()
		registry.register({ id: "tree.cut", when: (ctx) => ctx.focusedTask === "tree", run: vi.fn() })
		registry.register({ id: "editor.cut.native", when: (ctx) => ctx.focusedTask === "editor", run: vi.fn() })
		service.register({ key: "Ctrl+X", command: "tree.cut" })
		service.register({ key: "Ctrl+X", command: "editor.cut.native", passThrough: true })

		context.set("focusedTask", "tree")
		expect(service.resolve("Ctrl+X")?.command).toBe("tree.cut")

		context.set("focusedTask", "editor")
		expect(service.resolve("Ctrl+X")?.command).toBe("editor.cut.native")

		context.set("focusedTask", "tab")
		expect(service.resolve("Ctrl+X")).toBeUndefined()
	})

	// Suppressing the key follows from having matched something. A key that means
	// nothing here must reach the editor's own handling untouched.
	it("suppresses the browser default only when a binding applies", () => {
		const { service, registry, context } = createService()
		registry.register({ id: "tree.delete", when: (ctx) => ctx.focusedTask === "tree", run: vi.fn() })
		service.register({ key: "DELETE", command: "tree.delete" })

		context.set("focusedTask", "editor")
		const inEditor = keyEvent("Delete")
		service.handleKeyEvent(inEditor)
		expect(inEditor.preventDefault).not.toHaveBeenCalled()

		context.set("focusedTask", "tree")
		const inTree = keyEvent("Delete")
		service.handleKeyEvent(inTree)
		expect(inTree.preventDefault).toHaveBeenCalledOnce()
	})

	// Cutting inside the editor goes through the browser's clipboard; the command
	// only records that it happened, so the key must still reach the browser.
	it("leaves the default alone for a pass-through binding", async () => {
		const { service, registry } = createService()
		const run = vi.fn()
		registry.register({ id: "editor.cut.native", run })
		service.register({ key: "Ctrl+X", command: "editor.cut.native", passThrough: true })

		const event = keyEvent("x", { ctrlKey: true })
		service.handleKeyEvent(event)

		expect(event.preventDefault).not.toHaveBeenCalled()
		await vi.waitFor(() => expect(run).toHaveBeenCalledOnce())
	})

	it("does nothing for a key nobody bound", () => {
		const { service } = createService()
		const event = keyEvent("q", { ctrlKey: true })

		service.handleKeyEvent(event)

		expect(event.preventDefault).not.toHaveBeenCalled()
	})

	it("drops auto-repeat for commands but keeps it for navigation keys", async () => {
		const { service, registry } = createService()
		const del = vi.fn()
		const move = vi.fn()
		registry.register({ id: "tree.delete", run: del })
		registry.register({ id: "tree.focusDown", run: move })
		service.register({ key: "DELETE", command: "tree.delete" })
		service.register({ key: "ARROWDOWN", command: "tree.focusDown" })

		service.handleKeyEvent(keyEvent("Delete", { repeat: true }))
		service.handleKeyEvent(keyEvent("ArrowDown", { repeat: true }))

		await vi.waitFor(() => expect(move).toHaveBeenCalledOnce())
		expect(del).not.toHaveBeenCalled()
	})

	// A held key still counts as handled, or the browser would act on the repeats.
	it("still suppresses the default for a dropped repeat", () => {
		const { service, registry } = createService()
		registry.register({ id: "tree.delete", run: vi.fn() })
		service.register({ key: "DELETE", command: "tree.delete" })

		const event = keyEvent("Delete", { repeat: true })
		service.handleKeyEvent(event)

		expect(event.preventDefault).toHaveBeenCalledOnce()
	})

	it("keeps bindings on one key in registration order", () => {
		const { service } = createService()
		service.register({ key: "ENTER", command: "find.submit" })
		service.register({ key: "ENTER", command: "tree.open" })

		expect(service.bindingsFor("ENTER").map((b) => b.command)).toEqual(["find.submit", "tree.open"])
	})
})
