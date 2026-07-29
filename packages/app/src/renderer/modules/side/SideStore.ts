import { injectable } from "inversify"

@injectable()
export class SideStore {
  private _isSideOpen = true
  private _sideWidth = 150

  isSideOpen(): boolean {
    return this._isSideOpen
  }

  setSideOpenState(state: boolean) {
    this._isSideOpen = state
  }

  getSideWidth() {
    return this._sideWidth
  }

  setSideWidth(width: number) {
    this._sideWidth = width
  }
}
