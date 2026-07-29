import { DI } from "@renderer/constants"
import { inject, injectable } from "inversify"
import { SideElements } from "./SideElements"

@injectable()
export class SideRenderer {
  constructor(@inject(DI.SideElements) readonly elements: SideElements) {}

  updateSideWidth(width: number) {
    this.elements.tree.style.width = `${width}px`
  }

  setResizingCursor(isResizing: boolean) {
    document.body.style.cursor = isResizing ? "ew-resize" : ""
    document.body.style.userSelect = isResizing ? "none" : ""
  }
}
