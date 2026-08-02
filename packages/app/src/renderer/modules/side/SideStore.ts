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

  // The word count badge is View-menu state like the tree, so it lives with
  // the rest of that state and rides the same session. If a third View toggle
  // ever appears, this store is what graduates into a view session.
  private _isWordCountVisible = true

  isWordCountVisible(): boolean {
    return this._isWordCountVisible
  }

  setWordCountVisibleState(state: boolean) {
    this._isWordCountVisible = state
  }
}
