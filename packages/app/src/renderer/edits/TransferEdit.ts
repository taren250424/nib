import type { TreeViewModel } from "../viewmodels/TreeViewModel"
import type ClipboardMode from "@shared/types/ClipboardMode"
import type Response from "@shared/types/Response"
import type { UndoableEdit } from "./UndoableEdit"

import type { TabEditorFacade } from "../modules/tab_editor/TabEditorFacade"
import type { TreeFacade } from "../modules/tree/TreeFacade"

type UndoInfo = {
  src: string
  dest: string
  mode: ClipboardMode
  isDir: boolean
}

/** Copies or moves nodes into a directory — what a paste and a drag drop both are. */
export class TransferEdit implements UndoableEdit {
  private undoInfos: UndoInfo[] = []

  /**
   * Whether apply() actually moved or copied anything.
   *
   * Main drops the sources that already live in the target directory, so a paste
   * or a drop onto a node's own parent succeeds having done nothing. There is
   * nothing to undo in that case, and nothing to spend an undo step on.
   */
  get didTransfer(): boolean {
    return this.undoInfos.length > 0
  }

  constructor(
    private treeFacade: TreeFacade,
    private tabEditorFacade: TabEditorFacade,
    private targetViewModel: TreeViewModel,
    private selectedViewModels: TreeViewModel[],
    private clipboardMode: ClipboardMode
  ) {}

  async apply(): Promise<void> {
    const targetDto = this.treeFacade.toTreeDto(this.targetViewModel)
    const selectedDtos = this.selectedViewModels.map((viewModel) => {
      return this.treeFacade.toTreeDto(viewModel)
    })

    const response: Response<string[]> = await window.rendererToMain.pasteTree(
      targetDto,
      selectedDtos,
      this.clipboardMode
    )

    if (response.result) {
      const newPaths = response.data

      // Replicate the same-dir filter logic from Main's TreeService.paste()
      const targetDir = targetDto.path
      const targetsToProcess =
        this.clipboardMode === "cut"
          ? selectedDtos.filter((dto) => window.utils.getDirName(dto.path) !== targetDir)
          : selectedDtos

      // For cut mode, remove old nodes from tree first
      if (this.clipboardMode === "cut") {
        const indicesToRemove: number[] = []
        for (const dto of targetsToProcess) {
          const idx = this.treeFacade.getFlattenIndexByPath(dto.path)
          if (idx !== undefined) indicesToRemove.push(idx)
        }
        if (indicesToRemove.length > 0) {
          this.treeFacade.applyDelete(indicesToRemove)
        }
      }

      // Build undo info and update tabs (for cut mode)
      for (let i = 0; i < targetsToProcess.length; i++) {
        const oldPath = targetsToProcess[i].path
        const newPath = newPaths[i]

        this.undoInfos.push({
          src: oldPath,
          dest: newPath,
          mode: this.clipboardMode,
          isDir: targetsToProcess[i].directory,
        })

        if (this.clipboardMode === "cut") {
          const view = this.tabEditorFacade.getTabEditorViewByPath(oldPath)

          if (view) {
            const newFileName = window.utils.getBaseName(newPath)
            view.tabSpan.title = newPath
            view.tabSpan.textContent = newFileName

            const viewModel = this.tabEditorFacade.getTabEditorViewModelById(view.getId())
            if (viewModel) {
              viewModel.filePath = newPath
              viewModel.fileName = newFileName
            }
          }

          this.tabEditorFacade.deleteTabEditorViewByPath(oldPath)
          if (view) this.tabEditorFacade.setTabEditorViewByPath(newPath, view)
        }
      }

      // Partial update: add new nodes to tree
      const isDirectories = targetsToProcess.map((dto) => dto.directory)
      this.treeFacade.applyPaste(targetDir, newPaths, isDirectories)

      const viewModel = this.treeFacade.getRootTreeViewModel()
      const treeDto = this.treeFacade.toTreeDto(viewModel)
      await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
    }
  }

  async revert(): Promise<void> {
    for (let i = this.undoInfos.length - 1; i >= 0; i--) {
      const { src, dest, mode, isDir } = this.undoInfos[i]

      if (mode === "cut") await window.rendererToMain.copyTree(dest, src)
      await window.rendererToMain.deletePermanently(dest)

      // Remove pasted node from tree
      const destIdx = this.treeFacade.getFlattenIndexByPath(dest)
      if (destIdx !== undefined) {
        this.treeFacade.applyDelete([destIdx])
      }

      // For cut mode, restore the original node
      if (mode === "cut") {
        const parentPath = window.utils.getDirName(src)
        this.treeFacade.applyCreate(parentPath, src, isDir)
      }

      // The mirror of apply()'s cut branch: the tooltip lives on tabSpan, and
      // the name goes back too — Main may have picked a different unique name
      // on the way in, so dest's base name is not necessarily src's.
      const view = this.tabEditorFacade.getTabEditorViewByPath(dest)
      if (view) {
        const fileName = window.utils.getBaseName(src)
        view.tabSpan.title = src
        view.tabSpan.textContent = fileName

        const viewModel = this.tabEditorFacade.getTabEditorViewModelById(view.getId())
        if (viewModel) {
          viewModel.filePath = src
          viewModel.fileName = fileName
        }

        this.tabEditorFacade.deleteTabEditorViewByPath(dest)
        this.tabEditorFacade.setTabEditorViewByPath(src, view)
      }
    }

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }
}
