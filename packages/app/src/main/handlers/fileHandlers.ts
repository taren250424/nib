import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"

import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { BrowserWindow, ipcMain } from "electron"

import FileService from "@main/services/FileService"

export default function registerFileHandlers(mainWindow: BrowserWindow, fileService: FileService) {
  ipcMain.handle(electronAPI.events.rendererToMain.newTab, async () => {
    const id = await fileService.newTab()
    return {
      result: true,
      data: id,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.openFile, async (_e, filePath?: string) => {
    const data = await fileService.openFile(filePath)
    return {
      result: true,
      data: data,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.openDirectory, async (_e, treeDto?: TreeDto) => {
    const tree = await fileService.openDirectory(treeDto)
    return {
      result: true,
      data: tree,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.save, async (_e, data: TabEditorDto) => {
    const tabEditorData: TabEditorDto = await fileService.save(data, mainWindow)
    return {
      result: true,
      data: tabEditorData,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.tempSave, async (_e, data: TabEditorDto) => {
    await fileService.tempSave(data)
    return {
      result: true,
      data: null,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.saveAs, async (_e, data: TabEditorDto) => {
    const tabEditorData = await fileService.saveAs(data, mainWindow)
    return {
      result: true,
      data: tabEditorData,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.saveAll, async (_e, data: TabEditorsDto) => {
    const tabEditorsData: TabEditorsDto = await fileService.saveAll(data, mainWindow)
    return {
      result: true,
      data: tabEditorsData,
    }
  })
}
