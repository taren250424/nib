import { injectable } from "inversify"
import SimpleBar from "simplebar"

@injectable()
export class TreeElements {
  readonly treeContextMenu: HTMLElement

  readonly treeContextCut: HTMLElement
  readonly treeContextCopy: HTMLElement
  readonly treeContextPaste: HTMLElement
  readonly treeContextRename: HTMLElement
  readonly treeContextDelete: HTMLElement

  readonly treeNodeContainer: HTMLElement
  readonly treeTop: HTMLElement
  readonly treeTopName: HTMLElement
  readonly treeTopAddFile: HTMLElement
  readonly treeTopAddDirectory: HTMLElement

  readonly simpleBar: SimpleBar

  constructor() {
    this.treeContextMenu = document.querySelector("#tree-context-menu") as HTMLElement

    this.treeContextCut = document.querySelector("#tree-context-cut") as HTMLElement
    this.treeContextCopy = document.querySelector("#tree-context-copy") as HTMLElement
    this.treeContextPaste = document.querySelector("#tree-context-paste") as HTMLElement
    this.treeContextRename = document.querySelector("#tree-context-rename") as HTMLElement
    this.treeContextDelete = document.querySelector("#tree-context-delete") as HTMLElement

    this.treeNodeContainer = document.querySelector("#tree-node-container") as HTMLElement
    this.treeTop = document.querySelector("#tree-top") as HTMLElement
    this.treeTopName = document.querySelector("#tree-top-name") as HTMLElement
    this.treeTopAddFile = document.querySelector("#tree-top-add-file") as HTMLElement
    this.treeTopAddDirectory = document.querySelector("#tree-top-add-directory") as HTMLElement

    this.simpleBar = new SimpleBar(this.treeNodeContainer)
  }
}
