import type IFileWatcher from "@main/modules/contracts/IFileWatcher"
import { ipcMain } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"

export default function registerWatchHandlers(fileWatcher: IFileWatcher) {
  ipcMain.handle(electronAPI.events.rendererToMain.setWatchSkipState, (_e, state) => {
    fileWatcher.setSkipState(state)
  })
}
