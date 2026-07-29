import { injectable } from "inversify"
import type { VelinSelect } from "../../components/VelinSelect"

@injectable()
export class SettingsElements {
  public readonly exit: HTMLElement
  public readonly apply: HTMLElement
  public readonly close: HTMLElement

  public readonly menus: NodeListOf<HTMLElement>
  public readonly contents: NodeListOf<HTMLElement>

  public readonly overlay: HTMLElement
  public readonly fontSizeDiv: HTMLElement
  public readonly fontSizeInput: HTMLInputElement
  public readonly fontFamilyDiv: HTMLElement
  public readonly fontFamilyInput: HTMLInputElement
  public readonly editorWidthDiv: HTMLElement
  public readonly editorWidthInput: HTMLInputElement

  public readonly autoSaveDiv: HTMLElement
  public readonly autoSaveSelect: VelinSelect

  public readonly themeDiv: HTMLElement
  public readonly themeSelect: VelinSelect

  constructor() {
    this.exit = document.querySelector("#settings-exit") as HTMLElement
    this.apply = document.querySelector("#settings-apply-btn") as HTMLElement
    this.close = document.querySelector("#settings-close-btn") as HTMLElement

    this.menus = document.querySelectorAll("#settings-menus > button")
    this.contents = document.querySelectorAll("#settings-contents > div")

    this.overlay = document.querySelector("#settings-overlay") as HTMLElement

    this.fontSizeDiv = document.querySelector("#setting-node-editor-size") as HTMLElement
    this.fontSizeInput = document.querySelector("#setting-node-editor-size input") as HTMLInputElement

    this.fontFamilyDiv = document.querySelector("#setting-node-editor-family") as HTMLElement
    this.fontFamilyInput = document.querySelector("#setting-node-editor-family input") as HTMLInputElement

    this.editorWidthDiv = document.querySelector("#setting-node-editor-width") as HTMLElement
    this.editorWidthInput = document.querySelector("#setting-node-editor-width input") as HTMLInputElement

    this.autoSaveDiv = document.querySelector("#setting-node-editor-auto-save") as HTMLElement
    this.autoSaveSelect = document.querySelector("#setting-node-editor-auto-save velin-select") as VelinSelect

    this.themeDiv = document.querySelector("#settings-node-theme") as HTMLElement
    this.themeSelect = document.querySelector("#settings-node-theme velin-select") as VelinSelect
  }
}
