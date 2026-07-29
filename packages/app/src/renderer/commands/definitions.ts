import type { SettingsViewModel } from "@renderer/viewmodels/SettingsViewModel"

import { exit, toggleSide } from "../actions"
import type { CommandContext, ICommandDescriptor, Task } from "../core"
import type {
  CommandManager,
  InfoFacade,
  MenuElements,
  SideFacade,
  TabEditorFacade,
  TreeFacade,
  ZoomManager,
} from "../modules"
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
  tabEditorFacade: TabEditorFacade
  treeFacade: TreeFacade
}

/** `when` for commands that only apply while a given UI zone holds focus. */
function inTask(...tasks: Task[]) {
  return (context: CommandContext) => tasks.includes(context.focusedTask)
}

/** Editing the document needs both the focus and a document to edit. */
const inEditor = (context: CommandContext) => context.focusedTask === "editor" && context.hasActiveEditor

/** Most tree commands act on the selection, so an empty one disables them. */
const inTreeSelection = (context: CommandContext) => context.focusedTask === "tree" && context.treeHasSelection

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
  const { commandManager, zoomManager, sideFacade, infoFacade, menuElements, tabEditorFacade, treeFacade } = deps

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
    // The tree keeps its own undo stack, so it can say whether there is anything
    // left to undo — which the editor's history cannot be asked for as cheaply.
    "tree.undo": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.canUndoTree,
      run: () => commandManager.performUndoTree(),
    },
    "tree.redo": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.canRedoTree,
      run: () => commandManager.performRedoTree(),
    },

    // Files
    "file.newTab": { run: () => commandManager.performNewTab() },
    "file.open": { run: (path?: string) => commandManager.performOpenFile(path) },
    "file.openDirectory": { run: () => commandManager.performOpenDirectoryByDialog() },
    "file.save": { run: () => commandManager.performSave() },
    "file.saveAs": { run: () => commandManager.performSaveAs() },
    "file.saveAll": { run: () => commandManager.performSaveAll() },

    // Tabs
    "tab.close": { run: (id: number) => commandManager.performCloseTab(id) },
    "tab.closeActive": { when: (ctx) => ctx.hasActiveEditor, run: () => commandManager.performCloseActiveTab() },
    "tab.closeOthers": { when: inTask("tab"), run: () => commandManager.performCloseOtherTabs() },
    "tab.closeToRight": { when: inTask("tab"), run: () => commandManager.performCloseTabsToRight() },
    "tab.closeAll": { when: inTask("tab"), run: () => commandManager.performCloseAllTabs() },

    // Tree items. Create is the one that works with nothing selected — it falls
    // back to the root directory; the rest need a node to act on, which is what
    // greys them out in the context menu.
    "tree.create": { when: inTask("tree"), run: (directory: boolean) => commandManager.performCreate(directory) },
    "tree.rename": { when: inTreeSelection, run: () => commandManager.performRename() },
    "tree.delete": { when: inTreeSelection, run: () => commandManager.performDelete() },
    "tree.open": {
      when: inTreeSelection,
      run: () => commandManager.performOpenFocusedTreeNode(),
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
    "tree.cut": { when: inTreeSelection, run: () => commandManager.performCutTree() },
    "tree.copy": { when: inTreeSelection, run: () => commandManager.performCopyTree() },
    // Esc completes the cut lifecycle: without a way to call one off, the
    // sources kept their greyed-out styling until something else replaced them.
    "tree.clearClipboard": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => commandManager.performClearTreeClipboard(),
    },
    // Paste needs something on the clipboard, not merely a selection — cutting
    // and then clicking elsewhere still leaves something to paste.
    "tree.pasteFromContextMenu": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => commandManager.performPasteTreeWithContextmenu(),
    },
    "tree.pasteFromShortcut": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => commandManager.performPasteTreeWithShortcut(),
    },
    "tree.pasteFromDrag": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => commandManager.performPasteTreeWithDrag(),
    },

    // Editor clipboard. The native variants let the browser move the text and
    // only mark the tab dirty; the others do the clipboard work by hand,
    // because a menu click carries no clipboard permission of its own.
    //
    // The native pair reach for the active view without checking it exists, so
    // requiring one here is what keeps that from throwing rather than a guard
    // repeated in each of them.
    "editor.cut": { when: inEditor, run: () => commandManager.performCutEditorManual() },
    "editor.cut.native": { when: inEditor, run: () => commandManager.performCutEditor() },
    "editor.copy": { when: inEditor, run: () => commandManager.performCopyEditor() },
    "editor.paste": { when: inEditor, run: () => commandManager.performPasteEditorManual() },
    "editor.paste.native": { when: inEditor, run: () => commandManager.performPasteEditor() },

    // Find and replace. With no tab open there is nothing to search, and the key
    // should reach whatever else wants it rather than being swallowed.
    "find.toggle": {
      when: (ctx) => ctx.hasActiveEditor,
      run: (replace: boolean) => commandManager.toggleFindReplaceBox(replace),
    },
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
    "app.exit": { run: () => exit(tabEditorFacade, treeFacade) },
  }

  return Object.entries(definitions).map(([id, definition]) => ({ id, ...definition }))
}
