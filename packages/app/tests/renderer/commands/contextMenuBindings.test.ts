import { describe, expect, it } from "vitest"

import { createCommandDescriptors } from "@renderer/commands"
import { TAB_CONTEXT_MENU_BINDINGS, TREE_CONTEXT_MENU_BINDINGS } from "@renderer/commands/contextMenuBindings"
import type { CommandDeps } from "@renderer/commands/definitions"
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

const ALL = [...TREE_CONTEXT_MENU_BINDINGS, ...TAB_CONTEXT_MENU_BINDINGS]

describe("context menu bindings", () => {
  // A typo here leaves an item permanently greyed out and raises nothing.
  it("names only commands that exist", () => {
    const { registry } = registryWithAllCommands()

    for (const binding of ALL) {
      for (const command of binding.commands) {
        expect(registry.has(command), `${String(binding.element)} names unknown command ${command}`).toBe(true)
      }
    }
  })

  it("binds each element once", () => {
    const elements = ALL.map((binding) => String(binding.element))
    expect(new Set(elements).size).toBe(elements.length)
  })

  it("greys out the tree menu with nothing selected, and lights it up with a selection", () => {
    const { registry, context } = registryWithAllCommands()
    const enabled = () =>
      TREE_CONTEXT_MENU_BINDINGS.filter((b) => registry.firstEnabled(b.commands)).map((b) => String(b.element))

    context.update({ focusedTask: "tree" })
    expect(enabled()).toEqual([])

    context.update({ treeHasSelection: true })
    expect(enabled()).toEqual(["treeContextCut", "treeContextCopy", "treeContextRename", "treeContextDelete"])
  })

  // What Paste consumes is the clipboard, not the selection: cutting and then
  // clicking elsewhere still leaves something to paste.
  it("enables Paste from the clipboard alone", () => {
    const { registry, context } = registryWithAllCommands()
    const paste = TREE_CONTEXT_MENU_BINDINGS.find((b) => b.element === "treeContextPaste")!.commands

    context.update({ focusedTask: "tree", treeHasSelection: true })
    expect(registry.firstEnabled(paste)).toBeUndefined()

    context.update({ treeHasClipboard: true, treeHasSelection: false })
    expect(registry.firstEnabled(paste)).toBe("tree.pasteFromContextMenu")
  })

  it("scopes the tab menu to the tab bar", () => {
    const { registry, context } = registryWithAllCommands()
    const enabledCount = () => TAB_CONTEXT_MENU_BINDINGS.filter((b) => registry.firstEnabled(b.commands)).length

    context.update({ focusedTask: "editor", hasActiveEditor: true })
    expect(enabledCount()).toBe(0)

    context.update({ focusedTask: "tab" })
    expect(enabledCount()).toBe(TAB_CONTEXT_MENU_BINDINGS.length)
  })

  // The right-clicked target is the command's own business, so nothing here
  // carries it as an argument.
  it("takes the right-clicked target from the command, not from an argument", () => {
    for (const binding of ALL) {
      expect(binding.args, `${String(binding.element)} should not need arguments`).toBeUndefined()
    }
  })
})
