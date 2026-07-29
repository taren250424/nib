import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabRepository from "@main/modules/contracts/ITabRepository"
import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"
import type ITabUtils from "@main/modules/contracts/ITabUtils"
import type IFileWatcher from "@main/modules/contracts/IFileWatcher"
import type ISideRepository from "@main/modules/contracts/ISideRepository"
import type IWindowRepository from "@main/modules/contracts/IWindowRepository"
import type IWindowUtils from "@main/modules/contracts/IWindowUtils"
import type ISettingsRepository from "@main/modules/contracts/ISettingsRepository"
import type ISettingsUtils from "@main/modules/contracts/ISettingsUtils"
import { BrowserWindow, ipcMain } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { loadedRenderer } from "../services/loadService"

export default function registerLoadHandlers(
  mainWindow: BrowserWindow,
  fileManager: IFileManager,
  fileWatcher: IFileWatcher,
  windowRepository: IWindowRepository,
  settingsRepository: ISettingsRepository,
  sideRepository: ISideRepository,
  tabRepository: ITabRepository,
  treeRepository: ITreeRepository,
  windowUtils: IWindowUtils,
  settingsUtils: ISettingsUtils,
  tabUtils: ITabUtils,
  treeUtils: ITreeUtils
) {
  ipcMain.on(electronAPI.events.rendererToMain.loadedRenderer, async () => {
    loadedRenderer(
      mainWindow,
      fileManager,
      fileWatcher,
      windowRepository,
      settingsRepository,
      sideRepository,
      tabRepository,
      treeRepository,
      windowUtils,
      settingsUtils,
      tabUtils,
      treeUtils
    )
  })

  ipcMain.on(electronAPI.events.rendererToMain.showMainWindow, () => {
    mainWindow.show()
  })
}
