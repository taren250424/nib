import { describe, expect, it } from "vitest"

import { createCommandDescriptors } from "@renderer/commands"
import type { CommandDeps } from "@renderer/commands/definitions"
import { MENU_BINDINGS } from "@renderer/commands/menuBindings"
import { CommandRegistry, ContextKeyService } from "@renderer/core"

function registryWithAllCommands() {
  const service = () => new Proxy({}, { get: () => () => undefined })
  const deps = {
    commandManager: service(),
    zoomController: service(),
    sideFacade: service(),
    infoFacade: service(),
    menuElements: service(),
    tabEditorFacade: service(),
    treeFacade: service(),
  } as unknown as CommandDeps

  const context = new ContextKeyService()
  const registry = new CommandRegistry(context)
  registry.registerAll(createCommandDescriptors(deps))
  return { registry, context }
}

describe("MENU_BINDINGS", () => {
  // A typo here would leave a menu item permanently greyed out with no error.
  it("names only commands that exist", () => {
    const { registry } = registryWithAllCommands()

    for (const binding of MENU_BINDINGS) {
      for (const command of binding.commands) {
        expect(registry.has(command), `${String(binding.element)} names unknown command ${command}`).toBe(true)
      }
    }
  })

  it("binds each menu element once", () => {
    const elements = MENU_BINDINGS.map((binding) => binding.element)
    expect(new Set(elements).size).toBe(elements.length)
  })

  // Edit > Cut is the tree's or the editor's, and neither applies from the tab bar.
  it("resolves the shared edit items by where focus is", () => {
    const { registry, context } = registryWithAllCommands()
    const cut = MENU_BINDINGS.find((binding) => binding.element === "cut")!.commands

    context.update({ focusedTask: "tree", treeHasSelection: true })
    expect(registry.firstEnabled(cut)).toBe("tree.cut")

    context.update({ focusedTask: "editor", hasActiveEditor: true })
    expect(registry.firstEnabled(cut)).toBe("editor.cut")

    context.update({ focusedTask: "tab" })
    expect(registry.firstEnabled(cut)).toBeUndefined()
  })

  it("reports undo as unavailable until there is something to undo", () => {
    const { registry, context } = registryWithAllCommands()
    const undo = MENU_BINDINGS.find((binding) => binding.element === "undo")!.commands

    context.update({ focusedTask: "tree", canUndoTree: false })
    expect(registry.firstEnabled(undo)).toBeUndefined()

    context.update({ canUndoTree: true })
    expect(registry.firstEnabled(undo)).toBe("tree.undo")
  })

  it("reports paste as unavailable with an empty tree clipboard", () => {
    const { registry, context } = registryWithAllCommands()
    const paste = MENU_BINDINGS.find((binding) => binding.element === "paste")!.commands

    context.update({ focusedTask: "tree", treeHasClipboard: false })
    expect(registry.firstEnabled(paste)).toBeUndefined()

    context.update({ treeHasClipboard: true })
    expect(registry.firstEnabled(paste)).toBe("tree.pasteFromShortcut")
  })

  it("keeps the always-available items available", () => {
    const { registry } = registryWithAllCommands()

    for (const element of ["newTab", "zoomIn", "information", "exit"]) {
      const commands = MENU_BINDINGS.find((binding) => binding.element === element)!.commands
      expect(registry.firstEnabled(commands), `${element} should be available`).toBeDefined()
    }
  })

  // Save reads the active tab, so with no tab open the item greys out instead
  // of crashing the command it would have run.
  it("reports save as unavailable until a document is open", () => {
    const { registry, context } = registryWithAllCommands()
    const save = MENU_BINDINGS.find((binding) => binding.element === "save")!.commands

    expect(registry.firstEnabled(save)).toBeUndefined()

    context.update({ hasActiveEditor: true })
    expect(registry.firstEnabled(save)).toBe("file.save")
  })
})
