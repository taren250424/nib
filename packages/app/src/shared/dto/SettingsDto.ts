export interface SettingsDto {
  settingEditorDto: SettingEditorDto
  settingThemeDto: SettingThemeDto
}

export interface SettingEditorDto {
  width: number
  fontSize: number
  fontFamily: string
  autoSave: string
}

export interface SettingThemeDto {
  theme: string
}
