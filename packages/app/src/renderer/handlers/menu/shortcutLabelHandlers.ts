import { TAB_CONTEXT_MENU_BINDINGS, TREE_CONTEXT_MENU_BINDINGS } from "@renderer/commands/contextMenuBindings"
import { MENU_BINDINGS } from "@renderer/commands/menuBindings"
import { shortcutLabelFor } from "@renderer/commands/shortcutLabels"
import { DOM } from "@renderer/constants"
import type { MenuElements } from "@renderer/modules"
import type { TabEditorElements } from "@renderer/modules/tab_editor/TabEditorElements"
import type { TreeElements } from "@renderer/modules/tree/TreeElements"

type LabelledBinding<E> = {
  element: keyof E
  commands: readonly never[] | readonly string[]
  args?: readonly unknown[]
  keyFrom?: string
  keyLabel?: string
}

function writeLabels<E extends object>(bindings: readonly LabelledBinding<E>[], elements: E) {
  for (const binding of bindings) {
    const element = elements[binding.element] as HTMLElement
    const span = element.querySelector(DOM.SELECTOR_SHORTCUT)
    if (!span) continue

    span.textContent = shortcutLabelFor(binding as Parameters<typeof shortcutLabelFor>[0])
  }
}

/**
 * Fills in every menu's shortcut label from the keybinding table.
 *
 * Written once at startup rather than kept in sync: nothing rebinds keys at
 * runtime yet, and when something does, this is the one place that has to be
 * called again.
 */
export function handleShortcutLabels(
  menuElements: MenuElements,
  treeElements: TreeElements,
  tabEditorElements: TabEditorElements
) {
  writeLabels(MENU_BINDINGS, menuElements)
  writeLabels(TREE_CONTEXT_MENU_BINDINGS, treeElements)
  writeLabels(TAB_CONTEXT_MENU_BINDINGS, tabEditorElements)
}
