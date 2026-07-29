import { describe, expect, it, vi } from "vitest"

import { Dispatcher } from "@renderer/dispatch/Dispatcher"
import { CommandRegistry, ContextKeyService } from "@renderer/core"
import type { ContextKeyMap, FocusManager, Task } from "@renderer/core"
import { createCommandDescriptors } from "@renderer/commands"
import type { CommandDeps } from "@renderer/commands/definitions"

/**
 * Exercises the whole path an event takes: the dispatcher's [event][task][source]
 * table, the command it names, that command's `when`, and the CommandManager call
 * it ends in.
 */
function createDispatcher(task: Task, context: Partial<ContextKeyMap> = {}) {
  const calls: string[] = []

  const service = () =>
    new Proxy(
      {},
      {
        get:
          (_target, property: string) =>
          (...args: unknown[]) => {
            calls.push(args.length ? `${property}:${args.join(",")}` : property)
          },
      }
    )

  const deps = {
    commandManager: service(),
    zoomManager: service(),
    sideFacade: service(),
    infoFacade: service(),
    menuElements: service(),
  } as unknown as CommandDeps

  const contextKeyService = new ContextKeyService()
  contextKeyService.update({ ...context, focusedTask: task })

  const commandRegistry = new CommandRegistry(contextKeyService)
  commandRegistry.registerAll(createCommandDescriptors(deps))

  const focusManager = {
    getFocusedTask: () => task,
    syncFocus: () => contextKeyService.set("focusedTask", task),
  } as unknown as FocusManager

  return { dispatcher: new Dispatcher(focusManager, commandRegistry), calls }
}

describe("Dispatcher routing", () => {
  it("prefers the handler registered for the focused task", async () => {
    const tree = createDispatcher("tree", { canUndoTree: true })
    await tree.dispatcher.dispatch("undo", "shortcut")
    expect(tree.calls).toEqual(["performUndoTree"])

    const editor = createDispatcher("editor")
    await editor.dispatcher.dispatch("undo", "menu")
    expect(editor.calls).toEqual(["performUndoEditor"])
  })

  // The tree's undo stack is part of the condition, not just the focused zone.
  it("skips tree undo when there is nothing on the stack", async () => {
    const { dispatcher, calls } = createDispatcher("tree", { canUndoTree: false })
    await dispatcher.dispatch("undo", "shortcut")
    expect(calls).toEqual([])
  })

  // Replace leaves focus in the widget; undo there belongs to the editor history.
  it("routes undo and redo from the find widget to the editor", async () => {
    const { dispatcher, calls } = createDispatcher("find-replace")

    await dispatcher.dispatch("undo", "menu")
    await dispatcher.dispatch("redo", "menu")

    expect(calls).toEqual(["performUndoEditor", "performRedoEditor"])
  })

  it("falls back to the default task when the focused one has no entry", async () => {
    const { dispatcher, calls } = createDispatcher("tab")
    await dispatcher.dispatch("newTab", "shortcut")
    expect(calls).toEqual(["performNewTab"])
  })

  // Paste takes its target from wherever the user pointed, so the two remaining
  // invocation channels resolve to different commands. The keyboard variant is a
  // keybinding now and no longer passes through here.
  it("distinguishes handlers by source within one task", async () => {
    const contextMenu = createDispatcher("tree", { treeHasClipboard: true })
    await contextMenu.dispatcher.dispatch("paste", "context-menu")
    expect(contextMenu.calls).toEqual(["performPasteTreeWithContextmenu"])

    const drag = createDispatcher("tree", { treeHasClipboard: true })
    await drag.dispatcher.dispatch("paste", "drag")
    expect(drag.calls).toEqual(["performPasteTreeWithDrag"])
  })

  it("falls back to the default source when the given one has no entry", async () => {
    const { dispatcher, calls } = createDispatcher("tree", { treeHasSelection: true })
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

  it("awaits the command so callers can sequence work after it", async () => {
    const order: string[] = []

    const commandRegistry = new CommandRegistry(new ContextKeyService())
    commandRegistry.register({
      id: "file.save",
      run: async () => {
        await Promise.resolve()
        order.push("command")
      },
    })
    const focusManager = {
      getFocusedTask: () => "editor" as Task,
      syncFocus: () => undefined,
    } as unknown as FocusManager

    await new Dispatcher(focusManager, commandRegistry).dispatch("save", "menu")
    order.push("after")

    expect(order).toEqual(["command", "after"])
  })

  // The table selects by task and the command re-checks it through its `when`;
  // a command reached in a context it does not apply to must not run.
  it("skips a command whose when does not hold", async () => {
    const contextKeyService = new ContextKeyService()
    contextKeyService.set("focusedTask", "editor")

    const run = vi.fn()
    const commandRegistry = new CommandRegistry(contextKeyService)
    commandRegistry.register({ id: "tree.undo", when: (ctx) => ctx.focusedTask === "tree", run })

    const focusManager = {
      getFocusedTask: () => "tree" as Task,
      syncFocus: () => undefined,
    } as unknown as FocusManager

    await new Dispatcher(focusManager, commandRegistry).dispatch("undo", "shortcut")

    expect(run).not.toHaveBeenCalled()
  })
})
