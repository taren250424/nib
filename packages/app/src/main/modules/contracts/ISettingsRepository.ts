import type { SettingsSessionModel } from "@main/models/SettingsSessionModel"

export default interface ISettingsRepository {
  readSettingsSession(): Promise<SettingsSessionModel | null>
  writeSettingsSession(model: SettingsSessionModel): Promise<void>
}
