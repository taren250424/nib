import type { SettingsDto } from "@shared/dto/SettingsDto"
import type { SettingsViewModel } from "@renderer/viewmodels/SettingsViewModel"

import { inject, injectable } from "inversify"
import { DI } from "../../constants"
import { SettingsStore } from "./SettingsStore"
import { SettingsRenderer } from "./SettingsRenderer"

type Binding<T> = {
  on: (callback: (value: T) => void) => void
  update: (value: T) => void
}

@injectable()
export class SettingsFacade {
  constructor(
    @inject(DI.SettingsRenderer) public readonly renderer: SettingsRenderer,
    @inject(DI.SettingsStore) public readonly store: SettingsStore
  ) {
    this._bindChangeEvents()
  }

  // renderer

  openSettings() {
    this.renderer.openSettings()
  }

  /**
   * Leaving the dialog gives up whatever was not applied.
   *
   * Both the draft and the fields, together. The draft alone would leave the box
   * showing an edit it has already forgotten; the fields alone would show the
   * applied values over a draft still holding the abandoned ones — and the change
   * set is not a diff, so the next Apply would carry them in beside whatever the
   * user actually came back to change.
   *
   * The dialog is an overlay rather than its own window, so nothing is destroyed
   * on the way out and the draft outlives the box unless it is told not to.
   */
  closeSettings() {
    this.store.resetChangeSet()
    this.renderer.render(this.store.getCurrentSettings())
    this.renderer.closeSettings()
  }

  //

  render(viewModel: SettingsViewModel) {
    this.renderer.render(viewModel)
  }

  // store

  toSettingsViewModel(dto: SettingsDto) {
    return this.store.toSettingsViewModel(dto)
  }

  toSettingsDto(viewModel: SettingsViewModel) {
    return this.store.toSettingsDto(viewModel)
  }

  //

  getSettingsValue() {
    return this.store.getSettingsValue()
  }

  setSettingsValue(viewModel: SettingsViewModel) {
    this.store.setSettingsValue(viewModel)
  }

  //

  getCurrentSettings() {
    return this.store.getCurrentSettings()
  }

  getDraftSettings() {
    return this.store.getDraftSettings()
  }

  //

  getChangeSet() {
    return this.store.getChangeSet()
  }

  resetChangeSet() {
    this.store.resetChangeSet()
  }

  applyChangeSet() {
    this.store.applyChangeSet()
  }

  private _bindChangeEvents() {
    const bindings: Binding<any>[] = [
      {
        on: this.renderer.onChangeEditorWidth.bind(this.renderer),
        update: this.store.onChangeEditorWidth.bind(this.store),
      },
      {
        on: this.renderer.onChangeFontSize.bind(this.renderer),
        update: this.store.onChangeFontSize.bind(this.store),
      },
      {
        on: this.renderer.onChangeFontFamily.bind(this.renderer),
        update: this.store.onChangeFontFamily.bind(this.store),
      },
      {
        on: this.renderer.onChangeAutoSave.bind(this.renderer),
        update: this.store.onChangeAutoSave.bind(this.store),
      },
      {
        on: this.renderer.onChangeTheme.bind(this.renderer),
        update: this.store.onChangeTheme.bind(this.store),
      },
    ]

    for (const { on, update } of bindings) {
      on((value: any) => update(value))
    }
  }
}
