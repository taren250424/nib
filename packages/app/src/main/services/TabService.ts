import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type IDialogManager from "../modules/contracts/IDialogManager"
import type IFileManager from "../modules/contracts/IFileManager"
import type ITabRepository from "../modules/contracts/ITabRepository"
import type { TabSessionData } from "../models/TabSessionModel"
import type ITabUtils from "@main/modules/contracts/ITabUtils"
import { BrowserWindow } from "electron"
import { inject } from "inversify"
import DI_KEYS from "../constants/di_keys"
import path from "path"

export default class TabService {
  constructor(
    @inject(DI_KEYS.FileManager) private readonly fileManager: IFileManager,
    @inject(DI_KEYS.TabRepository) private readonly tabRepository: ITabRepository,
    @inject(DI_KEYS.TabUtils) private readonly tabUtils: ITabUtils,
    @inject(DI_KEYS.dialogManager) private readonly dialogManager: IDialogManager
  ) {}
  async closeTab(data: TabEditorDto, mainWindow: BrowserWindow, writeSession = true) {
    if (data.isModified) {
      const confirm = await this.dialogManager.showConfirmDialog(`Do you want to save ${data.fileName} file?`)

      if (confirm) {
        if (!data.filePath) {
          const result = await this.dialogManager.showSaveDialog(mainWindow, data.fileName)

          if (result.canceled || !result.filePath) {
            return false
          } else {
            await this.fileManager.write(result.filePath, data.content)
          }
        } else {
          await this.fileManager.write(data.filePath, data.content)
        }
      }
    }

    const tempFilePath = path.join(path.dirname(this.tabRepository.getTabSessionPath()), "temp", `${data.id}.txt`)
    if (await this.fileManager.exists(tempFilePath)) {
      await this.fileManager.deletePermanently(tempFilePath)
    }

    // Delete session.
    if (writeSession) {
      try {
        const tabSession = (await this.tabRepository.readTabSession()) ?? {
          activatedId: -1,
          data: [],
        }

        const updatedData = tabSession.data.filter((session) => session.id !== data.id)

        await this.tabRepository.writeTabSession({
          activatedId: tabSession.activatedId,
          data: updatedData,
        })
      } catch (e) {
        return false
      }
    }

    return true
  }

  async closeOtherTabs(exceptData: TabEditorDto, dto: TabEditorsDto, mainWindow: BrowserWindow): Promise<boolean[]> {
    const sessionArr: TabSessionData[] = []
    const responseArr: boolean[] = []

    for (const data of dto.data) {
      if (exceptData.id === data.id) {
        sessionArr.push({ id: data.id, filePath: data.filePath, isModified: data.isModified })
        responseArr.push(false)
        continue
      }

      const result = await this.closeTab(data, mainWindow, false)

      if (result) {
        responseArr.push(true)
      } else {
        sessionArr.push({ id: data.id, filePath: data.filePath, isModified: data.isModified })
        responseArr.push(false)
      }
    }

    await this.tabRepository.writeTabSession({
      activatedId: dto.activatedId,
      data: sessionArr,
    })

    return responseArr
  }

  async closeTabsToRight(
    referenceData: TabEditorDto,
    dto: TabEditorsDto,
    mainWindow: BrowserWindow
  ): Promise<boolean[]> {
    const data = dto.data
    const refIdx = data.findIndex((d) => d.id === referenceData.id)

    const sessionToKeep = []
    const responseArr = []

    for (let i = 0; i <= refIdx; i++) {
      sessionToKeep.push({ id: data[i].id, filePath: data[i].filePath, isModified: data[i].isModified })
      responseArr.push(false)
    }

    for (let i = refIdx + 1; i < data.length; i++) {
      const result = await this.closeTab(data[i], mainWindow, false)

      if (result) {
        responseArr.push(true)
      } else {
        responseArr.push(false)
        sessionToKeep.push({ id: data[i].id, filePath: data[i].filePath, isModified: data[i].isModified })
      }
    }

    await this.tabRepository.writeTabSession({
      activatedId: dto.activatedId,
      data: sessionToKeep,
    })

    return responseArr
  }

  async closeAllTabs(dto: TabEditorsDto, mainWindow: BrowserWindow): Promise<boolean[]> {
    const sessionArr = []
    const responseArr = []

    for (const tab of dto.data) {
      const result = await this.closeTab(tab, mainWindow, false)

      if (result) {
        responseArr.push(true)
      } else {
        responseArr.push(false)
        sessionArr.push({ id: tab.id, filePath: tab.filePath, isModified: tab.isModified })
      }
    }

    await this.tabRepository.writeTabSession({
      activatedId: dto.activatedId,
      data: sessionArr,
    })
    return responseArr
  }

  async syncTabSession(dto: TabEditorsDto): Promise<boolean> {
    const session = this.tabUtils.toTabSessionModel(dto)
    await this.tabRepository.writeTabSession(session)
    return true
  }
}
