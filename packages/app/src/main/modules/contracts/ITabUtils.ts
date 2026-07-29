import type { TabSessionModel } from "@main/models/TabSessionModel"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"

export default interface ITabUtils {
  syncSessionWithFs(session: TabSessionModel): Promise<TabSessionModel | null>
  toTabEditorsDto(session: TabSessionModel): Promise<TabEditorsDto>
  toTabSessionModel(tabEditorsDto: TabEditorsDto): TabSessionModel
}
