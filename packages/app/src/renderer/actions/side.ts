import { CLASS_SELECTED } from "@renderer/constants/dom"
import type { MenuElements } from "@renderer/modules/menu/MenuElements"
import type { SideFacade } from "@renderer/modules/side/SideFacade"

export function toggleSide(menuElements: MenuElements, sideFacade: SideFacade) {
  const { fileTree } = menuElements
  const { tree } = sideFacade.renderer.elements

  const isOpen = sideFacade.isSideOpen()

  if (isOpen) {
    tree.style.width = `${sideFacade.getSideWidth()}px`
    fileTree.classList.add(CLASS_SELECTED)
  } else {
    tree.style.width = "0px"
    fileTree.classList.remove(CLASS_SELECTED)
  }
}
