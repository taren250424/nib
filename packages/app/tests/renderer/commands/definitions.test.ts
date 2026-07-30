import { describe, expect, it } from "vitest"

import { createCommandDescriptors } from "@renderer/commands"
import type { CommandDeps } from "@renderer/commands/definitions"
import { CommandRegistry, ContextKeyService } from "@renderer/core"

/** Every dependency recorded through one call log, so a command's target is visible. */
function recordingDeps() {
  const calls: string[] = []
  const service = () =>
    new Proxy(
      {},
      {
        get: (_target, property: string) => () => calls.push(property),
      }
    )

  const deps = {
    commandManager: service(),
    zoomManager: service(),
    sideFacade: service(),
    infoFacade: service(),
    menuElements: service(),
  } as unknown as CommandDeps

  return { deps, calls }
}

function descriptorsById() {
  const { deps, calls } = recordingDeps()
  const descriptors = createCommandDescriptors(deps)
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
    const { deps } = recordingDeps()
    const registry = new CommandRegistry(new ContextKeyService())

    expect(() => registry.registerAll(createCommandDescriptors(deps))).not.toThrow()
  })

  it("scopes the zone-specific commands to their zone", () => {
    const { byId } = descriptorsById()
    const context = new ContextKeyService()

    const expectations: [string, string][] = [
      ["tree.delete", "tree"],
      ["tree.cut", "tree"],
      ["tab.closeOthers", "tab"],
      ["find.submit", "find-replace"],
    ]

    // The tree commands here also want something selected; the zone alone is
    // what this case is about, so give them both and vary only the zone.
    context.set("treeHasSelection", true)

    for (const [id, task] of expectations) {
      const when = byId.get(id)?.when
      expect(when, `${id} should be scoped to a zone`).toBeDefined()

      context.set("focusedTask", task as never)
      expect(when!(context.snapshot()), `${id} should apply in ${task}`).toBe(true)

      context.set("focusedTask", "none")
      expect(when!(context.snapshot()), `${id} should not apply outside ${task}`).toBe(false)
    }
  })

  // The bug this pins: delete and cut act on the selection, so offering them
  // with nothing selected offers to act on nothing.
  it("needs a selection for the tree commands that act on one", () => {
    const { byId } = descriptorsById()
    const context = new ContextKeyService()
    context.set("focusedTask", "tree")

    for (const id of ["tree.delete", "tree.cut", "tree.copy", "tree.rename", "tree.open", "tree.move"]) {
      const when = byId.get(id)!.when!
      expect(when(context.snapshot()), `${id} should not apply with an empty selection`).toBe(false)
    }

    context.set("treeHasSelection", true)
    for (const id of ["tree.delete", "tree.cut", "tree.copy", "tree.rename", "tree.open", "tree.move"]) {
      const when = byId.get(id)!.when!
      expect(when(context.snapshot()), `${id} should apply with a selection`).toBe(true)
    }

    // Create is the exception: it falls back to the root directory.
    expect(byId.get("tree.create")!.when!(new ContextKeyService().snapshot())).toBe(false)
    context.set("treeHasSelection", false)
    expect(byId.get("tree.create")!.when!(context.snapshot())).toBe(true)
  })

  // F3 reaches this with the widget closed, so the query cannot come from
  // reading the box — searching for nothing would swallow the key.
  it("needs a document and a query before stepping through matches", () => {
    const { byId } = descriptorsById()
    const when = byId.get("find.next")!.when!
    const context = new ContextKeyService()

    context.update({ hasActiveEditor: true, hasSearchQuery: false })
    expect(when(context.snapshot())).toBe(false)

    context.update({ hasActiveEditor: false, hasSearchQuery: true })
    expect(when(context.snapshot())).toBe(false)

    context.update({ hasActiveEditor: true, hasSearchQuery: true })
    expect(when(context.snapshot())).toBe(true)
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

    for (const id of ["file.newTab", "file.save", "view.zoomIn", "settings.apply"]) {
      expect(byId.get(id)?.when, `${id} should not be scoped`).toBeUndefined()
    }
  })

  // The editor clipboard commands reach for the active view without checking it
  // exists, so the condition has to carry that rather than the focus alone.
  it("requires an open document for the editor commands, not just editor focus", () => {
    const { byId } = descriptorsById()
    const context = new ContextKeyService()
    context.set("focusedTask", "editor")

    const editing = ["editor.cut", "editor.cut.native", "editor.copy", "editor.paste", "editor.paste.native"]

    for (const id of editing) {
      const when = byId.get(id)!.when!
      expect(when(context.snapshot()), `${id} should not apply with no tab open`).toBe(false)
    }

    context.set("hasActiveEditor", true)
    for (const id of editing) {
      const when = byId.get(id)!.when!
      expect(when(context.snapshot()), `${id} should apply with a tab open`).toBe(true)
    }

    // And still not from another zone, even with a document open.
    context.set("focusedTask", "tree")
    expect(byId.get("editor.copy")!.when!(context.snapshot())).toBe(false)
  })

  // Cutting and then clicking elsewhere still leaves something to paste, so the
  // condition is the clipboard rather than the current selection.
  it("requires a clipboard for every paste variant, not just tree focus", () => {
    const { byId } = descriptorsById()
    const context = new ContextKeyService()
    context.set("focusedTask", "tree")

    const pastes = ["tree.pasteFromContextMenu", "tree.pasteFromShortcut"]

    for (const id of pastes) {
      const when = byId.get(id)!.when!
      expect(when(context.snapshot()), `${id} should not apply with an empty clipboard`).toBe(false)
    }

    context.set("treeHasClipboard", true)
    for (const id of pastes) {
      const when = byId.get(id)!.when!
      expect(when(context.snapshot()), `${id} should apply with a full clipboard`).toBe(true)
    }
  })

  // A drop used to be spelled as a cut followed by a paste, which made it wait
  // on a clipboard it had just overwritten. It moves what was dragged, so a
  // selection is the whole condition.
  it("moves a drop on its own, without a clipboard", () => {
    const { byId } = descriptorsById()
    const context = new ContextKeyService()
    context.set("focusedTask", "tree")
    context.set("treeHasSelection", true)

    expect(byId.get("tree.move")!.when!(context.snapshot())).toBe(true)
    expect(byId.get("tree.pasteFromDrag")).toBeUndefined()
  })

  // Both are on a global key, so neither may act on a box that is not open.
  it("gates the find commands that a global key can reach", () => {
    const { byId } = descriptorsById()
    const context = new ContextKeyService()

    for (const id of ["find.close", "find.replaceAll"]) {
      const when = byId.get(id)?.when
      expect(when, `${id} should be gated`).toBeDefined()

      expect(when!(context.snapshot()), `${id} should not apply while closed`).toBe(false)
      context.set("findReplaceOpen", true)
      expect(when!(context.snapshot()), `${id} should apply while open`).toBe(true)
      context.set("findReplaceOpen", false)
    }
  })

  it("points each command at the work it performs", async () => {
    const { byId, calls } = descriptorsById()

    await byId.get("tree.cut")!.run()
    await byId.get("tree.move")!.run()
    await byId.get("editor.cut")!.run()
    await byId.get("editor.cut.native")!.run()

    expect(calls).toEqual(["performCutTree", "performMoveTreeFromDrag", "performCutEditorManual", "performCutEditor"])
  })

  // Zoom, settings and help used to be wired straight from their handlers,
  // which left them outside anything that could describe or enable them.
  it("covers the actions that used to bypass the command system", async () => {
    const { byId, calls } = descriptorsById()

    await byId.get("view.zoomIn")!.run()
    await byId.get("view.zoomReset")!.run()
    await byId.get("settings.open")!.run()
    await byId.get("help.showInformation")!.run()

    expect(calls).toEqual(["zoomIn", "resetZoom", "performOpenSettings", "showInformation"])
  })
})

describe("command descriptors under a registry", () => {
  it("runs a zone command only in its zone", async () => {
    const { deps, calls } = recordingDeps()
    const context = new ContextKeyService()
    const registry = new CommandRegistry(context)
    registry.registerAll(createCommandDescriptors(deps))

    context.update({ focusedTask: "editor", treeHasSelection: true })
    await registry.execute("tree.delete")
    expect(calls).toEqual([])

    context.set("focusedTask", "tree")
    await registry.execute("tree.delete")
    expect(calls).toEqual(["performDelete"])
  })

  it("reports enablement without running anything", () => {
    const { deps, calls } = recordingDeps()
    const context = new ContextKeyService()
    const registry = new CommandRegistry(context)
    registry.registerAll(createCommandDescriptors(deps))

    context.update({ focusedTask: "tree", treeHasSelection: true })
    expect(registry.isEnabled("tree.rename")).toBe(true)
    expect(registry.isEnabled("editor.copy")).toBe(false)
    expect(calls).toEqual([])
  })
})

it("does not touch the command manager while merely building the descriptors", () => {
  const { deps, calls } = recordingDeps()

  createCommandDescriptors(deps)

  expect(calls).toEqual([])
})
