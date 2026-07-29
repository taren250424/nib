import type { WindowSessionModel, WindowBoundsModel } from "@main/models/WindowSessionModel"
import type IWindowRepository from "@main/modules/contracts/IWindowRepository"
import { BrowserWindow, screen } from "electron"

export function getBoundsByWindowSession(session: WindowSessionModel | null): WindowBoundsModel {
  const { width: screenW, height: screenH } = screen.getPrimaryDisplay().workAreaSize

  const width = session?.width ?? 800
  const height = session?.height ?? 600
  const x = session?.x ?? Math.floor((screenW - width) / 2)
  const y = session?.y ?? Math.floor((screenH - height) / 2)

  return { x, y, width, height }
}

export async function syncWindowMaximizeSession(mainWindow: BrowserWindow, windowRepository: IWindowRepository) {
  const session = await windowRepository.readWindowSession()
  const windowBoundsModel: WindowBoundsModel = getBoundsByWindowSession(session)

  const model: WindowSessionModel = {
    maximize: mainWindow.isMaximized(),
    x: windowBoundsModel.x,
    y: windowBoundsModel.y,
    width: windowBoundsModel.width,
    height: windowBoundsModel.height,
  }
  await windowRepository.writeWindowSession(model)
}

export async function syncWindowBoundSession(mainWindow: BrowserWindow, windowRepository: IWindowRepository) {
  const { x, y, width, height } = mainWindow.getBounds()
  const model: WindowSessionModel = {
    maximize: false,
    x: x,
    y: y,
    width: width,
    height: height,
  }
  await windowRepository.writeWindowSession(model)
}
