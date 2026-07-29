import type { TabSessionModel } from "@main/models/TabSessionModel"
import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabUtils from "@main/modules/contracts/ITabUtils"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import path from "path"
import type ITabRepository from "@main/modules/contracts/ITabRepository"

export default class FakeTabUtils implements ITabUtils {
  constructor(
    private fakeFileManager: IFileManager,
    private tabRepository: ITabRepository
  ) {}

  async syncSessionWithFs(session: TabSessionModel): Promise<TabSessionModel> {
    if (!session || !session.data.length) return { activatedId: -1, data: [] }

    const results = await Promise.all(
      session.data.map(async (data) => ({
        data,
        exists: await this.fakeFileManager.exists(data.filePath),
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
        const fileName = data.filePath ? this.fakeFileManager.getBasename(data.filePath) : ""

        let content = ""
        if (data.isModified) {
          const tempFilePath = path.join(path.dirname(this.tabRepository.getTabSessionPath()), "temp", `${data.id}.txt`)
          if (await this.fakeFileManager.exists(tempFilePath)) {
            content = await this.fakeFileManager.read(tempFilePath)
          }
        }

        if (!content && data.filePath) {
          content = await this.fakeFileManager.read(data.filePath)
        }

        return {
          id: data.id,
          isModified: data.isModified ?? false,
          filePath: data.filePath,
          fileName,
          content,
          isBinary: false,
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
