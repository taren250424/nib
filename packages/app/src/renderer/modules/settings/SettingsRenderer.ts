import { DI } from "@renderer/constants"
import type {
  SettingsViewModel,
  SettingEditorViewModel,
  SettingThemeViewModel,
} from "@renderer/viewmodels/SettingsViewModel"
import { inject, injectable } from "inversify"
import type { SettingsElements } from "./SettingsElements"

@injectable()
export class SettingsRenderer {
  constructor(@inject(DI.SettingsElements) readonly elements: SettingsElements) {}

  //

  openSettings() {
    this.elements.overlay.style.display = "flex"
  }

  closeSettings() {
    this.elements.overlay.style.display = "none"
  }

  //

  render(viewModel: SettingsViewModel) {
    this._renderSettingEditor(viewModel.settingEditorViewModel)
    this._renderSettingTheme(viewModel.settingThemeViewModel)
  }

  private _renderSettingEditor(editorViewModel: SettingEditorViewModel) {
    this.elements.editorWidthInput.value = editorViewModel.width.toString()
    this.elements.fontSizeInput.value = editorViewModel.fontSize.toString()
    this.elements.fontFamilyInput.value = editorViewModel.fontFamily.toString()
    this.elements.autoSaveSelect.value = editorViewModel.autoSave
  }

  private _renderSettingTheme(themeViewModel: SettingThemeViewModel) {
    this.elements.themeSelect.value = themeViewModel.theme
  }

  //

  onChangeEditorWidth(callback: (width: number) => void) {
    this.elements.editorWidthInput.addEventListener("change", () => {
      callback(Number(this.elements.editorWidthInput.value))
    })
  }

  onChangeFontSize(callback: (size: number) => void) {
    this.elements.fontSizeInput.addEventListener("change", () => {
      callback(Number(this.elements.fontSizeInput.value))
    })
  }

  onChangeFontFamily(callback: (family: string) => void) {
    this.elements.fontFamilyInput.addEventListener("change", () => {
      callback(this.elements.fontFamilyInput.value)
    })
  }

  onChangeAutoSave(callback: (autoSave: string) => void) {
    this.elements.autoSaveSelect.addEventListener("nib-select-changed", (e) => {
      callback(e.detail.value)
    })
  }

  onChangeTheme(callback: (theme: string) => void) {
    this.elements.themeSelect.addEventListener("nib-select-changed", (e) => {
      callback(e.detail.value)
    })
  }
}
