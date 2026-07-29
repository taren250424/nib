import { describe, expect, it, vi } from "vitest"

import { CommandRegistry } from "@renderer/core/CommandRegistry"
import { ContextKeyService } from "@renderer/core/ContextKeyService"

function createRegistry() {
	const context = new ContextKeyService()
	return { registry: new CommandRegistry(context), context }
}

describe("CommandRegistry", () => {
	it("runs a command with the arguments it was dispatched with", async () => {
		const { registry } = createRegistry()
		const run = vi.fn()
		registry.register({ id: "tree.rename", run })

		await registry.execute("tree.rename", "C:/notes/todo.md", true)

		expect(run).toHaveBeenCalledExactlyOnceWith("C:/notes/todo.md", true)
	})

	it("waits for an async command before returning", async () => {
		const { registry } = createRegistry()
		const order: string[] = []
		registry.register({
			id: "file.save",
			run: async () => {
				await Promise.resolve()
				order.push("command")
			},
		})

		await registry.execute("file.save")
		order.push("after")

		expect(order).toEqual(["command", "after"])
	})

	it("only runs a command whose when holds", async () => {
		const { registry, context } = createRegistry()
		const run = vi.fn()
		registry.register({ id: "tree.delete", when: (ctx) => ctx.focusedTask === "tree", run })

		context.set("focusedTask", "editor")
		await registry.execute("tree.delete")
		expect(run).not.toHaveBeenCalled()

		context.set("focusedTask", "tree")
		await registry.execute("tree.delete")
		expect(run).toHaveBeenCalledOnce()
	})

	it("treats a command without a when as always available", async () => {
		const { registry } = createRegistry()
		const run = vi.fn()
		registry.register({ id: "file.newTab", run })

		expect(registry.isEnabled("file.newTab")).toBe(true)
		await registry.execute("file.newTab")
		expect(run).toHaveBeenCalledOnce()
	})

	it("re-evaluates when against the context at call time", () => {
		const { registry, context } = createRegistry()
		registry.register({ id: "tree.paste", when: (ctx) => ctx.treeHasClipboard, run: vi.fn() })

		expect(registry.isEnabled("tree.paste")).toBe(false)
		context.set("treeHasClipboard", true)
		expect(registry.isEnabled("tree.paste")).toBe(true)
	})

	it("reports an unknown command as unavailable rather than enabled", () => {
		const { registry } = createRegistry()
		expect(registry.isEnabled("nope")).toBe(false)
		expect(registry.has("nope")).toBe(false)
	})

	// Registering one id twice is how a binding silently stops working.
	it("refuses a duplicate id while in dev", () => {
		const { registry } = createRegistry()
		registry.register({ id: "edit.cut", run: vi.fn() })

		expect(() => registry.register({ id: "edit.cut", run: vi.fn() })).toThrow(/Duplicate command id/)
	})

	it("reports a dispatch to an id nobody registered while in dev", async () => {
		const { registry } = createRegistry()
		await expect(registry.execute("edit.doesNotExist")).rejects.toThrow(/Unknown command/)
	})

	it("registers a batch and lists what it knows", () => {
		const { registry } = createRegistry()
		registry.registerAll([
			{ id: "a", run: vi.fn() },
			{ id: "b", run: vi.fn() },
		])

		expect(registry.ids()).toEqual(["a", "b"])
	})
})
