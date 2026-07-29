import type IDialogManager from "@main/modules/contracts/IDialogManager"
import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabRepository from "@main/modules/contracts/ITabRepository"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"
import { BrowserWindow, ipcMain } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import exit from "@services/exitService"

export default function registerExitHandlers(
  mainWindow: BrowserWindow,
  fileManager: IFileManager,
  dialogManager: IDialogManager,
  tabRepository: ITabRepository,
  treeRepository: ITreeRepository
) {
  ipcMain.handle(
    electronAPI.events.rendererToMain.exit,
    async (_e, tabSessionData: TabEditorsDto, treeSessionData: TreeDto) => {
      await exit(mainWindow, fileManager, dialogManager, tabRepository, treeRepository, tabSessionData, treeSessionData)
    }
  )
}
