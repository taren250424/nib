import type IFileManager from "../contracts/IFileManager"
import type ITabUtils from "../contracts/ITabUtils"
import type { TabSessionModel } from "@main/models/TabSessionModel"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type ITabRepository from "../contracts/ITabRepository"
import { inject, injectable } from "inversify"
import DI_KEYS from "../../constants/di_keys"
import path from "path"

@injectable()
export default class TabUtils implements ITabUtils {
  constructor(
    @inject(DI_KEYS.FileManager) private readonly fileManager: IFileManager,
    @inject(DI_KEYS.TabRepository) private readonly tabRepository: ITabRepository
  ) {}

  async syncSessionWithFs(session: TabSessionModel): Promise<TabSessionModel> {
    if (!session || !session.data.length) return { activatedId: -1, data: [] }

    const results = await Promise.all(
      session.data.map(async (data) => ({
        data,
        exists: await this.fileManager.exists(data.filePath),
      }))
    )

    const filteredData = results.filter((r) => r.exists).map((r) => r.data as TabEditorDto)
    const isActivatedTabStillExists = filteredData.some((d) => d.id === session.activatedId)

    let newActivatedId = session.activatedId
    if (!isActivatedTabStillExists) {
      newActivatedId = filteredData.length > 0 ? filteredData[filteredData.length - 1].id : -1
    }

    return {
      activatedId: newActivatedId,
      data: filteredData,
    }
  }

  async toTabEditorsDto(session: TabSessionModel): Promise<TabEditorsDto> {
    const data = await Promise.all(
      session.data.map(async (data) => {
        let fileName = ""
        if (data.filePath) {
          try {
            fileName = this.fileManager.getBasename(data.filePath)
          } catch {
            fileName = ""
          }
        }

        let content = ""
        let isBinary = false
        let isModified = data.isModified ?? false

        if (isModified) {
          try {
            const tempFilePath = path.join(
              path.dirname(this.tabRepository.getTabSessionPath()),
              "temp",
              `${data.id}.txt`
            )
            const buffer = await this.fileManager.getBuffer(tempFilePath)
            isBinary = this.fileManager.isBinaryContent(buffer)
            content = this.fileManager.toStringFromBuffer(buffer)
          } catch (e) {
            // If temp file fails, fallback to original or empty
            isModified = false
          }
        }

        if (!isModified && data.filePath) {
          try {
            const buffer = await this.fileManager.getBuffer(data.filePath)
            isBinary = this.fileManager.isBinaryContent(buffer)
            content = this.fileManager.toStringFromBuffer(buffer)
          } catch {
            content = ""
          }
        }

        return {
          id: data.id,
          isModified: isModified,
          filePath: data.filePath,
          fileName,
          content,
          isBinary,
        }
      })
    )

    return {
      activatedId: session.activatedId,
      data,
    }
  }

  toTabSessionModel(tabEditorsDto: TabEditorsDto): TabSessionModel {
    return {
      activatedId: tabEditorsDto.activatedId,
      data: tabEditorsDto.data.map((d) => ({
        id: d.id,
        filePath: d.filePath,
        isModified: d.isModified,
      })),
    }
  }
}
