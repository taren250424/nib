import { injectable } from "inversify"

@injectable()
export class SideDragState {
  readonly minWidth = 100
  readonly maxWidth = 500

  private _isDragging = false

  //

  isDragging(): boolean {
    return this._isDragging
  }

  startDrag() {
    this._isDragging = true
  }

  endDrag() {
    this._isDragging = false
  }
}
