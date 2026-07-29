export interface SettingsSessionModel {
  settingEditorSessionModel: SettingEditorSessionModel
  settingThemeSessionModel: SettingThemeSessionModel
}

export interface SettingEditorSessionModel {
  width: number
  fontSize: number
  fontFamily: string
  autoSave: string
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface SettingThemeSessionModel {}
