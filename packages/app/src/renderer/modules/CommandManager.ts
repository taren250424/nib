import { inject, injectable } from "inversify"

import type ClipboardMode from "@shared/types/ClipboardMode"
import type Response from "@shared/types/Response"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TreeViewModel } from "../viewmodels/TreeViewModel"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"

import type { UndoableEdit } from "../edits"
import type { SettingsViewModel } from "../viewmodels/SettingsViewModel"

import { DI, DOM } from "../constants"

import closedFolderSvg from "../assets/icons/closed_folder.svg?raw"
import openedFolderSvg from "../assets/icons/opened_folder.svg?raw"

import { CommandQueue, ContextKeyService, FocusManager } from "../core"
import { TabEditorFacade, TreeFacade, SettingsFacade } from "./index"
import { CreateEdit, DeleteEdit, RenameEdit, TransferEdit } from "../edits"

import { sleep } from "../utils/sleep"

@injectable()
export class CommandManager {
  private undoStack: UndoableEdit[] = []
  private redoStack: UndoableEdit[] = []

  constructor(
    @inject(DI.FocusManager) private readonly focusManager: FocusManager,
    @inject(DI.ContextKeyService) private readonly contextKeyService: ContextKeyService,
    @inject(DI.SettingsFacade) private readonly settingsFacade: SettingsFacade,
    @inject(DI.TabEditorFacade) private readonly tabEditorFacade: TabEditorFacade,
    @inject(DI.TreeFacade) private readonly treeFacade: TreeFacade,
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

  performUndoEditor() {
    this.tabEditorFacade.undoEditor()
  }

  performUndoTree() {
    return this.commandQueue.enqueue(() => this._doUndoTree())
  }

  private async _doUndoTree() {
    const edit = this.undoStack.pop()
    if (!edit) return

    try {
      await this._revertEdit(edit)
      this.redoStack.push(edit)
    } catch (err) {
      // Undo failed (e.g., parent copied into child, or src/dest no longer exists).
      // OS/File system may have ignored the operation; we just skip it to avoid breaking the stack.
      console.error("[CommandManager] undo(tree) failed:", err)
    }

    // The pop already happened, so the context has moved whether or not the
    // undo itself succeeded.
    this._publishHistoryContext()
  }

  performRedoEditor() {
    this.tabEditorFacade.redoEditor()
  }

  performRedoTree() {
    return this.commandQueue.enqueue(() => this._doRedoTree())
  }

  private async _doRedoTree() {
    const edit = this.redoStack.pop()
    if (!edit) return

    try {
      await this._applyEdit(edit)
      this.undoStack.push(edit)
    } catch (err) {
      console.error("[CommandManager] redo(tree) failed:", err)
    }

    this._publishHistoryContext()
  }

  /**
   * Records an edit that can be undone. A new edit invalidates the redo branch,
   * exactly as every other editor does.
   */
  private _pushUndoable(edit: UndoableEdit) {
    this.undoStack.push(edit)
    this.redoStack.length = 0
    this._publishHistoryContext()
  }

  private _publishHistoryContext() {
    this.contextKeyService.update({
      canUndoTree: this.undoStack.length > 0,
      canRedoTree: this.redoStack.length > 0,
    })
  }

  //

  performNewTab() {
    return this.commandQueue.enqueue(() => this._doNewTab())
  }

  private async _doNewTab() {
    const response: Response<number> = await window.rendererToMain.newTab()
    if (response.result) await this.tabEditorFacade.addTab(response.data)
  }

  performOpenFile(filePath?: string) {
    return this.commandQueue.enqueue(() => this._doOpenFile(filePath))
  }

  private async _doOpenFile(filePath?: string) {
    if (filePath) {
      const tabEditorView = this.tabEditorFacade.getTabEditorViewByPath(filePath)
      if (tabEditorView) {
        this.tabEditorFacade.activateTabEditorById(tabEditorView.getId())
        return
      }

      // A path always refers to a tree file. Re-validate at apply time:
      // the file may have been deleted while this task waited in the queue.
      if (!this.treeFacade.getTreeViewModelByPath(filePath)) return
    }

    try {
      const response: Response<TabEditorDto> = await window.rendererToMain.openFile(filePath)
      if (response.result && response.data) {
        const data = response.data
        await this.tabEditorFacade.addTab(data.id, data.filePath, data.fileName, data.content, data.isBinary)
      }
    } catch (error) {
      // e.g. the file vanished between our tree check and Main's read (external delete).
      console.error("[CommandManager] openFile failed:", error)
    }
  }

  performOpenDirectoryByDialog() {
    return this.commandQueue.enqueue(() => this._doOpenDirectoryByDialog())
  }

  private async _doOpenDirectoryByDialog() {
    const openDirectoryResponse: Response<TreeDto> = await window.rendererToMain.openDirectory()
    if (!openDirectoryResponse.data) return

    const responseViewModel = this.treeFacade.toTreeViewModel(openDirectoryResponse.data)

    // Everything below names the tree that is being replaced, so it has to be
    // dropped before the render: a selection or clipboard still holding paths
    // from the old directory would paint marks onto same-named nodes of the new
    // one. (The wrapper map is cleared by the full render itself.)
    this.treeFacade.clearSelection()
    this.treeFacade.clearClipboard()

    this.treeFacade.render(responseViewModel)
    this.treeFacade.setRootTreeViewModel(responseViewModel)

    // Cleanup previous tabs.
    const tabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const closeAllTabsResponse = await window.rendererToMain.closeAllTabs(tabEditorsDto)
    if (closeAllTabsResponse.result) this.tabEditorFacade.removeAllTabs(closeAllTabsResponse.data)
  }

  performCloseActiveTab() {
    return this.performCloseTab(this.tabEditorFacade.activeTabId)
  }

  performCloseContextTab() {
    return this.performCloseTab(this.tabEditorFacade.contextTabId)
  }

  performOpenSettings() {
    this.settingsFacade.openSettings()
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
      await this._doOpenFile(viewModel.path)
    }

    // Reclaim the focus the editor took during the open.
    this.treeFacade.focusIndex(idx)
  }

  //

  async performSave() {
    const dto = this.tabEditorFacade.getActiveTabEditorDto()
    if (!dto.isModified) return
    const response: Response<TabEditorDto> = await window.rendererToMain.save(dto)
    if (response.result && !response.data.isModified) this.tabEditorFacade.applySaveResult(response.data)
  }

  async performSaveAs() {
    const dto: TabEditorDto = this.tabEditorFacade.getActiveTabEditorDto()
    const response: Response<TabEditorDto> = await window.rendererToMain.saveAs(dto)
    if (response.result && response.data) {
      this.tabEditorFacade.applySaveResult(response.data)
      await this.tabEditorFacade.addTab(
        response.data.id,
        response.data.filePath,
        response.data.fileName,
        response.data.content,
        response.data.isBinary,
        true
      )
    }
  }

  async performSaveAll() {
    const tabEditorsDto: TabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const response: Response<TabEditorsDto> = await window.rendererToMain.saveAll(tabEditorsDto)
    if (response.result) this.tabEditorFacade.applySaveAllResults(response.data)
  }

  //

  performCloseTab(id: number) {
    return this.commandQueue.enqueue(() => this._doCloseTab(id))
  }

  private async _doCloseTab(id: number) {
    const dto = this.tabEditorFacade.getTabEditorDtoById(id)
    if (!dto) return
    const response: Response<void> = await window.rendererToMain.closeTab(dto)
    if (response.result) this.tabEditorFacade.removeTab(dto.id)
    if (this.tabEditorFacade.activeTabId === -1) this.performCloseFindReplaceBox()
  }

  performCloseOtherTabs() {
    return this.commandQueue.enqueue(() => this._doCloseOtherTabs())
  }

  private async _doCloseOtherTabs() {
    const tabEditorDtoToExclude = this.tabEditorFacade.getTabEditorDtoById(this.tabEditorFacade.contextTabId)
    const tabEditorsDto: TabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const response: Response<boolean[]> = await window.rendererToMain.closeOtherTabs(
      tabEditorDtoToExclude,
      tabEditorsDto
    )
    if (response.result) this.tabEditorFacade.removeTabsExcept(response.data)
  }

  performCloseTabsToRight() {
    return this.commandQueue.enqueue(() => this._doCloseTabsToRight())
  }

  private async _doCloseTabsToRight() {
    const tabEditorDtoAsReference = this.tabEditorFacade.getTabEditorDtoById(this.tabEditorFacade.contextTabId)
    const tabEditorsDto: TabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const response: Response<boolean[]> = await window.rendererToMain.closeTabsToRight(
      tabEditorDtoAsReference,
      tabEditorsDto
    )
    if (response.result) this.tabEditorFacade.removeTabsToRight(response.data)
  }

  performCloseAllTabs() {
    return this.commandQueue.enqueue(() => this._doCloseAllTabs())
  }

  private async _doCloseAllTabs() {
    const tabEditorsDto: TabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const response: Response<boolean[]> = await window.rendererToMain.closeAllTabs(tabEditorsDto)
    if (response.result) this.tabEditorFacade.removeAllTabs(response.data)
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
      this._pushUndoable(edit)
    } catch (error) {
      console.error("[CommandManager] create failed:", error)
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
    await this._doOpenFile(filePath)
    this.focusManager.setFocusedTask("editor")
  }

  //

  async performRename() {
    const focus = this.focusManager.getFocusedTask()
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
      this._pushUndoable(edit)
    } catch (error) {
      console.error("[CommandManager] rename failed:", error)
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
      this._pushUndoable(edit)
    } catch (error) {
      console.error("[CommandManager] delete failed:", error)
    }
  }

  //

  performCutEditor() {
    const view = this.tabEditorFacade.getActiveTabEditorView()
    view.markAsModified()
  }

  async performCutEditorManual() {
    const sel = window.getSelection()
    const selectedText = sel?.toString()
    if (!sel || !selectedText) return

    await window.rendererToMain.cutEditor(selectedText)
    sel.deleteFromDocument()

    this.performCutEditor()
  }

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

  async performCopyEditor() {
    const sel = window.getSelection()
    const selectedText = window.getSelection()?.toString()
    if (!sel || !selectedText) return

    await window.rendererToMain.copyEditor(selectedText)
  }

  /** Roots only, for the same reason as {@link performCutTree}. */
  performCopyTree() {
    this.treeFacade.setClipboard(this.treeFacade.getSelectedPaths(), "copy")
  }

  performPasteEditor() {
    const view = this.tabEditorFacade.getActiveTabEditorView()
    view.markAsModified()
  }

  async performPasteEditorManual() {
    const editable = document.querySelector('#editor-container [contenteditable="true"]') as HTMLElement
    if (!editable) return
    editable.focus()

    const sel = window.getSelection()
    if (!sel || !sel.rangeCount) return
    sel.deleteFromDocument()

    const text = await window.rendererToMain.pasteEditor()
    const textNode = document.createTextNode(text)
    const range = sel.getRangeAt(0)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    // Defensive code to ensure cursor positioning
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)

    this.performPasteEditor()
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
    for (const path of sourcePaths) {
      const viewModel = this.treeFacade.getTreeViewModelByPath(path)
      if (viewModel) selectedViewModels.push(viewModel)
    }
    if (selectedViewModels.length === 0) return false

    const edit = new TransferEdit(this.treeFacade, this.tabEditorFacade, targetViewModel, selectedViewModels, mode)

    try {
      await this._applyEdit(edit)

      // Dropping a node onto the directory it is already in is a no-op, and a
      // common enough gesture that letting it take an undo step — and clear the
      // redo stack — would make undo answer for something the user never did.
      if (!edit.didTransfer) return false

      this._pushUndoable(edit)
      return true
    } catch (error) {
      console.error("[CommandManager] tree transfer failed:", error)
      return false
    }
  }

  //

  toggleFindReplaceBox(showReplace: boolean) {
    const activeView = this.tabEditorFacade.getActiveTabEditorView()
    if (!activeView || activeView.isBinary) return

    // What the selection is for depends on its shape. A phrase on one line is
    // what to look for; several lines are where to look, which is the same call
    // VSCode makes. Either way the last query is left alone if there is neither.
    const selectedText = activeView.getSelectedText()
    const spansLines = selectedText.includes("\n")

    const seed = selectedText && !spansLines ? selectedText : activeView.getWordAtCursor()
    if (seed) {
      this._setSearchQuery(seed)
      this.tabEditorFacade.findInput.value = seed
    }

    // Offered on the way in and not later: stepping to a match selects it, so by
    // the time anyone presses the button the editor has forgotten what was
    // picked out. Only on the way in, too — Ctrl+F on an open box would
    // otherwise narrow the range to the match currently selected.
    if (!this.tabEditorFacade.findReplaceOpen) {
      activeView.offerSearchRange(activeView.selectionRangeAtOpen())
      if (spansLines) activeView.toggleSearchInRange()
    }
    this.tabEditorFacade.syncFindInSelectionButton()

    this.tabEditorFacade.findAndReplaceContainer.style.display = "flex"
    this.tabEditorFacade.setReplaceRowVisible(showReplace)
    this.tabEditorFacade.findReplaceOpen = true
    this.contextKeyService.set("findReplaceOpen", true)
    this.tabEditorFacade.replaceInfo.textContent = ""

    if (showReplace) this.tabEditorFacade.replaceInput.select()
    else this.tabEditorFacade.findInput.select()

    // Anchor the session where the caret is, so typing the query searches
    // outwards from the reading position rather than from the last match.
    activeView.captureSearchAnchor()
    this._refreshFind()
  }

  /**
   * The query is the whole of what F3 needs, so whether there is one is
   * published from wherever it is assigned rather than read from the box —
   * F3 works with the box closed, on the query it was last given.
   */
  private _setSearchQuery(query: string) {
    this.tabEditorFacade.searchQuery = query
    this.contextKeyService.set("hasSearchQuery", query.length > 0)
  }

  performToggleReplaceRow() {
    this.tabEditorFacade.setReplaceRowVisible(!this.tabEditorFacade.isReplaceRowVisible())
  }

  performSearchQueryChanged(query: string) {
    this._setSearchQuery(query)
    // Typing ends a walk through the history: the next ↑ starts from the newest
    // entry again, and the draft it would have restored is this text.
    this.tabEditorFacade.searchHistory.queryChanged(query)
    this.tabEditorFacade.replaceInfo.textContent = ""
    // The input event is debounced, so it can arrive after the box was
    // closed (e.g. Esc committing an IME composition); searching then
    // would repaint highlights that close just cleared.
    if (!this.tabEditorFacade.findReplaceOpen) return
    this._refreshFind()
  }

  /** Re-runs a query that is still being edited, without stepping to the next match. */
  private _refreshFind() {
    this.tabEditorFacade.findNextMatch(this.tabEditorFacade.findDirection, "refine")
  }

  performReplaceQueryChanged(query: string) {
    this.tabEditorFacade.replaceQuery = query
    this.tabEditorFacade.replaceInfo.textContent = ""
  }

  performToggleSearchOption(option: "matchCase" | "wholeWord") {
    const enabled = this.tabEditorFacade.toggleSearchOption(option)

    const buttons = {
      matchCase: this.tabEditorFacade.findOptionCase,
      wholeWord: this.tabEditorFacade.findOptionWord,
    }
    buttons[option].classList.toggle(DOM.CLASS_SELECTED, enabled)

    // Match lists computed with the previous options are meaningless now.
    this.tabEditorFacade.clearAllSearches()
    this._refreshFind()
  }

  /** No re-search: what counts as a match has not changed, only how it is written back. */
  performTogglePreserveCase() {
    const enabled = this.tabEditorFacade.togglePreserveCase()
    this.tabEditorFacade.findOptionPreserveCase.classList.toggle(DOM.CLASS_SELECTED, enabled)
  }

  performToggleFindInSelection() {
    const view = this.tabEditorFacade.getActiveTabEditorView()
    if (!view || view.isBinary || !view.hasSearchRange()) return

    view.toggleSearchInRange()
    this.tabEditorFacade.syncFindInSelectionButton()

    // Unlike Preserve Case this does change what counts as a match. Only this
    // view's list is affected — the range is a stretch of its own document.
    this._refreshFind()
  }

  performFind(direction: "up" | "down") {
    // Asking for a match is the moment a query stops being something half-typed
    // and becomes one worth offering back. Live search as you type is not.
    this.tabEditorFacade.searchHistory.record(this.tabEditorFacade.searchQuery)
    this.tabEditorFacade.findNextMatch(direction)
  }

  /** Walks ↑/↓ through the queries searched for so far. */
  performSearchHistory(direction: "older" | "newer") {
    const history = this.tabEditorFacade.searchHistory
    const input = this.tabEditorFacade.findInput

    const query = direction === "older" ? history.older(input.value) : history.newer()
    if (query === undefined) return

    input.value = query
    // The caret goes to the end, as it does in a shell: what someone wants next
    // is usually to add to the recalled query rather than edit its middle.
    input.setSelectionRange(query.length, query.length)

    this._setSearchQuery(query)
    this._refreshFind()
  }

  performReplace() {
    const view = this.tabEditorFacade.getActiveTabEditorView()
    if (!view || view.isBinary) return

    // Edits since the last search invalidate match positions;
    // re-locate instead of replacing a stale range.
    if (view.isSearchStateStale()) {
      this.tabEditorFacade.findNextMatch()
      return
    }

    const replaceInput = this.tabEditorFacade.replaceQuery

    const replaced = view.replaceCurrentMatch(replaceInput, this.tabEditorFacade.preserveCase)
    if (!replaced) return

    this.tabEditorFacade.findNextMatch()
  }

  performReplaceAll() {
    // Reachable via a global shortcut, so a closed box or a searchless
    // tab must not silently rewrite the document with a stale query.
    if (!this.tabEditorFacade.findReplaceOpen) return

    const view = this.tabEditorFacade.getActiveTabEditorView()
    if (!view || view.isBinary) return

    const findInput = this.tabEditorFacade.searchQuery
    const replaceInput = this.tabEditorFacade.replaceQuery

    const replacedCount = view.replaceAllMatches(
      findInput,
      replaceInput,
      this.tabEditorFacade.searchOptions,
      this.tabEditorFacade.preserveCase
    )

    // Match positions and the count label are invalid after the rewrite.
    this.tabEditorFacade.findNextMatch()

    this.tabEditorFacade.replaceInfo.textContent = replacedCount > 0 ? `${replacedCount} replaced` : ""
  }

  performCloseFindReplaceBox() {
    if (!this.tabEditorFacade.findReplaceOpen) return

    this.tabEditorFacade.findAndReplaceContainer.style.display = "none"

    // Whatever the box was closed on is worth remembering too — searching as you
    // type means a query often finds what it was after without ever being submitted.
    this.tabEditorFacade.searchHistory.record(this.tabEditorFacade.searchQuery)

    this.tabEditorFacade.clearAllSearches()
    this.tabEditorFacade.clearAllSearchRanges()
    this.tabEditorFacade.replaceInfo.textContent = ""

    this.tabEditorFacade.findReplaceOpen = false
    this.contextKeyService.set("findReplaceOpen", false)

    // Hand focus back so typing continues in the document instead of the input
    // that was just hidden. Closing the last tab also closes the box, and then
    // there is no view left to focus.
    this.tabEditorFacade.getActiveTabEditorView()?.focus()
  }

  //

  performFindOrReplaceByActiveElement(direction: "up" | "down" = "down") {
    const activateElement = document.activeElement

    if (activateElement === this.tabEditorFacade.findInput) {
      this.performFind(direction)
    } else if (activateElement === this.tabEditorFacade.replaceInput) {
      this.performReplace()
    }
  }

  //

  performApplySettings(viewModel: SettingsViewModel) {
    const editor = viewModel.settingEditorViewModel
    const theme = viewModel.settingThemeViewModel.theme

    editor.width && this.tabEditorFacade.changeEditorWidth(editor.width)
    editor.fontSize && this.tabEditorFacade.changeFontSize(editor.fontSize)
    editor.fontFamily && this.tabEditorFacade.changeFontFamily(editor.fontFamily)
    editor.autoSave && this.tabEditorFacade.setAutoSaveMode(editor.autoSave)

    if (theme) {
      const html = document.documentElement
      html.classList.remove("light", "solarized", "slate")
      html.classList.add(theme)
    }

    this.settingsFacade.applyChangeSet()
  }

  async performApplyAndSaveSettings(viewModel: SettingsViewModel) {
    this.performApplySettings(viewModel)
    const settingsDto = this.settingsFacade.toSettingsDto(this.settingsFacade.getDraftSettings())
    await window.rendererToMain.syncSettingsSessionFromRenderer(settingsDto)
  }
}
