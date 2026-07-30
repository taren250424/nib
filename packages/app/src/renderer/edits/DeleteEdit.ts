import type TrashMap from "@shared/types/TrashMap"
import type Response from "@shared/types/Response"
import type { TreeViewModel } from "../viewmodels/TreeViewModel"
import type { UndoableEdit } from "./UndoableEdit"

import { TabEditorFacade, TreeFacade } from "../modules"

type DeletedItemInfo = {
  path: string
  isDirectory: boolean
  parentPath: string
}

export class DeleteEdit implements UndoableEdit {
  private trashMap: TrashMap[] | null = null
  private deletedItems: DeletedItemInfo[] = []

  // Captures paths, not indices: indices shift whenever the tree mutates,
  // so they are re-resolved from paths at apply time instead.
  constructor(
    private treeFacade: TreeFacade,
    private tabEditorFacade: TabEditorFacade,
    private selectedPaths: string[]
  ) {}

  async apply(): Promise<void> {
    this.deletedItems = []

    const pathsToDelete: string[] = []
    const idsToDelete: number[] = []
    for (const path of this.selectedPaths) {
      const viewModel = this.treeFacade.getTreeViewModelByPath(path)
      // Already gone (removed by an earlier edit or watcher sync) — skip.
      if (!viewModel) continue

      pathsToDelete.push(viewModel.path)
      idsToDelete.push(...this.getIdsFromTreeViewModel(viewModel))

      // Save metadata for revert
      this.deletedItems.push({
        path: viewModel.path,
        isDirectory: viewModel.directory,
        parentPath: window.utils.getDirName(viewModel.path),
      })
    }

    if (pathsToDelete.length === 0) return

    pathsToDelete.sort((a, b) => b.localeCompare(a))

    const response: Response<TrashMap[] | null> = await window.rendererToMain.delete(pathsToDelete)
    if (!response.result) return
    this.trashMap = response.data

    for (let i = 0; i < idsToDelete.length; i++) {
      this.tabEditorFacade.removeTab(idsToDelete[i])
    }

    // Re-resolve indices at apply time; applyDelete corrects selection state internally.
    const indices: number[] = []
    for (const item of this.deletedItems) {
      const idx = this.treeFacade.getFlattenIndexByPath(item.path)
      if (idx !== undefined) indices.push(idx)
    }
    this.treeFacade.applyDelete(indices)

    const tabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    await window.rendererToMain.syncTabSessionFromRenderer(tabEditorsDto)

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }

  async revert(): Promise<void> {
    const result = await window.rendererToMain.undo_delete(this.trashMap)
    if (!result) return

    for (const item of this.deletedItems) {
      this.treeFacade.applyCreate(item.parentPath, item.path, item.isDirectory)
    }

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }

  private getIdsFromTreeViewModel(vm: TreeViewModel, arr: number[] = []) {
    if (vm.directory && vm.children) {
      for (const child of vm.children) {
        this.getIdsFromTreeViewModel(child, arr)
      }
    }

    const tabEditorView = this.tabEditorFacade.getTabEditorViewByPath(vm.path)
    if (tabEditorView) arr.push(tabEditorView.getId())

    return arr
  }
}
