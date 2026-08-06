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
  // Quitting is what the user asked for, and a session that cannot be written
  // must not trap them in the app. Neither half is allowed to escape and leave
  // the window standing open with nothing said.
  try {
    await syncTab(mainWindow, fileManager, dialogManager, tabRepository, tabSessionData)
  } catch (e) {
    console.error("[exit] the tab session could not be written:", e)
  }

  try {
    await syncTree(treeRepository, treeSessionData as TreeSessionModel)
  } catch (e) {
    console.error("[exit] the tree session could not be written:", e)
  }

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
  const unsaved: string[] = []

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

    let targetPath = filePath

    if (!targetPath) {
      const result = await dialogManager.showSaveDialog(mainWindow, fileName)

      if (result.canceled || !result.filePath) {
        data.push({ id: id, filePath: filePath, isModified: false })
        continue
      }

      targetPath = result.filePath
    }

    try {
      await fileManager.write(targetPath, content)
      data.push({ id: id, filePath: targetPath, isModified: false })
    } catch (e) {
      console.error(`[exit] ${targetPath} could not be written:`, e)
      unsaved.push(fileName || targetPath)

      // Recorded as modified and on the path it came in on: that is the shape
      // the temp file is keyed to, so a tab that already had one is read back
      // from it at the next start rather than losing the edit outright.
      data.push({ id: id, filePath: filePath, isModified: true })
    }
  }

  // Once, at the end. A dialog for each unwritable tab would be one more thing
  // to click through on the way out.
  if (unsaved.length > 0) {
    await dialogManager.showWarningDialog(
      `Could not save ${unsaved.join(", ")}. Nib is closing and those files are unchanged on disk.`
    )
  }

  await tabRepository.writeTabSession({
    activatedId: tabSessionData.activatedId,
    data: data,
  })
}

async function syncTree(treeRepository: ITreeRepository, treeSessionData: TreeSessionModel) {
  await treeRepository.writeTreeSession(treeSessionData as TreeSessionModel)
}
