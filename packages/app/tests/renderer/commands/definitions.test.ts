import { describe, expect, it } from "vitest"

import { createCommandDescriptors } from "@renderer/commands"
import { CommandRegistry, ContextKeyService } from "@renderer/core"
import type { CommandManager } from "@renderer/modules"

function recordingCommandManager() {
	const calls: string[] = []
	const commandManager = new Proxy(
		{},
		{
			get: (_target, property: string) => () => calls.push(property),
		}
	) as unknown as CommandManager

	return { commandManager, calls }
}

function descriptorsById() {
	const { commandManager, calls } = recordingCommandManager()
	const descriptors = createCommandDescriptors(commandManager)
	return { byId: new Map(descriptors.map((d) => [d.id, d])), descriptors, calls }
}

describe("createCommandDescriptors", () => {
	it("gives every command a unique id and something to run", () => {
		const { descriptors } = descriptorsById()

		expect(descriptors.length).toBeGreaterThan(0)
		expect(new Set(descriptors.map((d) => d.id)).size).toBe(descriptors.length)
		for (const descriptor of descriptors) {
			expect(typeof descriptor.run, `${descriptor.id} has no run`).toBe("function")
		}
	})

	it("registers as a whole without collisions", () => {
		const { commandManager } = recordingCommandManager()
		const registry = new CommandRegistry(new ContextKeyService())

		expect(() => registry.registerAll(createCommandDescriptors(commandManager))).not.toThrow()
	})

	it("scopes the zone-specific commands to their zone", () => {
		const { byId } = descriptorsById()
		const context = new ContextKeyService()

		const expectations: [string, string][] = [
			["tree.delete", "tree"],
			["tree.pasteFromShortcut", "tree"],
			["tab.closeOthers", "tab"],
			["editor.copy", "editor"],
			["find.submit", "find-replace"],
		]

		for (const [id, task] of expectations) {
			const when = byId.get(id)?.when
			expect(when, `${id} should be scoped to a zone`).toBeDefined()

			context.set("focusedTask", task as never)
			expect(when!(context.snapshot()), `${id} should apply in ${task}`).toBe(true)

			context.set("focusedTask", "none")
			expect(when!(context.snapshot()), `${id} should not apply outside ${task}`).toBe(false)
		}
	})

	// Replace leaves focus in the find widget, and undo there belongs to the
	// editor history the replacement was written into.
	it("lets editor history apply from the find widget as well", () => {
		const { byId } = descriptorsById()
		const context = new ContextKeyService()

		for (const id of ["editor.undo", "editor.redo"]) {
			const when = byId.get(id)!.when!
			context.set("focusedTask", "find-replace")
			expect(when(context.snapshot()), `${id} should apply in the find widget`).toBe(true)
			context.set("focusedTask", "editor")
			expect(when(context.snapshot()), `${id} should apply in the editor`).toBe(true)
		}
	})

	it("leaves globally available commands unconditional", () => {
		const { byId } = descriptorsById()

		for (const id of ["file.newTab", "file.save", "find.close", "settings.apply"]) {
			expect(byId.get(id)?.when, `${id} should not be scoped`).toBeUndefined()
		}
	})

	it("keeps the native editor variants free of side effects", async () => {
		const { byId, calls } = descriptorsById()

		await byId.get("editor.undo.native")!.run()
		await byId.get("editor.redo.native")!.run()

		expect(calls).toEqual([])
	})

	it("points each command at its command manager method", async () => {
		const { byId, calls } = descriptorsById()

		await byId.get("tree.cut")!.run()
		await byId.get("editor.cut")!.run()
		await byId.get("editor.cut.native")!.run()

		expect(calls).toEqual(["performCutTree", "performCutEditorManual", "performCutEditor"])
	})
})

describe("command descriptors under a registry", () => {
	it("runs a zone command only in its zone", async () => {
		const { commandManager, calls } = recordingCommandManager()
		const context = new ContextKeyService()
		const registry = new CommandRegistry(context)
		registry.registerAll(createCommandDescriptors(commandManager))

		context.set("focusedTask", "editor")
		await registry.execute("tree.delete")
		expect(calls).toEqual([])

		context.set("focusedTask", "tree")
		await registry.execute("tree.delete")
		expect(calls).toEqual(["performDelete"])
	})

	it("reports enablement without running anything", () => {
		const { commandManager, calls } = recordingCommandManager()
		const context = new ContextKeyService()
		const registry = new CommandRegistry(context)
		registry.registerAll(createCommandDescriptors(commandManager))

		context.set("focusedTask", "tree")
		expect(registry.isEnabled("tree.rename")).toBe(true)
		expect(registry.isEnabled("editor.copy")).toBe(false)
		expect(calls).toEqual([])
	})
})

it("does not touch the command manager while merely building the descriptors", () => {
	const { commandManager, calls } = recordingCommandManager()

	createCommandDescriptors(commandManager)

	expect(calls).toEqual([])
})
