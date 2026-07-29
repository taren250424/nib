import type IWindowRepository from "@main/modules/contracts/IWindowRepository"

import { BrowserWindow, ipcMain } from "electron"

import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { syncWindowBoundSession, syncWindowMaximizeSession } from "../actions/windowActions"

export default function registerWindowHandlers(mainWindow: BrowserWindow, windowRepository: IWindowRepository) {
  ipcMain.on(electronAPI.events.rendererToMain.requestMinimizeWindow, () => {
    mainWindow.minimize()
  })
  ipcMain.on(electronAPI.events.rendererToMain.requestMaximizeWindow, () => {
    mainWindow.maximize()
    syncWindowMaximizeSession(mainWindow, windowRepository)
  })
  ipcMain.on(electronAPI.events.rendererToMain.requestUnmaximizeWindow, () => {
    mainWindow.unmaximize()
    syncWindowMaximizeSession(mainWindow, windowRepository)
  })

  mainWindow.on("maximize", () => {
    mainWindow.webContents.send(electronAPI.events.mainToRenderer.onMaximizeWindow)
  })
  mainWindow.on("unmaximize", () => {
    mainWindow.webContents.send(electronAPI.events.mainToRenderer.onUnmaximizeWindow)
  })
  mainWindow.on("resized", () => {
    syncWindowBoundSession(mainWindow, windowRepository)
  })
  mainWindow.on("moved", () => {
    syncWindowBoundSession(mainWindow, windowRepository)
  })
}
