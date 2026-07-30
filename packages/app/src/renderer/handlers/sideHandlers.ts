import { MOUSE_EVENTS, type MouseEventBus } from "@renderer/core"
import type { SideFacade } from "@renderer/modules"

export function handleSide(mouseBus: MouseEventBus, sideFacade: SideFacade) {
  const { resizer } = sideFacade.renderer.elements

  resizer.addEventListener("mousedown", () => {
    if (!sideFacade.isSideOpen()) return
    sideFacade.initDrag()
  })

  mouseBus.on(MOUSE_EVENTS.MOVE, (e) => {
    if (!sideFacade.isDragging()) return

    const width = sideFacade.calculateWidth(e.clientX)
    sideFacade.updateSideWidth(width)
  })

  mouseBus.on(MOUSE_EVENTS.UP, (e) => {
    if (!sideFacade.isDragging()) return

    sideFacade.clearDrag()

    const width = sideFacade.calculateWidth(e.clientX)
    sideFacade.setSideWidth(width)
    sideFacade.syncSession()
  })

  mouseBus.on(MOUSE_EVENTS.LEAVE, () => {
    if (!sideFacade.isDragging()) return
    sideFacade.clearDrag()
  })
}
