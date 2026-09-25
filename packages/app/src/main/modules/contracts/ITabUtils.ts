import type { TabSessionModel } from "@main/models/TabSessionModel"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"

export default interface ITabUtils {
  syncSessionWithFs(session: TabSessionModel): Promise<TabSessionModel | null>
  /**
   * The tabs a session names, each with its file's content read from disk — or,
   * with `readContent` false, with empty content, for a receiver that only needs
   * to know which tabs exist and where their files are.
   */
  toTabEditorsDto(session: TabSessionModel, options?: { readContent?: boolean }): Promise<TabEditorsDto>
  toTabSessionModel(tabEditorsDto: TabEditorsDto): TabSessionModel
}
