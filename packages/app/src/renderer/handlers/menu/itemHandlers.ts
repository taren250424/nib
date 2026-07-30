import type { MenuElements } from "@renderer/modules"
import { CLASS_SELECTED } from "../../constants/dom"
import { DOM } from "@renderer/constants"
import { UI_ZONES, mouseDownOutside, type MouseEventBus } from "@renderer/core"

export function handleMenuItems(mouseBus: MouseEventBus, menuElements: MenuElements) {
  const { menuItems } = menuElements

  menuItems.forEach((item) => {
    item.addEventListener("click", () => {
      menuItems.forEach((i) => {
        if (i !== item) i.classList.remove(CLASS_SELECTED)
      })

      item.classList.toggle(CLASS_SELECTED)
    })

    item.addEventListener("mouseenter", () => {
      const anyActive = Array.from(menuItems).some((i) => i.classList.contains(CLASS_SELECTED))
      if (anyActive) {
        menuItems.forEach((i) => i.classList.remove(CLASS_SELECTED))
        item.classList.add(CLASS_SELECTED)
      }
    })
  })

  mouseBus.on(mouseDownOutside(UI_ZONES.MENU_ITEM.id), () => {
    menuItems.forEach((i) => i.classList.remove(DOM.CLASS_SELECTED))
  })
}
