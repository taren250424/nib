import type Response from "@shared/types/Response"
import type { UndoableEdit } from "./UndoableEdit"

import type { TabEditorFacade } from "../modules/tab_editor/TabEditorFacade"
import type { TreeFacade } from "../modules/tree/TreeFacade"

export class RenameEdit implements UndoableEdit {
  private confirmedNewPath = ""

  // Named by path, not by element. Holding the row meant an edit sitting on the
  // undo stack also held a piece of the DOM, and the tree may have re-rendered
  // out from under it by the time the undo runs.
  constructor(
    private treeFacade: TreeFacade,
    private tabEditorFacade: TabEditorFacade,
    private isDir: boolean,
    private prePath: string,
    private newPath: string
  ) {}

  async apply() {
    const response: Response<string> = await window.rendererToMain.rename(this.prePath, this.newPath)
    if (!response.result) throw new Error("Rename failed")

    this.confirmedNewPath = response.data
    await this._rename(this.prePath, this.confirmedNewPath)
  }

  async revert() {
    await window.rendererToMain.rename(this.confirmedNewPath, this.prePath)
    await this._rename(this.confirmedNewPath, this.prePath)
  }

  private async _rename(from: string, to: string) {
    await this.treeFacade.applyRename(from, to)

    // applyRename remaps the model and the wrapper table; the row still shows
    // the old name (or, on the way in, the input the name was typed into).
    this.treeFacade.renderNodeLabel(to)

    if (this.isDir) await this.tabEditorFacade.renameDirectory(from, to)
    else await this.tabEditorFacade.renameFile(from, to)
  }
}
