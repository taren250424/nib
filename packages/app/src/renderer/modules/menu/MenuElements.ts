import { injectable } from "inversify"

@injectable()
export class MenuElements {
  public readonly menuContainer: HTMLElement
  public readonly menuItems: NodeListOf<HTMLElement>

  public readonly newTab: HTMLElement
  public readonly openFile: HTMLElement
  public readonly openDirectory: HTMLElement
  public readonly save: HTMLElement
  public readonly saveAs: HTMLElement
  public readonly saveAll: HTMLElement
  public readonly settings: HTMLElement
  public readonly exit: HTMLElement

  public readonly undo: HTMLElement
  public readonly redo: HTMLElement
  public readonly cut: HTMLElement
  public readonly copy: HTMLElement
  public readonly paste: HTMLElement
  public readonly find: HTMLElement
  public readonly replace: HTMLElement

  public readonly zoomIn: HTMLElement
  public readonly zoomOut: HTMLElement
  public readonly zoomReset: HTMLElement
  public readonly fileTree: HTMLElement
  public readonly wordCount: HTMLElement

  public readonly information: HTMLElement

  constructor() {
    this.menuContainer = document.querySelector("#menu-container") as HTMLElement
    this.menuItems = document.querySelectorAll("#menu-container .menu-item") as NodeListOf<HTMLElement>

    this.newTab = document.querySelector("#file-menu-new-tab") as HTMLElement
    this.openFile = document.querySelector("#file-menu-open-file") as HTMLElement
    this.openDirectory = document.querySelector("#file-menu-open-directory") as HTMLElement
    this.save = document.querySelector("#file-menu-save") as HTMLElement
    this.saveAs = document.querySelector("#file-menu-save-as") as HTMLElement
    this.saveAll = document.querySelector("#file-menu-save-all") as HTMLElement
    this.settings = document.querySelector("#file-menu-settings") as HTMLElement
    this.exit = document.querySelector("#file-menu-exit") as HTMLElement

    this.undo = document.querySelector("#edit-menu-undo") as HTMLElement
    this.redo = document.querySelector("#edit-menu-redo") as HTMLElement
    this.cut = document.querySelector("#edit-menu-cut") as HTMLElement
    this.copy = document.querySelector("#edit-menu-copy") as HTMLElement
    this.paste = document.querySelector("#edit-menu-paste") as HTMLElement
    this.find = document.querySelector("#edit-menu-find") as HTMLElement
    this.replace = document.querySelector("#edit-menu-replace") as HTMLElement

    this.zoomIn = document.querySelector("#view-menu-zoom-in") as HTMLElement
    this.zoomOut = document.querySelector("#view-menu-zoom-out") as HTMLElement
    this.zoomReset = document.querySelector("#view-menu-zoom-reset") as HTMLElement
    this.fileTree = document.querySelector("#view-menu-file-tree") as HTMLElement
    this.wordCount = document.querySelector("#view-menu-word-count") as HTMLElement

    this.information = document.querySelector("#help-information") as HTMLElement
  }
}
