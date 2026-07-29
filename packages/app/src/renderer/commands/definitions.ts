import type { SettingsViewModel } from "@renderer/viewmodels/SettingsViewModel"

import { toggleSide } from "../actions"
import type { CommandContext, ICommandDescriptor, Task } from "../core"
import type { CommandManager, InfoFacade, MenuElements, SideFacade, ZoomManager } from "../modules"
import type { CommandId } from "./ids"

type CommandDefinition = Omit<ICommandDescriptor, "id">

/**
 * What the commands act on. Most reach the app through CommandManager; the rest
 * name the one service they drive, rather than growing CommandManager further.
 */
export type CommandDeps = {
	commandManager: CommandManager
	zoomManager: ZoomManager
	sideFacade: SideFacade
	infoFacade: InfoFacade
	menuElements: MenuElements
}

/** `when` for commands that only apply while a given UI zone holds focus. */
function inTask(...tasks: Task[]) {
	return (context: CommandContext) => tasks.includes(context.focusedTask)
}

/**
 * Every command, paired with the context it applies in.
 *
 * The conditions here restate what the dispatch table encoded in its task
 * dimension, which is why the two agree today. They are the copy that survives:
 * once keybindings and menus address command ids directly, the table goes and
 * `when` becomes the only answer to whether a command applies — including for
 * greying out menu items, which nothing can do while the answer only exists as
 * table structure.
 *
 * A `when` is a gate, not a guarantee. Commands run through a serial queue, so
 * the apply-time revalidation inside them stays necessary.
 */
export function createCommandDescriptors(deps: CommandDeps): ICommandDescriptor[] {
	const { commandManager, zoomManager, sideFacade, infoFacade, menuElements } = deps

	// Record over CommandId, so a new id cannot be added without a definition.
	const definitions: Record<CommandId, CommandDefinition> = {
		// History. In the editor this performs the same prosemirror-history step the
		// editor's own keymap would; it also applies from the find widget, where
		// focus sits in an input after a replace.
		"editor.undo": {
			when: inTask("editor", "find-replace"),
			run: () => commandManager.performUndoEditor(),
		},
		"editor.redo": {
			when: inTask("editor", "find-replace"),
			run: () => commandManager.performRedoEditor(),
		},
		"tree.undo": { when: inTask("tree"), run: () => commandManager.performUndoTree() },
		"tree.redo": { when: inTask("tree"), run: () => commandManager.performRedoTree() },

		// Files
		"file.newTab": { run: () => commandManager.performNewTab() },
		"file.open": { run: (path?: string) => commandManager.performOpenFile(path) },
		"file.openDirectory": { run: () => commandManager.performOpenDirectoryByDialog() },
		"file.save": { run: () => commandManager.performSave() },
		"file.saveAs": { run: () => commandManager.performSaveAs() },
		"file.saveAll": { run: () => commandManager.performSaveAll() },

		// Tabs
		"tab.close": { run: (id: number) => commandManager.performCloseTab(id) },
		"tab.closeActive": { run: () => commandManager.performCloseActiveTab() },
		"tab.closeOthers": { when: inTask("tab"), run: () => commandManager.performCloseOtherTabs() },
		"tab.closeToRight": { when: inTask("tab"), run: () => commandManager.performCloseTabsToRight() },
		"tab.closeAll": { when: inTask("tab"), run: () => commandManager.performCloseAllTabs() },

		// Tree items
		"tree.create": { when: inTask("tree"), run: (directory: boolean) => commandManager.performCreate(directory) },
		"tree.rename": { when: inTask("tree"), run: () => commandManager.performRename() },
		"tree.delete": { when: inTask("tree"), run: () => commandManager.performDelete() },
		"tree.open": {
			when: inTask("tree"),
			run: () => commandManager.performOpenFileOrDirectoryByLastSelectedIndex(),
		},
		"tree.expandDirectory": {
			run: (node: HTMLElement) => commandManager.performOpenDirectoryByTreeNode(node),
		},
		"tree.focusUp": {
			when: inTask("tree"),
			run: (extend: boolean) => commandManager.performFocusTreeUp(extend),
		},
		"tree.focusDown": {
			when: inTask("tree"),
			run: (extend: boolean) => commandManager.performFocusTreeDown(extend),
		},

		// Tree clipboard. Paste splits by where the target comes from: the
		// right-clicked node, the selection, or the node a drag was dropped on.
		"tree.cut": { when: inTask("tree"), run: () => commandManager.performCutTree() },
		"tree.copy": { when: inTask("tree"), run: () => commandManager.performCopyTree() },
		"tree.pasteFromContextMenu": {
			when: inTask("tree"),
			run: () => commandManager.performPasteTreeWithContextmenu(),
		},
		"tree.pasteFromShortcut": {
			when: inTask("tree"),
			run: () => commandManager.performPasteTreeWithShortcut(),
		},
		"tree.pasteFromDrag": { when: inTask("tree"), run: () => commandManager.performPasteTreeWithDrag() },

		// Editor clipboard. The native variants let the browser move the text and
		// only mark the tab dirty; the others do the clipboard work by hand,
		// because a menu click carries no clipboard permission of its own.
		"editor.cut": { when: inTask("editor"), run: () => commandManager.performCutEditorManual() },
		"editor.cut.native": { when: inTask("editor"), run: () => commandManager.performCutEditor() },
		"editor.copy": { when: inTask("editor"), run: () => commandManager.performCopyEditor() },
		"editor.paste": { when: inTask("editor"), run: () => commandManager.performPasteEditorManual() },
		"editor.paste.native": { when: inTask("editor"), run: () => commandManager.performPasteEditor() },

		// Find and replace
		"find.toggle": { run: (replace: boolean) => commandManager.toggleFindReplaceBox(replace) },
		"find.queryChanged": { run: (query: string) => commandManager.performSearchQueryChanged(query) },
		"find.replaceQueryChanged": { run: (query: string) => commandManager.performReplaceQueryChanged(query) },
		"find.toggleOption": {
			run: (option: "matchCase" | "wholeWord" | "useRegex") => commandManager.performToggleSearchOption(option),
		},
		"find.next": { run: (direction: "up" | "down") => commandManager.performFind(direction) },
		"find.replace": { run: () => commandManager.performReplace() },
		// Both are reachable from a global key, so neither may act on a closed box:
		// Ctrl+Alt+Enter would rewrite the document with a stale query, and Esc
		// would consume a key the editor wants for its own purposes.
		"find.replaceAll": { when: (ctx) => ctx.findReplaceOpen, run: () => commandManager.performReplaceAll() },
		"find.close": { when: (ctx) => ctx.findReplaceOpen, run: () => commandManager.performCloseFindReplaceBox() },
		"find.submit": {
			when: inTask("find-replace"),
			run: () => commandManager.performFindOrReplaceByActiveElement("down"),
		},
		"find.submitBackward": {
			when: inTask("find-replace"),
			run: () => commandManager.performFindOrReplaceByActiveElement("up"),
		},

		// View
		"view.zoomIn": { run: () => zoomManager.zoomIn() },
		"view.zoomOut": { run: () => zoomManager.zoomOut() },
		"view.zoomReset": { run: () => zoomManager.resetZoom() },
		"view.toggleSide": {
			run: () => {
				sideFacade.setSideOpenState(!sideFacade.isSideOpen())
				sideFacade.syncSession()
				toggleSide(menuElements, sideFacade)
			},
		},

		// Settings and help
		"settings.open": { run: () => commandManager.performOpenSettings() },
		"settings.apply": { run: (viewModel: SettingsViewModel) => commandManager.performApplySettings(viewModel) },
		"settings.applyAndSave": {
			run: (viewModel: SettingsViewModel) => commandManager.performApplyAndSaveSettings(viewModel),
		},
		"help.showInformation": { run: () => infoFacade.showInformation() },
	}

	return Object.entries(definitions).map(([id, definition]) => ({ id, ...definition }))
}
