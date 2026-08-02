import type { SettingsViewModel } from "@renderer/viewmodels/SettingsViewModel"

import { exit, toggleSide, toggleWordCount } from "../actions"
import type { CommandContext, ICommandDescriptor, Task } from "../core"
import type {
  FindReplaceController,
  InfoFacade,
  MenuElements,
  SettingsController,
  SettingsFacade,
  SideFacade,
  TabController,
  TabEditorFacade,
  TreeController,
  TreeFacade,
  ZoomController,
} from "../modules"
import type { CommandId } from "./ids"

type CommandDefinition = Omit<ICommandDescriptor, "id">

/**
 * What the commands act on. Every command names the one service it drives — a
 * controller where the verb coordinates across modules, a facade where a plain
 * delegation is all there is.
 */
export type CommandDeps = {
  tabController: TabController
  treeController: TreeController
  settingsController: SettingsController
  findReplaceController: FindReplaceController
  zoomController: ZoomController
  sideFacade: SideFacade
  infoFacade: InfoFacade
  menuElements: MenuElements
  tabEditorFacade: TabEditorFacade
  treeFacade: TreeFacade
  settingsFacade: SettingsFacade
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
  const {
    tabController,
    treeController,
    settingsController,
    findReplaceController,
    zoomController,
    sideFacade,
    infoFacade,
    menuElements,
    tabEditorFacade,
    treeFacade,
    settingsFacade,
  } = deps

  // Record over CommandId, so a new id cannot be added without a definition.
  const definitions: Record<CommandId, CommandDefinition> = {
    // History. In the editor this performs the same prosemirror-history step the
    // editor's own keymap would; it also applies from the find widget, where
    // focus sits in an input after a replace. Both need a document to act on:
    // the empty editor container takes focus like any zone, and the run path
    // reaches for the active view without checking it exists.
    "editor.undo": {
      when: (ctx) => inTask("editor", "find-replace")(ctx) && ctx.hasActiveEditor,
      run: () => tabEditorFacade.undoEditor(),
    },
    "editor.redo": {
      when: (ctx) => inTask("editor", "find-replace")(ctx) && ctx.hasActiveEditor,
      run: () => tabEditorFacade.redoEditor(),
    },
    // The tree keeps its own undo stack, so it can say whether there is anything
    // left to undo — which the editor's history cannot be asked for as cheaply.
    "tree.undo": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.canUndoTree,
      run: () => treeController.performUndoTree(),
    },
    "tree.redo": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.canRedoTree,
      run: () => treeController.performRedoTree(),
    },

    // Files
    "file.newTab": { run: () => tabController.performNewTab() },
    "file.open": { run: (path?: string) => tabController.performOpenFile(path) },
    "file.openDirectory": { run: () => tabController.performOpenDirectoryByDialog() },
    // Save reads the active tab's dto without checking one exists, so the
    // condition lives here — it is also what greys File > Save out when there
    // is nothing to save. saveAll iterates whatever tabs there are and is
    // content with none.
    "file.save": { when: (ctx) => ctx.hasActiveEditor, run: () => tabController.performSave() },
    "file.saveAs": { when: (ctx) => ctx.hasActiveEditor, run: () => tabController.performSaveAs() },
    "file.saveAll": { run: () => tabController.performSaveAll() },

    // Tabs. Close takes its target from wherever the user pointed, so the close
    // button and the right-clicked tab are separate ids rather than one command
    // that has to work out which channel called it.
    "tab.close": { run: (id: number) => tabController.performCloseTab(id) },
    "tab.closeActive": { when: (ctx) => ctx.hasActiveEditor, run: () => tabController.performCloseActiveTab() },
    "tab.closeFromContextMenu": { when: inTask("tab"), run: () => tabController.performCloseContextTab() },
    "tab.closeOthers": { when: inTask("tab"), run: () => tabController.performCloseOtherTabs() },
    "tab.closeToRight": { when: inTask("tab"), run: () => tabController.performCloseTabsToRight() },
    "tab.closeAll": { when: inTask("tab"), run: () => tabController.performCloseAllTabs() },

    // Tree items. Create is the one that works with nothing selected — it falls
    // back to the root directory; the rest need a node to act on, which is what
    // greys them out in the context menu.
    "tree.create": { when: inTask("tree"), run: (directory: boolean) => treeController.performCreate(directory) },
    "tree.rename": { when: inTreeSelection, run: () => treeController.performRename() },
    "tree.delete": { when: inTreeSelection, run: () => treeController.performDelete() },
    "tree.open": {
      when: inTreeSelection,
      run: () => treeController.performOpenFocusedTreeNode(),
    },
    "tree.expandDirectory": {
      run: (node: HTMLElement) => treeController.performOpenDirectoryByTreeNode(node),
    },
    "tree.focusUp": {
      when: inTask("tree"),
      run: (extend: boolean) => treeController.performFocusTreeUp(extend),
    },
    "tree.focusDown": {
      when: inTask("tree"),
      run: (extend: boolean) => treeController.performFocusTreeDown(extend),
    },
    // A drop moves what was dragged, and the clipboard is no part of that. It
    // used to be spelled `tree.cut` followed by a paste, which meant a drag
    // silently threw away whatever the user had cut or copied earlier.
    "tree.move": { when: inTreeSelection, run: () => treeController.performMoveTreeFromDrag() },

    // Tree clipboard. Paste splits by where the target comes from: the
    // right-clicked node or the selection.
    "tree.cut": { when: inTreeSelection, run: () => treeController.performCutTree() },
    "tree.copy": { when: inTreeSelection, run: () => treeController.performCopyTree() },
    // Esc completes the cut lifecycle: without a way to call one off, the
    // sources kept their greyed-out styling until something else replaced them.
    "tree.clearClipboard": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => treeController.performClearTreeClipboard(),
    },
    // Paste needs something on the clipboard, not merely a selection — cutting
    // and then clicking elsewhere still leaves something to paste.
    "tree.pasteFromContextMenu": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => treeController.performPasteTreeWithContextmenu(),
    },
    "tree.pasteFromShortcut": {
      when: (ctx) => ctx.focusedTask === "tree" && ctx.treeHasClipboard,
      run: () => treeController.performPasteTreeWithShortcut(),
    },

    // Editor clipboard. The native variants let the browser move the text and
    // only mark the tab dirty; the others do the clipboard work by hand,
    // because a menu click carries no clipboard permission of its own.
    //
    // The native pair reach for the active view without checking it exists, so
    // requiring one here is what keeps that from throwing rather than a guard
    // repeated in each of them.
    "editor.cut": { when: inEditor, run: () => tabController.performCutEditorManual() },
    "editor.cut.native": { when: inEditor, run: () => tabController.performCutEditor() },
    "editor.copy": { when: inEditor, run: () => tabController.performCopyEditor() },
    "editor.paste": { when: inEditor, run: () => tabController.performPasteEditorManual() },
    "editor.paste.native": { when: inEditor, run: () => tabController.performPasteEditor() },

    // Find and replace. With no tab open there is nothing to search, and the key
    // should reach whatever else wants it rather than being swallowed. A binary
    // tab has no editor to search in either — without the second key, Edit >
    // Find paints enabled there and the click silently does nothing.
    "find.toggle": {
      when: (ctx) => ctx.hasActiveEditor && !ctx.editorIsBinary,
      run: (replace: boolean) => findReplaceController.toggleFindReplaceBox(replace),
    },
    "find.queryChanged": { run: (query: string) => findReplaceController.performSearchQueryChanged(query) },
    "find.replaceQueryChanged": { run: (query: string) => findReplaceController.performReplaceQueryChanged(query) },
    "find.toggleOption": {
      run: (option: "matchCase" | "wholeWord") => findReplaceController.performToggleSearchOption(option),
    },
    // Separate from the two above because it answers a different question: those
    // decide what counts as a match, this one only how a replacement is spelled,
    // so toggling it leaves the match list and the count alone.
    "find.togglePreserveCase": { run: () => findReplaceController.performTogglePreserveCase() },
    // Per tab rather than global like the other three: the range is a stretch of
    // one document, so it says nothing about the tab next door.
    "find.toggleInSelection": { run: () => findReplaceController.performToggleFindInSelection() },
    // Invoked from the find input's own ↑/↓ rather than the keybinding table:
    // this is navigation within one field, not a shortcut, and binding the arrows
    // for the whole zone would swallow them in the replace input next door.
    "find.history": {
      run: (direction: "older" | "newer") => findReplaceController.performSearchHistory(direction),
    },
    // Reachable from F3 with the box closed, so it carries the whole condition
    // for searching: a searchable document and a query to search for.
    "find.next": {
      when: (ctx) => ctx.hasActiveEditor && !ctx.editorIsBinary && ctx.hasSearchQuery,
      run: (direction: "up" | "down") => findReplaceController.performFind(direction),
    },
    "find.replace": { run: () => findReplaceController.performReplace() },
    // Both are reachable from a global key, so neither may act on a closed box:
    // Ctrl+Alt+Enter would rewrite the document with a stale query, and Esc
    // would consume a key the editor wants for its own purposes.
    "find.replaceAll": { when: (ctx) => ctx.findReplaceOpen, run: () => findReplaceController.performReplaceAll() },
    // Folds the replace row away without closing the box, which is what the
    // chevron is for; Ctrl+H opens the box and is a different question.
    "find.toggleReplaceRow": {
      when: (ctx) => ctx.findReplaceOpen,
      run: () => findReplaceController.performToggleReplaceRow(),
    },
    // Scoped to where closing is what Esc means: from the tree the same key
    // calls off a pending cut, and an unscoped close would win that race,
    // shut the box and pull focus into the editor mid-task. Closing hands
    // focus back to the editor, which is only right from these two zones.
    "find.close": {
      when: (ctx) => ctx.findReplaceOpen && inTask("editor", "find-replace")(ctx),
      run: () => findReplaceController.performCloseFindReplaceBox(),
    },
    "find.submit": {
      when: inTask("find-replace"),
      run: () => findReplaceController.performFindOrReplaceByActiveElement("down"),
    },
    "find.submitBackward": {
      when: inTask("find-replace"),
      run: () => findReplaceController.performFindOrReplaceByActiveElement("up"),
    },

    // View
    "view.zoomIn": { run: () => zoomController.zoomIn() },
    "view.zoomOut": { run: () => zoomController.zoomOut() },
    "view.zoomReset": { run: () => zoomController.resetZoom() },
    "view.toggleSide": {
      run: () => {
        sideFacade.setSideOpenState(!sideFacade.isSideOpen())
        sideFacade.syncSession()
        toggleSide(menuElements, sideFacade)
      },
    },
    "view.toggleWordCount": {
      run: () => {
        sideFacade.setWordCountVisibleState(!sideFacade.isWordCountVisible())
        sideFacade.syncSession()
        toggleWordCount(menuElements, sideFacade, tabEditorFacade)
      },
    },

    // Settings and help
    "settings.open": { run: () => settingsFacade.openSettings() },
    "settings.apply": { run: (viewModel: SettingsViewModel) => settingsController.performApplySettings(viewModel) },
    "settings.applyAndSave": {
      run: (viewModel: SettingsViewModel) => settingsController.performApplyAndSaveSettings(viewModel),
    },
    "help.showInformation": { run: () => infoFacade.showInformation() },
    "app.exit": { run: () => exit(tabEditorFacade, treeFacade) },
  }

  return Object.entries(definitions).map(([id, definition]) => ({ id, ...definition }))
}
