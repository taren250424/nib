import type { TabEditorElements } from "../modules/tab_editor/TabEditorElements"
import type { TreeElements } from "../modules/tree/TreeElements"
import type { CommandId } from "./ids"

export type ContextMenuBinding<E> = {
  /** Which element of the menu's elements object this row drives. */
  element: keyof E
  /**
   * Candidates, in the order they are tried, exactly as in the menu bar. Each
   * of these happens to have one, since a context menu already knows which
   * thing was right-clicked.
   */
  commands: readonly CommandId[]
  args?: readonly unknown[]
}

/**
 * The context menus, as bindings from an item to the command behind it.
 *
 * Same shape and same reasoning as MENU_BINDINGS: the click and the enabled
 * state come off one row, so they cannot disagree. Before this, the only thing
 * these menus greyed out was Paste, by a rule written out next to the menu code
 * rather than next to the command — and the two had already drifted apart once.
 *
 * Which node or tab the command acts on is not an argument here. A right-click
 * target is its own invocation channel, so it gets its own command id
 * (tree.pasteFromContextMenu, tab.closeFromContextMenu) that reads the target
 * where it is recorded, instead of the table having to resolve it at click time.
 */
export const TREE_CONTEXT_MENU_BINDINGS: readonly ContextMenuBinding<TreeElements>[] = [
  { element: "treeContextCut", commands: ["tree.cut"] },
  { element: "treeContextCopy", commands: ["tree.copy"] },
  { element: "treeContextPaste", commands: ["tree.pasteFromContextMenu"] },
  { element: "treeContextRename", commands: ["tree.rename"] },
  { element: "treeContextDelete", commands: ["tree.delete"] },
]

export const TAB_CONTEXT_MENU_BINDINGS: readonly ContextMenuBinding<TabEditorElements>[] = [
  { element: "tabContextClose", commands: ["tab.closeFromContextMenu"] },
  { element: "tabContextCloseOthers", commands: ["tab.closeOthers"] },
  { element: "tabContextCloseRight", commands: ["tab.closeToRight"] },
  { element: "tabContextCloseAll", commands: ["tab.closeAll"] },
]
