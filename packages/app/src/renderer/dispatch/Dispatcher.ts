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

			undo: {
				editor: { shortcut: "editor.undo.native", default: "editor.undo" },
				tree: { default: "tree.undo" },
				// Replace leaves focus in the widget, so Ctrl+Z there has to reach the
				// editor history the replacement was written into.
				"find-replace": { default: "editor.undo" },
			},
			redo: {
				editor: { shortcut: "editor.redo.native", default: "editor.redo" },
				tree: { default: "tree.redo" },
				"find-replace": { default: "editor.redo" },
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
				editor: { shortcut: "editor.cut.native", menu: "editor.cut" },
				tree: { default: "tree.cut" },
			},
			copy: {
				editor: { menu: "editor.copy" },
				tree: { default: "tree.copy" },
			},
			paste: {
				editor: { shortcut: "editor.paste.native", menu: "editor.paste" },
				tree: {
					"context-menu": "tree.pasteFromContextMenu",
					shortcut: "tree.pasteFromShortcut",
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

			//

			esc: {
				// Closing must work from any zone: clicking the tab bar or tree
				// leaves the task there (activeElement can be body), and a
				// per-zone table would silently swallow Esc in those cases.
				default: { shortcut: "find.close" },
			},
			enter: {
				"find-replace": { shortcut: "find.submit" },
				tree: { shortcut: "tree.open" },
			},
			shiftEnter: {
				"find-replace": { shortcut: "find.submitBackward" },
			},
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
