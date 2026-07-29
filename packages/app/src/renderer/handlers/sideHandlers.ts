import { CUSTOM_EVENTS } from "@renderer/constants"
import type { SideFacade } from "@renderer/modules"
import { EventEmitter } from "events"

export function handleSide(emitter: EventEmitter, sideFacade: SideFacade) {
  const { resizer } = sideFacade.renderer.elements

  resizer.addEventListener("mousedown", () => {
    if (!sideFacade.isSideOpen()) return
    sideFacade.initDrag()
  })

  emitter.on(CUSTOM_EVENTS.MOUSE_MOVE.DEFAULT, (e) => {
    if (!sideFacade.isDragging()) return

    const width = sideFacade.calculateWidth(e.clientX)
    sideFacade.updateSideWidth(width)
  })

  emitter.on(CUSTOM_EVENTS.MOUSE_UP.DEFAULT, (e) => {
    if (!sideFacade.isDragging()) return

    sideFacade.clearDrag()

    const width = sideFacade.calculateWidth(e.clientX)
    sideFacade.setSideWidth(width)
    sideFacade.syncSession()
  })

  emitter.on(CUSTOM_EVENTS.MOUSE_LEAVE.DEFAULT, () => {
    if (!sideFacade.isDragging()) return
    sideFacade.clearDrag()
  })
}
