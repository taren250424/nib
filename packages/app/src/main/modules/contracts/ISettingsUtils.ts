import type { SettingsSessionModel } from "@main/models/SettingsSessionModel"
import type { SettingsDto } from "@shared/dto/SettingsDto"

export default interface ISettingsUtils {
  toSettingsDto(session: SettingsSessionModel): SettingsDto
  toSettingsSessionModel(dto: SettingsDto): SettingsSessionModel
}
