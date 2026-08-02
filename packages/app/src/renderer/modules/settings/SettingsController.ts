import { inject, injectable } from "inversify"

import type { SettingsViewModel } from "../../viewmodels/SettingsViewModel"

import { DI } from "../../constants"

// Straight from the files, not from ./index — the value form is needed because
// emitDecoratorMetadata writes these into the constructor's design:paramtypes.
import { SettingsFacade } from "./SettingsFacade"
import { TabEditorFacade } from "../tab_editor/TabEditorFacade"

/**
 * Applying settings is the one settings verb that reaches outside its module:
 * the editor takes the width and fonts, the document root takes the theme.
 * That coordination is what earns a controller; everything that only concerns
 * the settings window itself stays on the facade.
 */
@injectable()
export class SettingsController {
  constructor(
    @inject(DI.SettingsFacade) private readonly settingsFacade: SettingsFacade,
    @inject(DI.TabEditorFacade) private readonly tabEditorFacade: TabEditorFacade
  ) {}

  performApplySettings(viewModel: SettingsViewModel) {
    const editor = viewModel.settingEditorViewModel
    const theme = viewModel.settingThemeViewModel.theme

    editor.width && this.tabEditorFacade.changeEditorWidth(editor.width)
    editor.fontSize && this.tabEditorFacade.changeFontSize(editor.fontSize)
    editor.fontFamily && this.tabEditorFacade.changeFontFamily(editor.fontFamily)
    editor.autoSave && this.tabEditorFacade.setAutoSaveMode(editor.autoSave)

    if (theme) {
      const html = document.documentElement
      html.classList.remove("light", "solarized", "slate")
      html.classList.add(theme)
    }

    this.settingsFacade.applyChangeSet()
  }

  async performApplyAndSaveSettings(viewModel: SettingsViewModel) {
    this.performApplySettings(viewModel)
    const settingsDto = this.settingsFacade.toSettingsDto(this.settingsFacade.getDraftSettings())
    await window.rendererToMain.syncSettingsSessionFromRenderer(settingsDto)
  }
}
