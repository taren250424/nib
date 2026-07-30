import type { TreeDto } from "@shared/dto/TreeDto"
import type TrashMap from "@shared/types/TrashMap"
import type ClipboardMode from "@shared/types/ClipboardMode"

import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { ipcMain } from "electron"

import TreeService from "@main/services/TreeService"
import type IDialogManager from "@main/modules/contracts/IDialogManager"

export default function registerTreeHandlers(treeService: TreeService, dialogManager: IDialogManager) {
  // The renderer has no way of its own to say anything to the user.
  ipcMain.handle(electronAPI.events.rendererToMain.showWarning, async (_e, message: string) => {
    await dialogManager.showWarningDialog(message)
  })

  ipcMain.handle(electronAPI.events.rendererToMain.rename, async (_e, prePath: string, newPath: string) => {
    return await treeService.rename(prePath, newPath)
  })

  ipcMain.handle(electronAPI.events.rendererToMain.copyTree, async (_e, src: string, dest: string) => {
    return await treeService.copy(src, dest)
  })

  ipcMain.handle(
    electronAPI.events.rendererToMain.pasteTree,
    async (_e, targetDto: TreeDto, selectedDtos: TreeDto[], clipboardMode: ClipboardMode) => {
      return await treeService.paste(targetDto, selectedDtos, clipboardMode)
    }
  )

  ipcMain.handle(electronAPI.events.rendererToMain.delete, async (_e, arr: string[]) => {
    const trashMap = await treeService.delete(arr)
    return {
      result: trashMap ? true : false,
      data: trashMap,
    }
  })

  ipcMain.handle(electronAPI.events.rendererToMain.undo_delete, async (_e, trashMap: TrashMap[] | null) => {
    return await treeService.undo_delete(trashMap)
  })

  ipcMain.handle(electronAPI.events.rendererToMain.deletePermanently, async (_e, path: string) => {
    return await treeService.deletePermanently(path)
  })

  ipcMain.handle(electronAPI.events.rendererToMain.create, async (_e, path: string, directory: boolean) => {
    return await treeService.create(path, directory)
  })

  ipcMain.handle(electronAPI.events.rendererToMain.syncTreeSessionFromRenderer, async (_e, dto: TreeDto) => {
    return await treeService.syncTreeSessionFromRenderer(dto)
  })

  ipcMain.handle(electronAPI.events.rendererToMain.getSyncedTreeSession, async () => {
    return await treeService.getSyncedTreeSession()
  })
}
