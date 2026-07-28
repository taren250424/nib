import { inject, injectable } from "inversify"
import type { Task } from "../core"
import { FocusManager } from "../core"
import { DI } from "../constants"
import { CommandManager } from "../modules"
import { assert } from "../utils"
import type { AppEvents, Source } from "./types"
import type { SettingsViewModel } from "@renderer/viewmodels/SettingsViewModel"

@injectable()
export class Dispatcher {
	private readonly _handlers: {
		[E in AppEvents]: Partial<
			Record<Task | "default", Partial<Record<Source | "default", (...args: any[]) => void | Promise<void>>>>
		>
	}

	constructor(
		@inject(DI.FocusManager) private readonly focusManager: FocusManager,
		@inject(DI.CommandManager) private readonly commandManager: CommandManager
	) {
		this._handlers = {
			//

			undo: {
				editor: {
					shortcut: () => {
						/* intentional no-op */
					},
					default: async () => this.commandManager.performUndoEditor(),
				},
				tree: { default: async () => await this.commandManager.performUndoTree() },
			},
			redo: {
				editor: {
					shortcut: () => {
						/* intentional no-op */
					},
					default: async () => this.commandManager.performRedoEditor(),
				},
				tree: { default: async () => await this.commandManager.performRedoTree() },
			},

			//

			newTab: { default: { default: async () => await this.commandManager.performNewTab() } },
			openFile: { default: { default: (path) => this.commandManager.performOpenFile(path) } },
			openDirectoryByDialog: {
				default: { default: async () => await this.commandManager.performOpenDirectoryByDialog() },
			},
			openDirectoryByTreeNode: {
				default: { default: async (node) => await this.commandManager.performOpenDirectoryByTreeNode(node) },
			},
			save: { default: { default: async () => await this.commandManager.performSave() } },
			saveAs: { default: { default: async () => await this.commandManager.performSaveAs() } },
			saveAll: { default: { default: async () => await this.commandManager.performSaveAll() } },

			//

			closeTab: {
				default: {
					default: (id: number) => this.commandManager.performCloseTab(id),
				},
			},
			closeOtherTabs: {
				tab: {
					default: () => this.commandManager.performCloseOtherTabs(),
				},
			},
			closeTabsToRight: {
				tab: {
					default: () => this.commandManager.performCloseTabsToRight(),
				},
			},
			closeAllTabs: {
				tab: {
					default: () => this.commandManager.performCloseAllTabs(),
				},
			},

			//

			create: {
				tree: {
					default: (directory: boolean) => this.commandManager.performCreate(directory),
				},
			},
			rename: {
				tree: {
					default: async () => await this.commandManager.performRename(),
				},
			},
			delete: {
				tree: {
					default: async () => await this.commandManager.performDelete(),
				},
			},

			//

			cut: {
				editor: {
					shortcut: async () => this.commandManager.performCutEditor(),
					menu: async () => await this.commandManager.performCutEditorManual(),
				},
				tree: { default: async () => this.commandManager.performCutTree() },
			},
			copy: {
				editor: {
					menu: async () => await this.commandManager.performCopyEditor(),
				},
				tree: { default: async () => this.commandManager.performCopyTree() },
			},
			paste: {
				editor: {
					shortcut: async () => this.commandManager.performPasteEditor(),
					menu: async () => await this.commandManager.performPasteEditorManual(),
				},
				tree: {
					"context-menu": async () => await this.commandManager.performPasteTreeWithContextmenu(),
					shortcut: async () => await this.commandManager.performPasteTreeWithShortcut(),
					drag: async () => await this.commandManager.performPasteTreeWithDrag(),
				},
			},

			//

			toggleFindReplace: {
				default: {
					default: (replace) => this.commandManager.toggleFindReplaceBox(replace),
				},
			},
			searchQueryChanged: {
				default: {
					menu: (query: string) => this.commandManager.performSearchQueryChanged(query),
				},
			},
			replaceQueryChanged: {
				default: {
					menu: (query: string) => this.commandManager.performReplaceQueryChanged(query),
				},
			},
			toggleSearchOption: {
				default: {
					menu: (option: "matchCase" | "wholeWord" | "useRegex") =>
						this.commandManager.performToggleSearchOption(option),
				},
			},
			find: {
				default: {
					default: (direction: "up" | "down") => this.commandManager.performFind(direction),
				},
			},
			replace: {
				default: {
					default: async () => this.commandManager.performReplace(),
				},
			},
			replaceAll: {
				default: {
					default: async () => this.commandManager.performReplaceAll(),
				},
			},
			closeFindReplace: {
				default: {
					default: async () => this.commandManager.performCloseFindReplaceBox(),
				},
			},

			//

			applySettings: {
				// Dispatched programmatically (e.g. session load), so it must not
				// depend on which UI zone happens to hold focus at that moment —
				// restored tabs focus the editor before initSettings runs.
				default: {
					programmatic: (viewModel: SettingsViewModel) => this.commandManager.performApplySettings(viewModel),
				},
			},
			applyAndSaveSettings: {
				default: {
					default: (viewModel: SettingsViewModel) => this.commandManager.performApplyAndSaveSettings(viewModel),
				},
			},

			//

			esc: {
				// Closing must work from any zone: clicking the tab bar or tree
				// leaves the task there (activeElement can be body), and a
				// per-zone table would silently swallow Esc in those cases.
				default: {
					shortcut: async () => this.commandManager.performCloseFindReplaceBox(),
				},
			},
			enter: {
				"find-replace": {
					shortcut: async () => this.commandManager.performFindOrReplaceByActiveElement("down"),
				},
				tree: {
					shortcut: async () => await this.commandManager.performOpenFileOrDirectoryByLastSelectedIndex(),
				},
			},
			shiftEnter: {
				"find-replace": {
					shortcut: async () => this.commandManager.performFindOrReplaceByActiveElement("up"),
				},
			},
		}
	}

	async dispatch(event: AppEvents, source: Source, ...args: any[]) {
		const task = this.focusManager.getFocusedTask()

		const eventNode = this._handlers[event]
		assert(eventNode, `Missing event: ${event}`)

		const taskNode = eventNode[task] || eventNode["default"]
		if (!taskNode) {
			if (source === "shortcut") return
			assert(taskNode, `Missing task node: ${event} > ${task}`)
			return
		}

		const handler = taskNode[source] || taskNode["default"]
		if (!handler) {
			if (source === "shortcut") return
			assert(handler, `Missing handler: ${event} > ${task} > ${source}`)
			return
		}

		await handler(...args)
	}
}
