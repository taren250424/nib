import { inject, injectable } from "inversify"

import type ClipboardMode from "@shared/types/ClipboardMode"
import type Response from "@shared/types/Response"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TreeViewModel } from "../viewmodels/TreeViewModel"

import type { UndoableEdit } from "../edits"

import { DI, DOM } from "../constants"

import closedFolderSvg from "../assets/icons/closed_folder.svg?raw"
import openedFolderSvg from "../assets/icons/opened_folder.svg?raw"

import { CommandQueue, FocusTracker } from "../core"
// Straight from the files, not from ./index: the barrel exports this class too,
// so importing through it would have the module depend on itself. The value form
// is needed here rather than `import type` because emitDecoratorMetadata writes
// these into the constructor's design:paramtypes.
import { TabEditorFacade } from "./tab_editor/TabEditorFacade"
import { TabController } from "./TabController"
import { TreeFacade } from "./tree/TreeFacade"
import { TreeHistory } from "./tree/TreeHistory"
import { CreateEdit, DeleteEdit, RenameEdit, TransferEdit } from "../edits"

import { isPathInside } from "../utils/paths"
import { sleep } from "../utils/sleep"

/**
 * Tree commands: file operations (create, rename, delete, paste, drop), their
 * undo/redo through TreeHistory, and keyboard navigation — the destination of
 * the `tree.*` ids.
 *
 * The only place that runs an edit, which is why the watcher mute lives here;
 * TabEditorFacade is a normal dependency of that (a delete closes the tabs of
 * the files it removes), and TabController is here because opening a row's file
 * happens inside the same queued task as the tree work around it.
 */
@injectable()
export class TreeController {
  constructor(
    @inject(DI.FocusTracker) private readonly focusTracker: FocusTracker,
    @inject(DI.TabEditorFacade) private readonly tabEditorFacade: TabEditorFacade,
    @inject(DI.TabController) private readonly tabController: TabController,
    @inject(DI.TreeFacade) private readonly treeFacade: TreeFacade,
    @inject(DI.TreeHistory) private readonly treeHistory: TreeHistory,
    @inject(DI.CommandQueue) private readonly commandQueue: CommandQueue
  ) {}

  // Convention: public perform* methods enqueue; private _do* bodies run inside
  // the queue and must only call other _do* helpers (an enqueue from inside a
  // queued task would deadlock the chain).

  /**
   * Runs an edit forwards. The only place that calls apply().
   *
   * Every edit mutates the file system, and every such mutation has to mute the
   * Main-side watcher or it echoes back as an external change. That was spelled
   * out at each of the six call sites, which is one per chance to forget it; the
   * call sites keep their own bookkeeping, which is what actually differs
   * between them.
   */
  private _applyEdit(edit: UndoableEdit): Promise<void> {
    return this._withWatchSkip(() => edit.apply())
  }

  /** Runs an edit backwards. The only place that calls revert(). */
  private _revertEdit(edit: UndoableEdit): Promise<void> {
    return this._withWatchSkip(() => edit.revert())
  }

  /**
   * Holds the Main-side watcher skip (a counter) around an FS-mutating operation.
   * The release is delayed so trailing watcher events from this operation are
   * still ignored, without stalling the queue; overlapping holds are safe.
   */
  private async _withWatchSkip<T>(fn: () => Promise<T>): Promise<T> {
    await window.rendererToMain.setWatchSkipState(true)
    try {
      return await fn()
    } finally {
      sleep(300).then(() => window.rendererToMain.setWatchSkipState(false))
    }
  }

  //

  performUndoTree() {
    return this.commandQueue.enqueue(() => this.treeHistory.undo((edit) => this._revertEdit(edit)))
  }

  performRedoTree() {
    return this.commandQueue.enqueue(() => this.treeHistory.redo((edit) => this._applyEdit(edit)))
  }

  //

  // Keyboard navigation of the tree. `extend` is the Shift variant, which grows
  // the selection instead of replacing it.

  performFocusTreeUp(extend: boolean) {
    const index = this.treeFacade.focusedIndex
    if (index <= 0) return
    this._moveTreeFocus(index, -1, extend)
  }

  performFocusTreeDown(extend: boolean) {
    const index = this.treeFacade.focusedIndex
    if (index >= this.treeFacade.flattenTree.length - 1) return
    this._moveTreeFocus(index, 1, extend)
  }

  private _moveTreeFocus(fromIndex: number, delta: number, extend: boolean) {
    const index = fromIndex + delta

    if (extend) this.treeFacade.extendSelectionTo(index)
    else this.treeFacade.setSelection([index])

    // Real DOM focus is what scrolls the row into view.
    this.treeFacade.focusIndex(index)
  }

  //

  performOpenDirectoryByTreeNode(treeNode: HTMLElement) {
    return this.commandQueue.enqueue(() => this._doOpenDirectoryByTreeNode(treeNode))
  }

  private async _doOpenDirectoryByTreeNode(treeNode: HTMLElement) {
    const dirPath = treeNode.dataset[DOM.DATASET_ATTR_TREE_PATH]!
    const viewModel = this.treeFacade.getTreeViewModelByPath(dirPath)

    const treeNodeChildren = treeNode.nextElementSibling as HTMLElement
    const treeNodeType = treeNode.querySelector(DOM.SELECTOR_TREE_NODE_TYPE) as HTMLElement

    const previousExpandedStatus = viewModel.expanded
    if (!previousExpandedStatus) {
      if (!viewModel.children?.length) {
        const response: Response<TreeDto> = await window.rendererToMain.openDirectory(viewModel)
        if (!response.data) return

        const newViewModel = this.treeFacade.toTreeViewModel(response.data)

        viewModel.children = newViewModel.children
        this.treeFacade.render(newViewModel, treeNodeChildren)
      }

      if (treeNodeChildren.children.length === 0) {
        this.treeFacade.render(viewModel, treeNodeChildren)
      }
    }

    const nextExpandedStatus = !previousExpandedStatus
    viewModel.expanded = nextExpandedStatus
    treeNodeType.innerHTML = nextExpandedStatus ? openedFolderSvg : closedFolderSvg
    treeNodeChildren.classList.toggle(DOM.CLASS_EXPANDED, nextExpandedStatus)
    if (nextExpandedStatus) this.treeFacade.insertChildNodes(viewModel)
    else this.treeFacade.removeChildNodes(viewModel)
  }

  //

  performOpenFocusedTreeNode() {
    return this.commandQueue.enqueue(() => this._doOpenFocusedTreeNode())
  }

  private async _doOpenFocusedTreeNode() {
    const idx = Math.max(this.treeFacade.focusedIndex, 0)
    const viewModel = this.treeFacade.getTreeViewModelByIndex(idx)
    if (!viewModel) return

    if (viewModel.directory) {
      if (idx === 0) return
      const treeNode = this.treeFacade.getTreeNodeByIndex(idx)
      await this._doOpenDirectoryByTreeNode(treeNode)
    } else {
      await this.tabController.openFileInsideQueue(viewModel.path)
    }

    // Reclaim the focus the editor took during the open.
    this.treeFacade.focusIndex(idx)
  }

  //

  async performCreate(isDirectory: boolean) {
    // The name prompt must stay outside the queue: it blocks on user input
    // and would freeze every queued command behind it.
    const parentInfo = await this._resolveParentDirectory()
    if (!parentInfo) return

    const { idx, viewModel, container } = parentInfo

    if (!viewModel.expanded) {
      await this.performOpenDirectoryByTreeNode(this.treeFacade.getTreeNodeByIndex(idx))
    }

    const name = await this._promptForName(container, isDirectory, viewModel.indent)
    if (!name) return

    await this.commandQueue.enqueue(async () => {
      const filePath = await this._executeCreation(viewModel.path, name, isDirectory)
      if (!filePath) return

      this._selectTreeNodeAfterCreate(filePath)
      if (!isDirectory) await this._openTabEditorAfterCreate(filePath)
    })
  }

  private async _resolveParentDirectory() {
    let idx = Math.max(this.treeFacade.focusedIndex, 0)
    let viewModel = this.treeFacade.getTreeViewModelByIndex(idx)

    if (!viewModel.directory) {
      idx = this.treeFacade.findParentDirectoryIndex(idx)
      viewModel = this.treeFacade.getTreeViewModelByIndex(idx)
    }

    // If idx is 0 (the root directory), we use the wrapper mapped in TreeRenderer.
    // TreeRenderer maps the root path to simpleBar.getContentElement().
    // Using treeNodeContainer directly would append the input outside SimpleBar's scrollable content.
    const wrapper = this.treeFacade.getTreeWrapperByIndex(idx)
    const container = idx === 0 ? wrapper : (wrapper.querySelector(DOM.SELECTOR_TREE_NODE_CHILDREN) as HTMLElement)

    return { idx, viewModel, container }
  }

  private _promptForName(container: HTMLElement, isDirectory: boolean, indent: number): Promise<string | null> {
    return new Promise((resolve) => {
      const { wrapper, input } = this.treeFacade.createInput(isDirectory, indent)
      let finished = false

      const cleanup = () => {
        if (finished) return
        finished = true
        input.removeEventListener("keydown", onKeyDown)
        input.removeEventListener("blur", onBlur)
        wrapper.remove()
      }

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.stopPropagation()
          e.preventDefault()
          const value = input.value.trim()
          cleanup()
          resolve(value || null)
        } else if (e.key === "Escape") {
          e.stopPropagation()
          e.preventDefault()
          cleanup()
          resolve(null)
        }
      }

      const onBlur = () => {
        const value = input.value.trim()
        cleanup()
        resolve(value || null)
      }

      container.appendChild(wrapper)
      input.addEventListener("keydown", onKeyDown)
      input.addEventListener("blur", onBlur)
      input.focus()
      input.select()
    })
  }

  /** Returns where the file landed, or "" if it did not. Main picks a unique name. */
  private async _executeCreation(parentPath: string, name: string, isDirectory: boolean) {
    const edit = new CreateEdit(this.treeFacade, this.tabEditorFacade, parentPath, name, isDirectory)

    try {
      await this._applyEdit(edit)

      // Main can refuse a create without throwing. A refusal recorded on the
      // stack would spend an undo step — and wipe the redo branch — on an edit
      // whose revert has nothing to remove.
      if (edit.didCreate) this.treeHistory.record(edit)
    } catch (error) {
      console.error("[TreeController] create failed:", error)
    }

    return edit.getCreatedPath()
  }

  private _selectTreeNodeAfterCreate(filePath: string) {
    const idx = this.treeFacade.getFlattenIndexByPath(filePath)
    if (idx === undefined) return

    this.treeFacade.setSelection([idx])
    this.treeFacade.focusIndex(idx)
  }

  private async _openTabEditorAfterCreate(filePath: string) {
    await this.tabController.openFileInsideQueue(filePath)
    this.focusTracker.setFocusedTask("editor")
  }

  //

  async performRename() {
    const focus = this.focusTracker.getFocusedTask()
    if (focus !== "tree") return

    const targetInfo = this._resolveRenameTarget()
    if (!targetInfo) return

    const { treeNode, oldPath, isDirectory } = targetInfo

    const newName = await this._promptForRename(treeNode)
    if (!newName) return

    const dir = window.utils.getDirName(oldPath)
    const newPath = window.utils.getJoinedPath(dir, newName)

    if (oldPath === newPath) {
      this._restoreTreeSpan(newPath)
      return
    }

    await this.commandQueue.enqueue(() => this._executeRename(isDirectory, oldPath, newPath))
  }

  private _resolveRenameTarget() {
    // Index 0 is the root, which has no row of its own and is not the app's to
    // rename; -1 is nothing selected. Both would otherwise reach for an element
    // that is not the current item.
    const index = this.treeFacade.focusedIndex
    if (index <= 0) return null

    const treeNode = this.treeFacade.getTreeNodeByIndex(index)
    const oldPath = treeNode.dataset[DOM.DATASET_ATTR_TREE_PATH]!
    const viewModel = this.treeFacade.getTreeViewModelByPath(oldPath)
    return { treeNode, oldPath, isDirectory: viewModel.directory }
  }

  private _promptForRename(treeNode: HTMLElement): Promise<string | null> {
    return new Promise((resolve) => {
      const treeNodeSpan = treeNode.querySelector(DOM.SELECTOR_TREE_NODE_TEXT) as HTMLElement

      const treeNodeInput = document.createElement("input")
      treeNodeInput.type = "text"
      treeNodeInput.value = treeNodeSpan.textContent ?? ""
      treeNodeInput.classList.add(DOM.CLASS_TREE_NODE_INPUT)

      treeNode.classList.remove(DOM.CLASS_FOCUSED)
      treeNode.replaceChild(treeNodeInput, treeNodeSpan)
      treeNodeInput.focus()

      const lastDotIndex = treeNodeInput.value.lastIndexOf(".")
      if (lastDotIndex > 0) treeNodeInput.setSelectionRange(0, lastDotIndex)
      else treeNodeInput.select()

      let finished = false

      const cleanup = () => {
        if (finished) return
        finished = true
        treeNodeInput.removeEventListener("keydown", onKeyDown)
        treeNodeInput.removeEventListener("blur", onBlur)
      }

      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Enter") {
          e.stopPropagation()
          e.preventDefault()
          const val = treeNodeInput.value.trim()
          cleanup()
          resolve(val || null)
        } else if (e.key === "Escape") {
          e.stopPropagation()
          e.preventDefault()
          cleanup()
          treeNode.replaceChild(treeNodeSpan, treeNodeInput)
          resolve(null)
        }
      }

      const onBlur = () => {
        const val = treeNodeInput.value.trim()
        cleanup()
        resolve(val || null)
      }

      treeNodeInput.addEventListener("keydown", onKeyDown)
      treeNodeInput.addEventListener("blur", onBlur)
    })
  }

  private async _executeRename(isDirectory: boolean, prePath: string, newPath: string) {
    const edit = new RenameEdit(this.treeFacade, this.tabEditorFacade, isDirectory, prePath, newPath)

    try {
      await this._applyEdit(edit)
      this.treeHistory.record(edit)
    } catch (error) {
      console.error("[TreeController] rename failed:", error)
      this._restoreTreeSpan(prePath)
    }
  }

  /** Takes the rename input back off a row that is keeping its name. */
  private _restoreTreeSpan(path: string) {
    this.treeFacade.renderNodeLabel(path)

    // Opening the input dropped the current-item border; the node is still the
    // current item, so put back what the state says.
    this.treeFacade.refreshNodeState(path)
  }

  //

  performDelete() {
    return this.commandQueue.enqueue(() => this._doDelete())
  }

  private async _doDelete() {
    // The command re-resolves these at apply time, so overlapping or stale
    // requests can never delete the wrong nodes.
    const selectedPaths = this.treeFacade.getSelectedPaths()
    if (selectedPaths.length === 0) return

    const edit = new DeleteEdit(this.treeFacade, this.tabEditorFacade, selectedPaths)

    try {
      await this._applyEdit(edit)

      // Same rule as a transfer that moved nothing: a delete that removed
      // nothing (paths already gone, or Main refused) takes no undo step.
      if (edit.didDelete) this.treeHistory.record(edit)
    } catch (error) {
      console.error("[TreeController] delete failed:", error)
    }
  }

  //

  // The clipboard holds selection roots only. Main's paste copies a directory
  // recursively, so listing a descendant here would paste it a second time as a
  // sibling of its own parent. Descendants are not marked as cut either — the
  // wrapper's colour is inherited by the child nodes it wraps.
  performCutTree() {
    this.treeFacade.setClipboard(this.treeFacade.getSelectedPaths(), "cut")
  }

  /** Esc drops a pending cut, the way it does in every file manager. */
  performClearTreeClipboard() {
    this.treeFacade.clearClipboard()
  }

  /** Roots only, for the same reason as {@link performCutTree}. */
  performCopyTree() {
    this.treeFacade.setClipboard(this.treeFacade.getSelectedPaths(), "copy")
  }

  async performPasteTreeWithContextmenu() {
    await this._enqueuePasteTree(this.treeFacade.contextTreeIndex)
  }

  async performPasteTreeWithShortcut() {
    await this._enqueuePasteTree(this.treeFacade.focusedIndex)
  }

  /**
   * Moves the dragged nodes onto the node the drag was dropped on.
   *
   * A drop is a move in its own right, not a cut followed by a paste: routing it
   * through the clipboard overwrote whatever the user had cut or copied before,
   * greyed the dragged nodes out mid-drop, and left the two halves able to
   * disagree about what was being moved.
   */
  async performMoveTreeFromDrag() {
    // What the drag carries is the selection it started from — read here rather
    // than inside the queue, since that is what the user picked up.
    const sourcePaths = this.treeFacade.getSelectedPaths()
    if (sourcePaths.length === 0) return

    await this._enqueueTransferTree(this.treeFacade.selectedDragIndex, sourcePaths, (targetPath) =>
      this._doTransferTree(targetPath, sourcePaths, "cut")
    )
  }

  private async _enqueuePasteTree(targetIndex: number): Promise<void> {
    // The clipboard is read again inside the queue; this copy only answers
    // which target a collapsed directory should be expanded for.
    await this._enqueueTransferTree(targetIndex, this.treeFacade.getClipboardPaths(), (targetPath) =>
      this._doPasteTree(targetPath)
    )
  }

  private async _enqueueTransferTree(
    targetIndex: number,
    sourcePaths: readonly string[],
    transfer: (targetPath: string) => Promise<unknown>
  ): Promise<void> {
    if (targetIndex === -1) return

    // Capture the target as a path: the index may shift before the queued task runs.
    const targetViewModel = this.treeFacade.getTreeViewModelByIndex(targetIndex)
    if (!targetViewModel) return

    await this._expandTransferTarget(targetIndex, targetViewModel, sourcePaths)

    await this.commandQueue.enqueue(() => transfer(targetViewModel.path))
  }

  /**
   * Opens a collapsed target before moving into it, the way create already does.
   *
   * The file otherwise lands somewhere the user cannot see, and a collapsed parent
   * keeps its children out of the flatten tree, so an undo could not find the node
   * that had just been added. Expanding first puts it on the ordinary path.
   *
   * Runs before the queue: opening a directory enqueues, and enqueueing from
   * inside a queued task would deadlock the chain.
   */
  private async _expandTransferTarget(
    targetIndex: number,
    targetViewModel: TreeViewModel,
    sourcePaths: readonly string[]
  ) {
    // Index 0 is the root, which has no node element of its own and is never
    // collapsed. A file target redirects to its parent, which is already open —
    // its child is on screen.
    if (targetIndex <= 0 || !targetViewModel.directory || targetViewModel.expanded) return

    // Landing on one of the moved nodes redirects to its parent instead.
    if (sourcePaths.includes(targetViewModel.path)) return

    await this.performOpenDirectoryByTreeNode(this.treeFacade.getTreeNodeByIndex(targetIndex))
  }

  private async _doPasteTree(targetPath: string) {
    // Read inside the queue: the clipboard may have moved on while this waited.
    const clipboardMode = this.treeFacade.clipboardMode
    const transferred = await this._doTransferTree(targetPath, this.treeFacade.getClipboardPaths() ?? [], clipboardMode)

    // A cut is consumed by its paste. Without this the sources keep their
    // greyed-out cut styling forever and the mode never leaves "cut", so
    // Paste stays enabled pointing at nodes that have already moved.
    // Copy keeps its clipboard so it can be pasted repeatedly.
    if (transferred && clipboardMode === "cut") this.treeFacade.clearClipboard()
  }

  /**
   * Copies or moves `sourcePaths` into `targetPath`, as one undoable step.
   *
   * Shared by paste and by a drag drop; the two differ only in where the sources
   * come from and in whether a clipboard is consumed afterwards. Returns whether
   * anything was transferred.
   */
  private async _doTransferTree(
    targetPath: string,
    sourcePaths: readonly string[],
    mode: ClipboardMode
  ): Promise<boolean> {
    let targetIndex = this.treeFacade.getFlattenIndexByPath(targetPath)
    if (targetIndex === undefined) return false

    let targetViewModel = this.treeFacade.getTreeViewModelByIndex(targetIndex)

    const isTargetingSelf = sourcePaths.includes(targetViewModel.path)

    if (!targetViewModel.directory || isTargetingSelf) {
      targetIndex = this.treeFacade.findParentDirectoryIndex(targetIndex)
      targetViewModel = this.treeFacade.getTreeViewModelByIndex(targetIndex)
    }

    // Re-resolved here rather than carried in: a source may have been deleted
    // while this waited its turn in the queue.
    const selectedViewModels = []
    const nested = []
    for (const path of sourcePaths) {
      const viewModel = this.treeFacade.getTreeViewModelByPath(path)
      if (!viewModel) continue

      // A directory cannot go inside itself: the copy would be reading from what
      // it is writing into. fs-extra throws on it, and nothing here said so —
      // the drop simply did nothing and left the user to guess why.
      if (viewModel.directory && isPathInside(targetViewModel.path, viewModel.path)) nested.push(viewModel)
      else selectedViewModels.push(viewModel)
    }

    if (nested.length > 0) await this._warnAboutNestedTransfer(nested, targetViewModel, mode)
    if (selectedViewModels.length === 0) return false

    const edit = new TransferEdit(this.treeFacade, this.tabEditorFacade, targetViewModel, selectedViewModels, mode)

    try {
      await this._applyEdit(edit)

      // Dropping a node onto the directory it is already in is a no-op, and a
      // common enough gesture that letting it take an undo step — and clear the
      // redo stack — would make undo answer for something the user never did.
      if (!edit.didTransfer) return false

      this.treeHistory.record(edit)
      return true
    } catch (error) {
      console.error("[TreeController] tree transfer failed:", error)
      return false
    }
  }

  private async _warnAboutNestedTransfer(nested: TreeViewModel[], target: TreeViewModel, mode: ClipboardMode) {
    const names = nested.map((viewModel) => `"${viewModel.name}"`).join(", ")
    const verb = mode === "copy" ? "copy" : "move"

    await window.rendererToMain.showWarning(
      `Cannot ${verb} ${names} into "${target.name}" — a folder cannot go inside itself.`
    )
  }
}
