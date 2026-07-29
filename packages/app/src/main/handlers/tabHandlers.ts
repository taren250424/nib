import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import { BrowserWindow, ipcMain } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import TabService from "@main/services/TabService"

export default function registerTabHandlers(mainWindow: BrowserWindow, tabService: TabService) {
  ipcMain.handle(electronAPI.events.rendererToMain.closeTab, async (_e, data: TabEditorDto) => {
    const result = await tabService.closeTab(data, mainWindow)
    return {
      result: result,
      data: null,
    }
  })

  ipcMain.handle(
    electronAPI.events.rendererToMain.closeOtherTabs,
    async (_e, exceptData: TabEditorDto, allData: TabEditorsDto) => {
      const resultArr = await tabService.closeOtherTabs(exceptData, allData, mainWindow)
      return {
        result: true,
        data: resultArr,
      }
    }
  )

  ipcMain.handle(
    electronAPI.events.rendererToMain.closeTabsToRight,
    async (_e, referenceData: TabEditorDto, allData: TabEditorsDto) => {
      const resultArr = await tabService.closeTabsToRight(referenceData, allData, mainWindow)
      return {
        result: true,
        data: resultArr,
      }
    }
  )

  ipcMain.handle(electronAPI.events.rendererToMain.closeAllTabs, async (_e, data: TabEditorsDto) => {
    const resultArr = await tabService.closeAllTabs(data, mainWindow)
    return {
      result: true,
      data: resultArr,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.syncTabSessionFromRenderer, async (_e, data: TabEditorsDto) => {
    return await tabService.syncTabSession(data)
  })
}
