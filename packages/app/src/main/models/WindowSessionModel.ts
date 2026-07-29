export interface WindowSessionModel {
  maximize: boolean
  x: number
  y: number
  width: number
  height: number
}

export type WindowBoundsModel = Omit<WindowSessionModel, "maximize">
