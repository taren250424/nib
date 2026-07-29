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

  closeSettings() {
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
