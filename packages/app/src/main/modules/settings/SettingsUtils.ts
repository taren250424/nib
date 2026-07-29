import type ISettingsUtils from "../contracts/ISettingsUtils"
import type { SettingsDto, SettingEditorDto, SettingThemeDto } from "@shared/dto/SettingsDto"
import type {
  SettingsSessionModel,
  SettingEditorSessionModel,
  SettingThemeSessionModel,
} from "@main/models/SettingsSessionModel"
import { injectable } from "inversify"

@injectable()
export default class SettingsUtils implements ISettingsUtils {
  toSettingsDto(session: SettingsSessionModel): SettingsDto {
    return {
      settingEditorDto: session.settingEditorSessionModel as SettingEditorDto,
      settingThemeDto: session.settingThemeSessionModel as SettingThemeDto,
    }
  }

  toSettingsSessionModel(dto: SettingsDto): SettingsSessionModel {
    return {
      settingEditorSessionModel: dto.settingEditorDto as SettingEditorSessionModel,
      settingThemeSessionModel: dto.settingThemeDto as SettingThemeSessionModel,
    }
  }
}
