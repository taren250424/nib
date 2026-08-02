import type { SettingsDto, SettingEditorDto, SettingThemeDto } from "@shared/dto/SettingsDto"
import type {
  SettingsViewModel,
  SettingEditorViewModel,
  SettingThemeViewModel,
} from "@renderer/viewmodels/SettingsViewModel"

import { injectable } from "inversify"

@injectable()
export class SettingsStore {
  private _currentSettings: SettingsViewModel
  private _draftSettings: SettingsViewModel

  constructor() {
    this._currentSettings = {
      settingEditorViewModel: {
        width: 720,
        fontSize: 16,
        // Empty means the app's --font-content stack; any value here overrides it.
        fontFamily: "",
        autoSave: "off",
      },

      settingThemeViewModel: {
        theme: "light",
      },
    }

    this._draftSettings = JSON.parse(JSON.stringify(this._currentSettings))
  }

  //

  toSettingsViewModel(dto: SettingsDto): SettingsViewModel {
    return {
      settingEditorViewModel: {
        width: dto.settingEditorDto?.width ?? 720,
        fontSize: dto.settingEditorDto?.fontSize ?? 16,
        fontFamily: dto.settingEditorDto?.fontFamily ?? "",
        autoSave: dto.settingEditorDto?.autoSave ?? "off",
      },
      settingThemeViewModel: dto.settingThemeDto as SettingThemeViewModel,
    }
  }

  toSettingsDto(viewModel: SettingsViewModel): SettingsDto {
    return {
      settingEditorDto: viewModel.settingEditorViewModel as SettingEditorDto,
      settingThemeDto: viewModel.settingThemeViewModel as SettingThemeDto,
    }
  }

  //

  getSettingsValue() {
    return JSON.parse(JSON.stringify(this._currentSettings))
  }

  setSettingsValue(viewModel: SettingsViewModel) {
    this._setSettingEditor(viewModel.settingEditorViewModel)
    this._setSettingTheme(viewModel.settingThemeViewModel)

    // The draft must mirror the loaded settings, otherwise getChangeSet()
    // reports the constructor defaults as user edits on the next Apply.
    this.resetChangeSet()
  }

  private _setSettingEditor(editorViewModel: SettingEditorViewModel) {
    this._currentSettings.settingEditorViewModel.width =
      editorViewModel?.width ?? this._currentSettings.settingEditorViewModel.width

    this._currentSettings.settingEditorViewModel.fontSize =
      editorViewModel?.fontSize ?? this._currentSettings.settingEditorViewModel.fontSize

    this._currentSettings.settingEditorViewModel.fontFamily =
      editorViewModel?.fontFamily ?? this._currentSettings.settingEditorViewModel.fontFamily

    this._currentSettings.settingEditorViewModel.autoSave =
      editorViewModel?.autoSave ?? this._currentSettings.settingEditorViewModel.autoSave
  }

  private _setSettingTheme(themeViewModel: SettingThemeViewModel) {
    this._currentSettings.settingThemeViewModel.theme =
      themeViewModel?.theme ?? this._currentSettings.settingThemeViewModel.theme
  }

  //

  getCurrentSettings() {
    return JSON.parse(JSON.stringify(this._currentSettings))
  }

  getDraftSettings() {
    return JSON.parse(JSON.stringify(this._draftSettings))
  }

  //

  getChangeSet(): SettingsViewModel {
    return {
      settingEditorViewModel: {
        width:
          this._currentSettings.settingEditorViewModel.width !== this._draftSettings.settingEditorViewModel.width
            ? this._draftSettings.settingEditorViewModel.width
            : this._currentSettings.settingEditorViewModel.width,

        fontSize:
          this._currentSettings.settingEditorViewModel.fontSize !== this._draftSettings.settingEditorViewModel.fontSize
            ? this._draftSettings.settingEditorViewModel.fontSize
            : this._currentSettings.settingEditorViewModel.fontSize,

        fontFamily:
          this._currentSettings.settingEditorViewModel.fontFamily !==
          this._draftSettings.settingEditorViewModel.fontFamily
            ? this._draftSettings.settingEditorViewModel.fontFamily
            : this._currentSettings.settingEditorViewModel.fontFamily,

        autoSave:
          this._currentSettings.settingEditorViewModel.autoSave !== this._draftSettings.settingEditorViewModel.autoSave
            ? this._draftSettings.settingEditorViewModel.autoSave
            : this._currentSettings.settingEditorViewModel.autoSave,
      },

      settingThemeViewModel: {
        theme:
          this._currentSettings.settingThemeViewModel.theme !== this._draftSettings.settingThemeViewModel.theme
            ? this._draftSettings.settingThemeViewModel.theme
            : this._currentSettings.settingThemeViewModel.theme,
      },
    }
  }

  resetChangeSet() {
    this._draftSettings = JSON.parse(JSON.stringify(this._currentSettings))
  }

  applyChangeSet() {
    this._currentSettings = JSON.parse(JSON.stringify(this._draftSettings))
  }

  //

  onChangeEditorWidth(width: number) {
    this._draftSettings.settingEditorViewModel.width = width
  }

  onChangeFontSize(fontSize: number) {
    this._draftSettings.settingEditorViewModel.fontSize = fontSize
  }

  onChangeFontFamily(fontFamily: string) {
    this._draftSettings.settingEditorViewModel.fontFamily = fontFamily
  }

  onChangeAutoSave(autoSave: string) {
    this._draftSettings.settingEditorViewModel.autoSave = autoSave
  }

  onChangeTheme(theme: string) {
    this._draftSettings.settingThemeViewModel.theme = theme
  }
}
