import { DI } from "@renderer/constants"
import { inject, injectable } from "inversify"
import type { InfoElements } from "./InfoElements"

@injectable()
export class InfoFacade {
  constructor(@inject(DI.InfoElements) public readonly elements: InfoElements) {}

  showInformation() {
    this.elements.overlay.style.display = "flex"
  }

  hideInformation() {
    this.elements.overlay.style.display = "none"
  }
}
