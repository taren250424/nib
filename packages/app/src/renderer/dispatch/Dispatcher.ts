import { inject, injectable } from "inversify"
import type { Task } from "../core"
import { CommandRegistry, FocusManager } from "../core"
import { DI } from "../constants"
import type { CommandId } from "../commands/ids"
import { assert } from "../utils"
import type { AppEvents, Source } from "./types"

/**
 * Resolves a UI event to the command it invokes.
 *
 * This is the transitional half of the command work: the table below now only
 * names commands, while what they do and when they apply lives in the registry.
 * Once keybindings and menus address command ids directly, both the task and
 * source dimensions become properties of the binding rather than lookups, and
 * this class goes away.
 */
@injectable()
export class Dispatcher {
  private readonly _commandIds: {
    [E in AppEvents]: Partial<Record<Task | "default", Partial<Record<Source | "default", CommandId>>>>
  }

  constructor(
    @inject(DI.FocusManager) private readonly focusManager: FocusManager,
    @inject(DI.CommandRegistry) private readonly commandRegistry: CommandRegistry
  ) {
    this._commandIds = {
      //

      // The find widget keeps focus after a replace, so Edit > Undo clicked from
      // there still has to reach the editor history it was written into.
      undo: {
        editor: { default: "editor.undo" },
        "find-replace": { default: "editor.undo" },
        tree: { default: "tree.undo" },
      },
      redo: {
        editor: { default: "editor.redo" },
        "find-replace": { default: "editor.redo" },
        tree: { default: "tree.redo" },
      },

      //

      newTab: { default: { default: "file.newTab" } },
      openFile: { default: { default: "file.open" } },
      openDirectoryByDialog: { default: { default: "file.openDirectory" } },
      openDirectoryByTreeNode: { default: { default: "tree.expandDirectory" } },
      save: { default: { default: "file.save" } },
      saveAs: { default: { default: "file.saveAs" } },
      saveAll: { default: { default: "file.saveAll" } },

      //

      closeTab: { default: { default: "tab.close" } },
      closeOtherTabs: { tab: { default: "tab.closeOthers" } },
      closeTabsToRight: { tab: { default: "tab.closeToRight" } },
      closeAllTabs: { tab: { default: "tab.closeAll" } },

      //

      create: { tree: { default: "tree.create" } },
      rename: { tree: { default: "tree.rename" } },
      delete: { tree: { default: "tree.delete" } },

      //

      cut: {
        editor: { menu: "editor.cut" },
        tree: { default: "tree.cut" },
      },
      copy: {
        editor: { menu: "editor.copy" },
        tree: { default: "tree.copy" },
      },
      paste: {
        editor: { menu: "editor.paste" },
        tree: {
          "context-menu": "tree.pasteFromContextMenu",
          drag: "tree.pasteFromDrag",
        },
      },

      //

      toggleFindReplace: { default: { default: "find.toggle" } },
      searchQueryChanged: { default: { menu: "find.queryChanged" } },
      replaceQueryChanged: { default: { menu: "find.replaceQueryChanged" } },
      toggleSearchOption: { default: { menu: "find.toggleOption" } },
      find: { default: { default: "find.next" } },
      replace: { default: { default: "find.replace" } },
      replaceAll: { default: { default: "find.replaceAll" } },
      closeFindReplace: { default: { default: "find.close" } },

      //

      applySettings: {
        // Dispatched programmatically (e.g. session load), so it must not
        // depend on which UI zone happens to hold focus at that moment —
        // restored tabs focus the editor before initSettings runs.
        default: { programmatic: "settings.apply" },
      },
      applyAndSaveSettings: { default: { default: "settings.applyAndSave" } },
    }
  }

  async dispatch(event: AppEvents, source: Source, ...args: any[]) {
    // The table resolves by the focused task while the command's `when` reads it
    // from the context keys, so the two have to be looking at the same moment.
    // Focus events publish on a microtask, which a synchronous dispatch can
    // outrun; syncing here closes that gap and costs nothing when unchanged.
    this.focusManager.syncFocus()

    const task = this.focusManager.getFocusedTask()

    const eventNode = this._commandIds[event]
    assert(eventNode, `Missing event: ${event}`)

    const taskNode = eventNode[task] || eventNode["default"]
    if (!taskNode) {
      if (source === "shortcut") return
      assert(taskNode, `Missing task node: ${event} > ${task}`)
      return
    }

    const commandId = taskNode[source] || taskNode["default"]
    if (!commandId) {
      if (source === "shortcut") return
      assert(commandId, `Missing handler: ${event} > ${task} > ${source}`)
      return
    }

    await this.commandRegistry.execute(commandId, ...args)
  }
}
