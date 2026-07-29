import { DI } from "@renderer/constants"
import { inject, injectable } from "inversify"
import type { WindowStore } from "./WindowStore"

import type { WindowRenderer } from "./WindowRenderer"

@injectable()
export class WindowFacade {
  constructor(
    @inject(DI.WindowStore) public readonly store: WindowStore,
    @inject(DI.WindowRenderer) public readonly renderer: WindowRenderer
  ) {}

  isWindowMaximize(): boolean {
    return this.store.isWindowMaximize()
  }

  setWindowMaximizeState(state: boolean) {
    this.store.setWindowMaximizeState(state)
  }

  renderMaximizeButtonSvg() {
    this.renderer.renderMaximizeButtonSvg()
  }

  renderUnMaximizeButtonSvg() {
    this.renderer.renderUnMaximizeButtonSvg()
  }
}
