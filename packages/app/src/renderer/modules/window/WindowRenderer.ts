import { DI } from "@renderer/constants"
import { inject, injectable } from "inversify"
import type { WindowElements } from "./WindowElements"
import maximizeSvg from "../../assets/icons/maximize.svg?raw"
import unmaximizeSvg from "../../assets/icons/unmaximize.svg?raw"

@injectable()
export class WindowRenderer {
  constructor(@inject(DI.WindowElements) public readonly elements: WindowElements) {}

  renderMaximizeButtonSvg() {
    this.elements.maximizeBtn.querySelector("svg")!.outerHTML = maximizeSvg
  }

  renderUnMaximizeButtonSvg() {
    this.elements.maximizeBtn.querySelector("svg")!.outerHTML = unmaximizeSvg
  }
}
