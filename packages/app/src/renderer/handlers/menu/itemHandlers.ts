import type { MenuElements } from "@renderer/modules"
import { CLASS_SELECTED } from "../../constants/dom"
import { CUSTOM_EVENTS, DOM } from "@renderer/constants"
import type { EventEmitter } from "events"

export function handleMenuItems(emitter: EventEmitter, menuElements: MenuElements) {
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

  emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.OUT.MENU_ITEM, () => {
    menuItems.forEach((i) => i.classList.remove(DOM.CLASS_SELECTED))
    // const target = e.target as HTMLElement
    // const isInMenuItem = !!target.closest(DOM.SELECTOR_MENU_ITEM)
    // if (!isInMenuItem) menuItems.forEach((i) => i.classList.remove(DOM.CLASS_SELECTED))
  })
}
