import { DI } from "@renderer/constants"
import { inject, injectable } from "inversify"
import { SideStore } from "./SideStore"
import { SideRenderer } from "./SideRenderer"
import { SideDragState } from "./SideDragState"

@injectable()
export class SideFacade {
  constructor(
    @inject(DI.SideStore) public readonly store: SideStore,
    @inject(DI.SideRenderer) public readonly renderer: SideRenderer,
    @inject(DI.SideDragState) public readonly drag: SideDragState
  ) {}

  // store

  isSideOpen(): boolean {
    return this.store.isSideOpen()
  }

  setSideOpenState(state: boolean) {
    this.store.setSideOpenState(state)
  }

  getSideWidth() {
    return this.store.getSideWidth()
  }

  setSideWidth(width: number) {
    this.store.setSideWidth(width)
  }

  // renderer

  updateSideWidth(width: number) {
    this.renderer.updateSideWidth(width)
  }

  // drag

  isDragging(): boolean {
    return this.drag.isDragging()
  }

  startDrag() {
    this.drag.startDrag()
  }

  endDrag() {
    this.drag.endDrag()
  }

  //

  get dragMinWidth() {
    return this.drag.minWidth
  }

  get dragMaxWidth() {
    return this.drag.maxWidth
  }

  // orchestra - drag

  initDrag() {
    this.startDrag()
    this.renderer.setResizingCursor(true)
  }

  calculateWidth(clientX: number) {
    const sideLeft = this.renderer.elements.side.getBoundingClientRect().left
    const offsetX = clientX - sideLeft
    return Math.min(Math.max(offsetX, this.dragMinWidth), this.dragMaxWidth)
  }

  clearDrag() {
    this.endDrag()
    this.renderer.setResizingCursor(false)
  }

  // orchestra

  async syncSession() {
    await window.rendererToMain.syncSideSessionFromRenderer({
      open: this.isSideOpen(),
      width: this.getSideWidth(),
    })
  }
}
