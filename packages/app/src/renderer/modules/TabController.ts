import { inject, injectable } from "inversify"

import type Response from "@shared/types/Response"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"

import { DI } from "../constants"

import { CommandQueue } from "../core"
// Straight from the files, not from ./index: the barrel exports this class too,
// so importing through it would have the module depend on itself. The value form
// is needed here rather than `import type` because emitDecoratorMetadata writes
// these into the constructor's design:paramtypes.
import { TabEditorFacade } from "./tab_editor/TabEditorFacade"
import { FindReplaceController } from "./tab_editor/FindReplaceController"
import { TreeFacade } from "./tree/TreeFacade"
import { TreeHistory } from "./tree/TreeHistory"

/**
 * Tab and editor commands: opening, closing and saving tabs, and the editor
 * clipboard — the destination of the `tab.*`, `file.*` and `editor.*` ids.
 *
 * TreeFacade and TreeHistory are here for one command: opening a directory
 * replaces the tree, so everything naming the outgoing one — selection,
 * clipboard, history — has to be dropped alongside the tabs.
 */
@injectable()
export class TabController {
  constructor(
    @inject(DI.TabEditorFacade) private readonly tabEditorFacade: TabEditorFacade,
    @inject(DI.FindReplaceController) private readonly findReplaceController: FindReplaceController,
    @inject(DI.TreeFacade) private readonly treeFacade: TreeFacade,
    @inject(DI.TreeHistory) private readonly treeHistory: TreeHistory,
    @inject(DI.CommandQueue) private readonly commandQueue: CommandQueue
  ) {}

  // Convention: public perform* methods enqueue; private _do* bodies run inside
  // the queue and must only call other _do* helpers (an enqueue from inside a
  // queued task would deadlock the chain).

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

  /**
   * Queue-internal doorway for TreeController, whose tree commands open files
   * within their own queued task (a create opens its file, Enter on a row opens
   * it). Runs the body directly, so it may only be called from inside a task
   * already on the queue — enqueueing here would deadlock the chain.
   */
  openFileInsideQueue(filePath?: string) {
    return this._doOpenFile(filePath)
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
      console.error("[TabController] openFile failed:", error)
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
    // one. (The wrapper map is cleared by the full render itself.) The history
    // stacks go too — an undo kept alive across the switch would edit the old
    // directory on disk while the new tree shows none of it.
    this.treeFacade.clearSelection()
    this.treeFacade.clearClipboard()
    this.treeHistory.clear()

    this.treeFacade.render(responseViewModel)
    this.treeFacade.setRootTreeViewModel(responseViewModel)

    // Cleanup previous tabs.
    const tabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const closeAllTabsResponse = await window.rendererToMain.closeAllTabs(tabEditorsDto)
    if (closeAllTabsResponse.result) this.tabEditorFacade.removeAllTabs(closeAllTabsResponse.data)

    // The find widget names documents of the directory being left, like the
    // selection and the clipboard above.
    if (this.tabEditorFacade.activeTabId === -1) this.findReplaceController.performCloseFindReplaceBox()
  }

  //

  // Saving is capture -> await -> apply over the same tabs the queue
  // serializes everything else for; run outside it, a close or watcher sync
  // landing during the IPC wait would apply the result to different tabs
  // than were captured.

  performSave() {
    return this.commandQueue.enqueue(() => this._doSave())
  }

  private async _doSave() {
    const dto = this.tabEditorFacade.getActiveTabEditorDto()
    if (!dto.isModified) return
    const response: Response<TabEditorDto> = await window.rendererToMain.save(dto)
    if (response.result && !response.data.isModified) this.tabEditorFacade.applySaveResult(response.data)
  }

  performSaveAs() {
    return this.commandQueue.enqueue(() => this._doSaveAs())
  }

  private async _doSaveAs() {
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

  performSaveAll() {
    return this.commandQueue.enqueue(() => this._doSaveAll())
  }

  private async _doSaveAll() {
    const tabEditorsDto: TabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
    const response: Response<TabEditorsDto> = await window.rendererToMain.saveAll(tabEditorsDto)
    if (response.result) this.tabEditorFacade.applySaveAllResults(response.data)
  }

  //

  performCloseActiveTab() {
    return this.performCloseTab(this.tabEditorFacade.activeTabId)
  }

  performCloseContextTab() {
    return this.performCloseTab(this.tabEditorFacade.contextTabId)
  }

  performCloseTab(id: number) {
    return this.commandQueue.enqueue(() => this._doCloseTab(id))
  }

  private async _doCloseTab(id: number) {
    const dto = this.tabEditorFacade.getTabEditorDtoById(id)
    if (!dto) return
    const response: Response<void> = await window.rendererToMain.closeTab(dto)
    if (response.result) this.tabEditorFacade.removeTab(dto.id)
    if (this.tabEditorFacade.activeTabId === -1) this.findReplaceController.performCloseFindReplaceBox()
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

    // Same rule as closing the last tab one by one: a find widget with no
    // document under it searches nothing and swallows Esc.
    if (this.tabEditorFacade.activeTabId === -1) this.findReplaceController.performCloseFindReplaceBox()
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

  async performCopyEditor() {
    const sel = window.getSelection()
    const selectedText = window.getSelection()?.toString()
    if (!sel || !selectedText) return

    await window.rendererToMain.copyEditor(selectedText)
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
}
