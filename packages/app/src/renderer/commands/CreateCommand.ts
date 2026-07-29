import type { ICommand } from "./index"
import { TabEditorFacade, TreeFacade } from "../modules"
import type Response from "@shared/types/Response"

export class CreateCommand implements ICommand {
  private createdPath = ""
  private openedTabId: number | null = null

  constructor(
    private treeFacade: TreeFacade,
    private tabEditorFacade: TabEditorFacade,
    private parentPath: string,
    private name: string,
    private isDirectory: boolean
  ) {}

  async execute() {
    const requestPath = window.utils.getJoinedPath(this.parentPath, this.name)
    const response: Response<string> = await window.rendererToMain.create(requestPath, this.isDirectory)
    if (!response.result) return

    this.createdPath = response.data

    this.treeFacade.applyCreate(this.parentPath, this.createdPath, this.isDirectory)

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }

  async undo() {
    if (!this.createdPath) return

    await window.rendererToMain.delete([this.createdPath])

    const idx = this.treeFacade.getFlattenIndexByPath(this.createdPath)
    if (idx !== undefined) {
      this.treeFacade.applyDelete([idx])
    }

    if (this.openedTabId !== null) {
      const tabEditorViewModel = this.tabEditorFacade.getTabEditorViewModelById(this.openedTabId)
      const tabEditorView = this.tabEditorFacade.getTabEditorViewByPath(tabEditorViewModel.filePath)
      this.tabEditorFacade.removeTab(tabEditorView.getId())
    }

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }

  getCreatedPath() {
    return this.createdPath
  }

  setOpenedTabId(id: number) {
    this.openedTabId = id
  }
}
