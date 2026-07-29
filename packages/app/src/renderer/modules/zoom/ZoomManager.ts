export class ZoomManager {
  private zoomLevel = 1

  zoomIn() {
    this._setZoom(this.zoomLevel + 0.1)
  }

  zoomOut() {
    this._setZoom(this.zoomLevel - 0.1)
  }

  resetZoom() {
    this._setZoom(1)
  }

  private _setZoom(level: number) {
    this.zoomLevel = Math.max(0.1, Math.min(level, 3))
    window.utils.setZoomFactor(this.zoomLevel)
  }
}
