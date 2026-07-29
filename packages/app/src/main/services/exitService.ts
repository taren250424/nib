import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabRepository from "@main/modules/contracts/ITabRepository"
import type IDialogManager from "@main/modules/contracts/IDialogManager"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"
import type TreeSessionModel from "../models/TreeSessionModel"
import type { TabSessionData } from "../models/TabSessionModel"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"
import { BrowserWindow } from "electron"

export default async function exit(
  mainWindow: BrowserWindow,
  fileManager: IFileManager,
  dialogManager: IDialogManager,
  tabRepository: ITabRepository,
  treeRepository: ITreeRepository,
  tabSessionData: TabEditorsDto,
  treeSessionData: TreeDto
) {
  await syncTab(mainWindow, fileManager, dialogManager, tabRepository, tabSessionData)
  await syncTree(treeRepository, treeSessionData as TreeSessionModel)
  mainWindow.close()
}

async function syncTab(
  mainWindow: BrowserWindow,
  fileManager: IFileManager,
  dialogManager: IDialogManager,
  tabRepository: ITabRepository,
  tabSessionData: TabEditorsDto
) {
  const data: TabSessionData[] = []

  for (const tab of tabSessionData.data) {
    const { id, isModified, filePath, fileName, content } = tab

    if (!isModified) {
      data.push({ id: id, filePath: filePath, isModified: false })
      continue
    }

    const confirm = await dialogManager.showConfirmDialog(`Do you want to save ${fileName} file?`)
    if (!confirm) {
      data.push({ id: id, filePath: filePath, isModified: false })
      continue
    }

    if (!filePath) {
      const result = await dialogManager.showSaveDialog(mainWindow, fileName)

      if (result.canceled || !result.filePath) {
        data.push({ id: id, filePath: filePath, isModified: false })
      } else {
        await fileManager.write(result.filePath, content)

        data.push({ id: id, filePath: result.filePath, isModified: false })
      }
    } else if (filePath) {
      await fileManager.write(filePath, content)
      data.push({ id: id, filePath: filePath, isModified: false })
    }
  }

  await tabRepository.writeTabSession({
    activatedId: tabSessionData.activatedId,
    data: data,
  })
}

async function syncTree(treeRepository: ITreeRepository, treeSessionData: TreeSessionModel) {
  await treeRepository.writeTreeSession(treeSessionData as TreeSessionModel)
}
