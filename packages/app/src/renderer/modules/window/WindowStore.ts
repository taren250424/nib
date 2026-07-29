import { injectable } from "inversify"

@injectable()
export class WindowStore {
  private _maximize = false

  isWindowMaximize(): boolean {
    return this._maximize
  }

  setWindowMaximizeState(state: boolean) {
    this._maximize = state
  }
}
