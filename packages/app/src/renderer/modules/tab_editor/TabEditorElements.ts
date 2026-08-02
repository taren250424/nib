import { injectable } from "inversify"

@injectable()
export class TabEditorElements {
  public readonly tabContextMenu: HTMLElement

  public readonly tabContextClose: HTMLElement
  public readonly tabContextCloseOthers: HTMLElement
  public readonly tabContextCloseRight: HTMLElement
  public readonly tabContextCloseAll: HTMLElement

  public readonly tabContainer: HTMLElement
  public readonly editorContainer: HTMLElement
  public readonly wordCount: HTMLElement

  public readonly findAndReplaceContainer: HTMLElement
  public readonly findBox: HTMLElement
  public readonly replaceBox: HTMLElement
  public readonly findInput: HTMLInputElement
  public readonly replaceInput: HTMLInputElement
  public readonly findInfo: HTMLElement
  public readonly replaceInfo: HTMLElement
  public readonly findOptionCase: HTMLElement
  public readonly findOptionWord: HTMLElement
  public readonly findOptionPreserveCase: HTMLElement
  public readonly findOptionSelection: HTMLElement
  public readonly findUp: HTMLElement
  public readonly findDown: HTMLElement
  public readonly replaceCurrent: HTMLElement
  public readonly replaceAll: HTMLElement
  public readonly findReplaceToggle: HTMLElement
  public readonly closeFindReplace: HTMLElement

  constructor() {
    this.tabContextMenu = document.querySelector("#tab-context-menu") as HTMLElement

    this.tabContextClose = document.querySelector("#tab-context-close") as HTMLElement
    this.tabContextCloseOthers = document.querySelector("#tab-context-close-others") as HTMLElement
    this.tabContextCloseRight = document.querySelector("#tab-context-close-right") as HTMLElement
    this.tabContextCloseAll = document.querySelector("#tab-context-close-all") as HTMLElement

    this.tabContainer = document.querySelector("#tab-container") as HTMLElement
    this.editorContainer = document.querySelector("#editor-container") as HTMLElement
    this.wordCount = document.querySelector("#word-count") as HTMLElement

    this.findAndReplaceContainer = document.querySelector("#find-replace-container") as HTMLElement
    this.findBox = document.querySelector("#find") as HTMLElement
    this.replaceBox = document.querySelector("#replace") as HTMLElement
    this.findInput = document.querySelector("#find-input") as HTMLInputElement
    this.replaceInput = document.querySelector("#replace-input") as HTMLInputElement
    this.findInfo = document.querySelector("#find-info") as HTMLElement
    this.replaceInfo = document.querySelector("#replace-info") as HTMLElement
    this.findOptionCase = document.querySelector("#find-option-case") as HTMLElement
    this.findOptionWord = document.querySelector("#find-option-word") as HTMLElement
    this.findOptionPreserveCase = document.querySelector("#find-option-preserve-case") as HTMLElement
    this.findOptionSelection = document.querySelector("#find-option-selection") as HTMLElement
    this.findUp = document.querySelector("#find-up") as HTMLElement
    this.findDown = document.querySelector("#find-down") as HTMLElement
    this.replaceCurrent = document.querySelector("#replace-current") as HTMLElement
    this.replaceAll = document.querySelector("#replace-all") as HTMLElement
    this.findReplaceToggle = document.querySelector("#find-replace-toggle") as HTMLElement
    this.closeFindReplace = document.querySelector("#close-find-replace") as HTMLElement
  }
}
