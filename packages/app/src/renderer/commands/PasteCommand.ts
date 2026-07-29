import type { ICommand } from "./index"
import type { TreeViewModel } from "../viewmodels/TreeViewModel"
import type ClipboardMode from "@shared/types/ClipboardMode"
import type Response from "@shared/types/Response"

import { TabEditorFacade, TreeFacade } from "../modules"

type UndoInfo = {
  src: string
  dest: string
  mode: ClipboardMode
  isDir: boolean
}

export class PasteCommand implements ICommand {
  private undoInfos: UndoInfo[] = []

  constructor(
    private treeFacade: TreeFacade,
    private tabEditorFacade: TabEditorFacade,
    private targetViewModel: TreeViewModel,
    private selectedViewModels: TreeViewModel[],
    private clipboardMode: ClipboardMode
  ) {}

  async execute(): Promise<void> {
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

  async undo(): Promise<void> {
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

      const view = this.tabEditorFacade.getTabEditorViewByPath(dest)
      if (view) {
        view.tabBox.title = src

        const viewModel = this.tabEditorFacade.getTabEditorViewModelById(view.getId())
        if (viewModel) viewModel.filePath = src

        this.tabEditorFacade.deleteTabEditorViewByPath(dest)
        this.tabEditorFacade.setTabEditorViewByPath(src, view)
      }
    }

    const viewModel = this.treeFacade.getRootTreeViewModel()
    const treeDto = this.treeFacade.toTreeDto(viewModel)
    await window.rendererToMain.syncTreeSessionFromRenderer(treeDto)
  }
}
