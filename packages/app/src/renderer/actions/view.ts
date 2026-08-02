import { CLASS_SELECTED } from "@renderer/constants/dom"
import type { MenuElements } from "@renderer/modules/menu/MenuElements"
import type { SideFacade } from "@renderer/modules/side/SideFacade"
import type { TabEditorFacade } from "@renderer/modules/tab_editor/TabEditorFacade"

/** Paints the word count's visibility state: the badge itself and its View menu tick. */
export function toggleWordCount(menuElements: MenuElements, sideFacade: SideFacade, tabEditorFacade: TabEditorFacade) {
  const visible = sideFacade.isWordCountVisible()

  menuElements.wordCount.classList.toggle(CLASS_SELECTED, visible)
  tabEditorFacade.renderer.elements.wordCount.style.display = visible ? "" : "none"
}
