import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"

import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { BrowserWindow, ipcMain } from "electron"

import FileService from "@main/services/FileService"

/**
 * What the renderer is told when a write does not happen.
 *
 * The save channels are the ones that touch the user's own files, and a
 * rejected `ipcMain.handle` reaches the renderer as an opaque invoke error that
 * every caller there drops. Turning the failure into the `result: false` the
 * Response contract already describes is what lets those callers say something.
 */
const toErrorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e))

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
    try {
      const tabEditorData: TabEditorDto = await fileService.save(data, mainWindow)
      return {
        result: true,
        data: tabEditorData,
      }
    } catch (e) {
      // Handed back as it came in, still modified: the tab it describes has not
      // reached the disk, and the renderer paints from this.
      return {
        result: false,
        data: data,
        error: toErrorMessage(e),
      }
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.tempSave, async (_e, data: TabEditorDto) => {
    try {
      await fileService.tempSave(data)
      return {
        result: true,
        data: null,
      }
    } catch (e) {
      return {
        result: false,
        data: null,
        error: toErrorMessage(e),
      }
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.saveAs, async (_e, data: TabEditorDto) => {
    try {
      const tabEditorData = await fileService.saveAs(data, mainWindow)
      return {
        result: true,
        data: tabEditorData,
      }
    } catch (e) {
      return {
        result: false,
        data: null,
        error: toErrorMessage(e),
      }
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.saveAll, async (_e, data: TabEditorsDto) => {
    try {
      const tabEditorsData: TabEditorsDto = await fileService.saveAll(data, mainWindow)
      return {
        result: true,
        data: tabEditorsData,
      }
    } catch (e) {
      return {
        result: false,
        data: data,
        error: toErrorMessage(e),
      }
    }
  })
}
