import type Response from "@shared/types/Response"
import type { UndoableEdit } from "./UndoableEdit"

import type { TabEditorFacade } from "../modules/tab_editor/TabEditorFacade"
import type { TreeFacade } from "../modules/tree/TreeFacade"

export class CreateEdit implements UndoableEdit {
  private createdPath = ""

  constructor(
    private treeFacade: TreeFacade,
    private tabEditorFacade: TabEditorFacade,
    private parentPath: string,
    private name: string,
    private isDirectory: boolean
  ) {}

  /** Where the file landed. Empty until apply() succeeds — Main picks a unique name. */
  getCreatedPath() {
    return this.createdPath
  }

  /**
   * Whether apply() actually created anything. Main can refuse without
   * throwing, and an edit that did nothing must not take an undo step.
   */
  get didCreate(): boolean {
    return this.createdPath !== ""
  }

  async apply() {
    const requestPath = window.utils.getJoinedPath(this.parentPath, this.name)
    const response: Response<string> = await window.rendererToMain.create(requestPath, this.isDirectory)
    if (!response.result) return

    this.createdPath = response.data

    this.treeFacade.applyCreate(this.parentPath, this.createdPath, this.isDirectory)

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }

  async revert() {
    if (!this.createdPath) return

    await window.rendererToMain.delete([this.createdPath])

    const idx = this.treeFacade.getFlattenIndexByPath(this.createdPath)
    if (idx !== undefined) {
      this.treeFacade.applyDelete([idx])
    }

    // Creating a file opens it, so undoing has to close that tab again. Found by
    // path rather than remembered from the open: the caller used to hand the tab
    // id back afterwards, which meant undoing after closing the tab by hand
    // looked the id up and got nothing.
    const view = this.tabEditorFacade.getTabEditorViewByPath(this.createdPath)
    if (view) this.tabEditorFacade.removeTab(view.getId())

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }
}
