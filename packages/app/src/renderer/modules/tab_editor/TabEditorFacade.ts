import "@milkdown/theme-nord/style.css"
import type Response from "@shared/types/Response"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TabEditorViewModel } from "../../viewmodels/TabEditorViewModel"

import { inject, injectable } from "inversify"

import { DATASET_ATTR_TAB_ID, EXIT_TEXT } from "../../constants/dom"
import { TabEditorRenderer } from "./TabEditorRenderer"
import { TabEditorStore } from "./TabEditorStore"
import { TabEditorView } from "./TabEditorView"
import type { SearchOptions } from "./search"
import { TabDragManager } from "./TabDragManager"
import { CommandQueue, ContextKeyService } from "@renderer/core"
import { adjustMenuPosition, assert } from "@renderer/utils"
import { DI, DOM } from "@renderer/constants"

import { BINARY_FILE_WARNING } from "./messages"

export { BINARY_FILE_WARNING }

const AUTO_SAVE_DELAY_MS = 1000

@injectable()
export class TabEditorFacade {
  private _autoSaveTimer: ReturnType<typeof setTimeout> | null = null

  constructor(
    @inject(DI.TabEditorStore) public readonly store: TabEditorStore,
    @inject(DI.TabEditorRenderer) public readonly renderer: TabEditorRenderer,
    @inject(DI.TabDragManager) public readonly drag: TabDragManager,
    @inject(DI.ContextKeyService) private readonly contextKeyService: ContextKeyService,
    @inject(DI.CommandQueue) private readonly commandQueue: CommandQueue
  ) {
    this.renderer.setAutoSaveNotifier((kind) => this._handleAutoSaveEvent(kind))
    this.renderer.setEditNotifier((view) => this._refreshSearchAfterEdit(view))
  }

  //

  // store

  toTabEditorViewModel(dto: TabEditorDto): TabEditorViewModel {
    return this.store.toTabEditorViewModel(dto)
  }

  //

  get activeTabId() {
    return this.store.activeTabId
  }

  // Every path that changes which tab is active goes through here, so this is
  // where "is there an editor at all" is announced. -1 is the explicit sentinel
  // for none, set when the last tab closes.
  set activeTabId(id: number) {
    this.store.activeTabId = id
    this.contextKeyService.set("hasActiveEditor", id !== -1)
  }

  get activeTabIndex() {
    return this.store.activeTabIndex
  }

  set activeTabIndex(index: number) {
    this.store.activeTabIndex = index
  }

  get contextTabId() {
    return this.store.contextTabId
  }

  set contextTabId(id: number) {
    this.store.contextTabId = id
  }

  removeContextTabId() {
    this.store.removeContextTabId()
  }

  //

  getTabEditorViewModelById(id: number) {
    return this.store.getTabEditorViewModelById(id)
  }

  setTabEditorViewModelById(id: number, viewModel: TabEditorViewModel) {
    this.store.setTabEditorViewModelById(id, viewModel)
  }

  //

  get findReplaceOpen() {
    return this.store.findReplaceOpen
  }

  set findReplaceOpen(open: boolean) {
    this.store.findReplaceOpen = open
  }

  get findDirection() {
    return this.store.findDirection
  }

  set findDirection(direction: "up" | "down") {
    this.store.findDirection = direction
  }

  get searchQuery() {
    return this.store.searchQuery
  }

  set searchQuery(query: string) {
    this.store.searchQuery = query
  }

  get replaceQuery() {
    return this.store.replaceQuery
  }

  set replaceQuery(query: string) {
    this.store.replaceQuery = query
  }

  get searchOptions(): SearchOptions {
    return this.store.searchOptions
  }

  toggleSearchOption(option: keyof SearchOptions): boolean {
    const options = this.store.searchOptions
    options[option] = !options[option]
    return options[option]
  }

  get searchHistory() {
    return this.store.searchHistory
  }

  get preserveCase() {
    return this.store.preserveCase
  }

  togglePreserveCase(): boolean {
    this.store.preserveCase = !this.store.preserveCase
    return this.store.preserveCase
  }

  // renderer

  getTabEditorViewByIndex(index: number) {
    return this.renderer.getTabEditorViewByIndex(index)
  }

  getTabEditorViewIndexById(id: number) {
    return this.renderer.getTabEditorViewIndexById(id)
  }

  //

  getTabEditorViewByPath(path: string) {
    return this.renderer.getTabEditorViewByPath(path)
  }

  setTabEditorViewByPath(path: string, tabEditorVeiw: TabEditorView) {
    this.renderer.setTabEditorViewByPath(path, tabEditorVeiw)
  }

  deleteTabEditorViewByPath(path: string) {
    this.renderer.deleteTabEditorViewByPath(path)
  }

  //

  undoEditor() {
    const activeTabIndex = this.store.activeTabIndex
    this.renderer.undoEditor(activeTabIndex)
  }

  redoEditor() {
    const activeTabIndex = this.store.activeTabIndex
    this.renderer.redoEditor(activeTabIndex)
  }

  paste(text: string) {
    const activeTabIndex = this.store.activeTabIndex
    this.renderer.pasteInEditor(activeTabIndex, text)
  }

  //

  moveTabEditorViewAndUpdateActiveIndex(fromIndex: number, toIndex: number): void {
    if (fromIndex === toIndex) return

    this.renderer.moveTabEditorView(fromIndex, toIndex)

    if (this.store.activeTabIndex === fromIndex) {
      this.store.activeTabIndex = toIndex
    } else if (fromIndex < this.store.activeTabIndex && toIndex >= this.store.activeTabIndex) {
      this.store.activeTabIndex--
    } else if (fromIndex > this.store.activeTabIndex && toIndex <= this.store.activeTabIndex) {
      this.store.activeTabIndex++
    }
  }

  //

  createGhostTab(fileName: string) {
    return this.renderer.createGhostTab(fileName)
  }

  removeGhostTab() {
    this.renderer.removeGhostTab()
  }

  createIndicator() {
    return this.renderer.createIndicator()
  }

  removeIndicator() {
    this.renderer.removeIndicator()
  }

  //

  changeFontSize(size: number) {
    this.renderer.changeFontSize(size)
  }

  changeFontFamily(family: string) {
    this.renderer.changeFontFamily(family)
  }

  changeEditorWidth(width: number) {
    this.renderer.changeEditorWidth(width)
  }

  //

  get findAndReplaceContainer() {
    return this.renderer.findAndReplaceContainer
  }

  get findBox() {
    return this.renderer.findBox
  }

  get replaceBox() {
    return this.renderer.replaceBox
  }

  get findInput() {
    return this.renderer.findInput
  }

  get replaceInput() {
    return this.renderer.replaceInput
  }

  get findInfo() {
    return this.renderer.findInfo
  }

  get replaceInfo() {
    return this.renderer.replaceInfo
  }

  get findReplaceToggle() {
    return this.renderer.findReplaceToggle
  }

  /**
   * Shows or hides the replace row. Both opening the widget with replace and
   * the chevron come through here, so the chevron cannot end up pointing the
   * wrong way at a row it did not open.
   */
  setReplaceRowVisible(visible: boolean) {
    this.replaceBox.style.display = visible ? "flex" : "none"
    this.findReplaceToggle.classList.toggle(DOM.CLASS_EXPANDED, visible)
  }

  isReplaceRowVisible(): boolean {
    return this.replaceBox.style.display !== "none"
  }

  get findOptionCase() {
    return this.renderer.findOptionCase
  }

  get findOptionWord() {
    return this.renderer.findOptionWord
  }

  get findOptionPreserveCase() {
    return this.renderer.findOptionPreserveCase
  }

  get findOptionSelection() {
    return this.renderer.findOptionSelection
  }

  // drag

  isDrag(): boolean {
    return this.drag.isDrag()
  }

  startDrag() {
    this.drag.startDrag()
  }

  endDrag() {
    this.drag.endDrag()
  }

  //

  getStartPosition() {
    return this.drag.getStartPosition()
  }

  setStartPosition(x: number, y: number) {
    this.drag.setStartPosition(x, y)
  }

  getStartPosition_x() {
    return this.drag.getStartPosition_x()
  }

  getStartPosition_y() {
    return this.drag.getStartPosition_y()
  }

  //

  isMouseDown(): boolean {
    return this.drag.isMouseDown()
  }

  setMouseDown(state: boolean) {
    this.drag.setMouseDown(state)
  }

  //

  getTabs() {
    return this.drag.getTabs()
  }

  setTabs(tabs: HTMLElement[]) {
    this.drag.setTabs(tabs)
  }

  //

  getTargetTab() {
    return this.drag.getTargetTab()
  }

  setTargetTab(tab: HTMLElement) {
    return this.drag.setTargetTab(tab)
  }

  getTargetTabId() {
    return this.drag.getTargetTabId()
  }

  setTargetTabId(id: number) {
    this.drag.setTargetTabId(id)
  }

  //

  getTargetTabName() {
    return this.drag.getTargetTabName()
  }

  setTargetTabName(name: string) {
    this.drag.setTargetTabName(name)
  }

  //

  getInsertIndex(): number {
    return this.drag.getInsertIndex()
  }

  setInsertIndex(index: number) {
    this.drag.setInsertIndex(index)
  }

  // orchestra - drag

  initDrag(target: HTMLElement, x: number, y: number) {
    const tabsSnapshot = Array.from(this.renderer.elements.tabContainer.children) as HTMLElement[]
    const id = parseInt(target.dataset[DATASET_ATTR_TAB_ID]!)
    const name = this.getTabEditorViewModelById(id)!.fileName

    this.setTabs(tabsSnapshot)
    this.setMouseDown(true)
    this.setTargetTab(target)
    this.setStartPosition(x, y)
    this.setTargetTabId(id)
    this.setTargetTabName(name)
  }

  moveGhostTab(x: number, y: number) {
    const ghost = this.createGhostTab(this.getTargetTabName())

    ghost.style.left = `${x + 5}px`
    ghost.style.top = `${y + 5}px`
  }

  getInsertIndexFromMouseX(mouseX: number): number {
    const tabs = this.getTabs()
    assert(tabs, "Can not call getInsertIndexFromMouseX() before initDrag()")

    const strTargetTabId = String(this.getTargetTabId())

    let visualIndex = 0

    for (let i = 0; i < tabs.length; i++) {
      const tab = tabs[i]
      if (tab.dataset.id === strTargetTabId) continue

      const rect = tab.getBoundingClientRect()
      const middleX = rect.left + rect.width / 2

      if (mouseX < middleX) {
        return visualIndex
      }

      visualIndex++
    }

    return visualIndex
    // return tabs.length
  }

  updateDragIndicator(insertIndex: number) {
    const indicator = this.createIndicator()
    const { tabContainer } = this.renderer.elements
    const containerRect = tabContainer.getBoundingClientRect()

    const targetTab = this.getTabEditorViewByIndex(insertIndex)
    let leftPosition = 0

    if (targetTab) {
      const tabRect = targetTab.tabBox.getBoundingClientRect()
      leftPosition = tabRect.left - containerRect.left + tabContainer.scrollLeft
    } else {
      const lastTab = this.getTabEditorViewByIndex(insertIndex - 1)
      if (lastTab) {
        const lastRect = lastTab.tabBox.getBoundingClientRect()
        leftPosition = lastRect.right - containerRect.left + tabContainer.scrollLeft
      } else {
        leftPosition = 0
      }
    }

    indicator.style.left = `${leftPosition}px`

    if (!tabContainer.contains(indicator)) {
      tabContainer.appendChild(indicator)
    }
  }

  clearDrag() {
    this.endDrag()
    this.removeGhostTab()
    this.removeIndicator()
  }

  // orchestra

  handleShowContextmenu(e: MouseEvent) {
    const tab = (e.target as HTMLElement).closest(DOM.SELECTOR_TAB) as HTMLElement
    if (!tab) return

    const { tabContextMenu } = this.renderer.elements

    tabContextMenu.classList.add(DOM.CLASS_SELECTED)
    adjustMenuPosition(e, tabContextMenu)

    this.contextTabId = parseInt(tab.dataset[DOM.DATASET_ATTR_TAB_ID]!)
  }

  /** Hides the menu, and only that — same reasoning as the tree's. */
  handleHideContextmenu() {
    this.renderer.elements.tabContextMenu.classList.remove(DOM.CLASS_SELECTED)
  }

  //

  getActiveTabEditorView(): TabEditorView {
    const activeIndex = this.activeTabIndex
    return this.getTabEditorViewByIndex(activeIndex)
  }

  //

  async loadTabs(dto: TabEditorsDto) {
    const activatedId = dto.activatedId
    const tabs = dto.data

    // Set before the tabs exist, because addTab reads it to decide which one to
    // activate; the activation itself assigns it again.
    this.activeTabId = activatedId

    for (let i = 0; i < tabs.length; i++) {
      await this.addTab(
        tabs[i].id,
        tabs[i].filePath,
        tabs[i].fileName,
        tabs[i].content,
        tabs[i].isBinary,
        tabs[i].id === activatedId,
        tabs[i].isModified
      )
    }
  }

  async syncTabs(dto: TabEditorsDto) {
    const activatedId = dto.activatedId
    const tabs = dto.data

    this.activeTabId = activatedId

    const map: Map<number, TabEditorDto> = new Map()
    for (const tab of tabs) {
      map.set(tab.id, tab)
    }

    for (const view of this.renderer.tabEditorViews) {
      const id = view.getId()
      const dto = map.get(id)

      if (dto) {
        const viewModel = this.store.getTabEditorViewModelById(id)!
        if (dto.filePath !== viewModel.filePath) {
          viewModel.filePath = dto.filePath
          viewModel.fileName = dto.fileName
          view.tabSpan.title = dto.filePath
          view.tabSpan.textContent = dto.fileName || view.getEditorFirstLine()
        }
      } else {
        this.removeTab(id)
        this.store.deleteTabEditorViewModelById(id)
      }
    }
  }

  async addTab(
    id = 0,
    filePath = "",
    fileName = "",
    content = "",
    isBinary = false,
    activate = true,
    isModified = false
  ) {
    const vm: TabEditorViewModel = {
      id: id,
      isModified: isModified,
      isBinary: isBinary,
      filePath: filePath,
      fileName: fileName,
      initialContent: content,
    }

    this.store.setTabEditorViewModelById(id, vm)
    await this.renderer.createTabAndEditor(vm)

    if (activate) {
      const previousTab = this.renderer.tabEditorViews[this.store.activeTabIndex]
      previousTab?.setDeactive()
      // Same invariant as activateTabEditorById: the highlights belong to the
      // search being shown, not to the tab it last ran in.
      if (previousTab && !previousTab.isBinary) previousTab.clearSearch()

      this.activeTabIndex = this.renderer.tabEditorViews.length - 1
      this.activeTabId = id

      const newActiveTabEditorView = this.renderer.tabEditorViews[this.store.activeTabIndex]
      newActiveTabEditorView.setActive()
      this._processFindAndSelect(newActiveTabEditorView)
    }
  }

  applySaveResult(dto: TabEditorDto) {
    for (let i = 0; i < this.renderer.tabEditorViews.length; i++) {
      const vm = this.getTabEditorViewModelById(this.renderer.tabEditorViews[i].getId())!

      if ((vm.id === dto.id || vm.filePath === dto.filePath) && dto.isModified === false) {
        const tv = this.renderer.tabEditorViews[i]

        vm.initialContent = dto.content

        tv.setSuppressInputEvent(true)
        const selection = tv.getSelection()

        // Prevents cursor jumping and content normalization issues after save.
        // tv.setContent(dto.content);

        tv.setSelection(selection)
        tv.setSuppressInputEvent(false)

        tv.setTabSpanTextContent(dto.fileName)
        tv.setTabButtonTextContent(EXIT_TEXT)
        tv.tabBox.classList.remove(DOM.CLASS_IS_MODIFIED)

        vm.isModified = false
        vm.filePath = dto.filePath
        vm.fileName = dto.fileName
      }
    }
  }

  applySaveAllResults(tabEditorsDto: TabEditorsDto) {
    tabEditorsDto.data.forEach((dto) => {
      this.applySaveResult(dto)
    })
  }

  // auto save

  setAutoSaveMode(mode: string) {
    this.store.autoSaveMode = mode
    if (mode !== "afterDelay") this._clearAutoSaveTimer()
  }

  notifyWindowBlurForAutoSave() {
    const mode = this.store.autoSaveMode
    if (mode === "onFocusChange" || mode === "onWindowChange") {
      this._runAutoSave()
    }
  }

  private _handleAutoSaveEvent(kind: "input" | "blur") {
    const mode = this.store.autoSaveMode

    if (kind === "input" && mode === "afterDelay") {
      this._clearAutoSaveTimer()
      this._autoSaveTimer = setTimeout(() => {
        this._autoSaveTimer = null
        this._runAutoSave()
      }, AUTO_SAVE_DELAY_MS)
    } else if (kind === "blur" && mode === "onFocusChange") {
      this._runAutoSave()
    }
  }

  private _clearAutoSaveTimer() {
    if (this._autoSaveTimer !== null) {
      clearTimeout(this._autoSaveTimer)
      this._autoSaveTimer = null
    }
  }

  // On the queue with closes and watcher sync: the loop awaits IPC per tab,
  // and outside the queue a close landing in that gap could splice the view
  // array out from under the iteration. Every trigger (timer, blur, window
  // blur) arrives from outside the queue, so enqueueing here cannot deadlock.
  private _runAutoSave() {
    return this.commandQueue.enqueue(() => this._doRunAutoSave())
  }

  private async _doRunAutoSave() {
    // Untitled and binary tabs are skipped: saving an untitled tab opens a
    // dialog, which auto save must never do.
    for (const view of this.renderer.tabEditorViews) {
      const dto = this._getTabEditorDtoByView(view)
      if (!dto.isModified || !dto.filePath || dto.isBinary) continue

      const response: Response<TabEditorDto> = await window.rendererToMain.save(dto)
      if (response.result && !response.data.isModified) this.applySaveResult(response.data)
    }
  }

  private _removeTabAt(index: number) {
    const view = this.renderer.getTabEditorViewByIndex(index)
    const id = view.getId()
    const viewModel = this.store.getTabEditorViewModelById(id)!

    this.renderer.deleteTabEditorViewByPath(viewModel.filePath)
    this.store.deleteTabEditorViewModelById(id)

    this.renderer.removeTabAndEditor(index)
  }

  private _syncTabAt(index: number) {
    const views = this.renderer.tabEditorViews

    if (views.length > 0 && index >= 0) {
      const safeIndex = Math.min(index, views.length - 1)
      const view = views[safeIndex]

      this.activeTabIndex = safeIndex
      this.activeTabId = view.getId()
      view.setActive()
      this._processFindAndSelect(view)
    } else {
      this.activeTabIndex = -1
      this.activeTabId = -1
    }
  }

  removeTab(id: number) {
    const views = this.renderer.tabEditorViews
    const index = views.findIndex((view) => view.getId() === id)
    // Commands and watcher sync are serialized, so a missing id is an
    // internal bug — surface it in dev, tolerate it in production.
    assert(index !== -1, `removeTab: no tab with id ${id}`)
    if (index === -1) return
    const isAffected = this.store.activeTabIndex >= index

    this._removeTabAt(index)
    if (isAffected) this._syncTabAt(this.store.activeTabIndex - 1)
  }

  removeTabsExcept(results: boolean[]) {
    for (let i = this.renderer.tabEditorViews.length - 1; i >= 0; i--) {
      if (results[i]) this._removeTabAt(i)
    }

    const idx = this.renderer.tabEditorViews.findIndex((view) => view.getId() === this.activeTabId)
    if (idx === -1) this._syncTabAt(this.renderer.tabEditorViews.length - 1)
    else this.activeTabIndex = idx
  }

  removeTabsToRight(results: boolean[]) {
    for (let i = this.renderer.tabEditorViews.length - 1; i >= 0; i--) {
      if (results[i]) this._removeTabAt(i)
    }

    const idx = this.renderer.tabEditorViews.findIndex((view) => view.getId() === this.activeTabId)
    if (idx === -1) this._syncTabAt(this.renderer.tabEditorViews.length - 1)
    else this.activeTabIndex = idx
  }

  removeAllTabs(results: boolean[]) {
    for (let i = this.renderer.tabEditorViews.length - 1; i >= 0; i--) {
      if (results[i]) this._removeTabAt(i)
    }

    const idx = this.renderer.tabEditorViews.findIndex((view) => view.getId() === this.activeTabId)
    if (idx === -1) this._syncTabAt(this.renderer.tabEditorViews.length - 1)
    else this.activeTabIndex = idx
  }

  //

  async renameDirectory(prePath: string, newPath: string) {
    for (const [filePath, view] of this.renderer.pathToTabEditorViewMap.entries()) {
      const relative = window.utils.getRelativePath(prePath, filePath)
      if (relative === "" || (!relative.startsWith("..") && !window.utils.isAbsolute(relative))) {
        const newFilePath = window.utils.getJoinedPath(newPath, relative)
        const preData = this._getTabEditorDtoByView(view)
        const newData = { ...preData, filePath: newFilePath }
        const viewModel = this.toTabEditorViewModel(newData)

        this.store.setTabEditorViewModelById(viewModel.id, viewModel)
        this.renderer.deleteTabEditorViewByPath(filePath)
        this.renderer.setTabEditorViewByPath(newFilePath, view)

        view.tabSpan.title = viewModel.filePath
      }
    }

    const tabEditorsDto = this.getTabEditorsDto()
    await window.rendererToMain.syncTabSessionFromRenderer(tabEditorsDto)
  }

  async renameFile(prePath: string, newPath: string) {
    const view = this.getTabEditorViewByPath(prePath)!
    const viewModel = this.getTabEditorViewModelById(view.getId())!
    viewModel.filePath = newPath
    viewModel.fileName = window.utils.getBaseName(newPath)

    this.renderer.deleteTabEditorViewByPath(prePath)
    this.renderer.setTabEditorViewByPath(viewModel.filePath, view)

    view.tabSpan.title = viewModel.filePath
    view.tabSpan.textContent = viewModel.fileName ? viewModel.fileName : "Untitled"

    const tabEditorsDto = this.getTabEditorsDto()
    await window.rendererToMain.syncTabSessionFromRenderer(tabEditorsDto)
  }

  //

  activateTabEditorById(id: number) {
    const targetIndex = this.getTabEditorViewIndexById(id)
    const activatedIndex = this.activeTabIndex

    const views = this.renderer.tabEditorViews
    const activatedTab = views[activatedIndex]
    const targetTab = views[targetIndex]

    activatedTab.setDeactive()
    targetTab.setActive()

    // The highlights belong to the search being shown, not to whichever tab the
    // query last ran in. Leaving them behind meant coming back to a tab still
    // marked up for a query that had since changed or been cleared.
    if (!activatedTab.isBinary && activatedTab !== targetTab) activatedTab.clearSearch()

    this.activeTabId = id
    this.activeTabIndex = targetIndex

    this._processFindAndSelect(targetTab)
  }

  //

  private _getTabEditorDtoByView(view: TabEditorView): TabEditorDto {
    const id = view.getId()
    const vm = this.getTabEditorViewModelById(id)!

    return {
      id: vm.id,
      isModified: vm.isModified,
      filePath: vm.filePath,
      fileName: vm.fileName || view.getEditorFirstLine(),
      content: vm.isBinary ? BINARY_FILE_WARNING : view.getContent(),
      isBinary: vm.isBinary,
    }
  }

  getTabEditorDtoById(id: number): TabEditorDto {
    const viewModel = this.store.getTabEditorViewModelById(id)!
    const view = this.renderer.getTabEditorViewByPath(viewModel.filePath)!
    return this._getTabEditorDtoByView(view)
  }

  getActiveTabEditorDto(): TabEditorDto {
    const activeIndex = this.store.activeTabIndex
    const view = this.renderer.getTabEditorViewByIndex(activeIndex)
    return this._getTabEditorDtoByView(view)
  }

  getTabEditorsDto(): TabEditorsDto {
    return {
      activatedId: this.store.activeTabId,
      data: this.renderer.tabEditorViews.map((view: TabEditorView) => this._getTabEditorDtoByView(view)),
    }
  }

  //

  /**
   * "advance" steps to the next match from the caret and is what the arrows and
   * Enter do; "refine" re-runs a query that is still being typed from the search
   * anchor, so editing it does not walk through the document.
   */
  findNextMatch(direction: "up" | "down" = this.findDirection, mode: "advance" | "refine" = "advance") {
    const tabEditorView = this.getActiveTabEditorView()
    // Binary tabs have no editor to search in; a missing view means no tab is open.
    if (!tabEditorView || tabEditorView.isBinary) {
      this.findInfo.textContent = `No results`
      return
    }

    const searchText = this.searchQuery

    if (!searchText) {
      tabEditorView.clearSearch()
      this.findInfo.textContent = `No results`
      return
    }

    const targetIndex =
      mode === "refine"
        ? tabEditorView.searchFromAnchor(searchText, this.searchOptions)
        : tabEditorView.searchNextMatch(searchText, direction, this.searchOptions)
    const matchesCount = tabEditorView.searchState?.matches.length || 0

    if (targetIndex !== -1 && matchesCount > 0) {
      this.findInfo.textContent = `${targetIndex + 1} of ${matchesCount}`
    } else {
      this.findInfo.textContent = `No results`
    }

    this.findDirection = direction
  }

  /**
   * Brings a view's highlights and the counter up to date with the query.
   *
   * Deliberately not a step to the next match: the caret is already on the
   * current one, so advancing from it walks one match further every time — which
   * is what made the count alternate as tabs were switched back and forth.
   */
  private _syncSearchTo(view: TabEditorView) {
    if (!this.findReplaceOpen) return
    // The range belongs to the document now under the widget, not to the query.
    this.syncFindInSelectionButton()

    if (view.isBinary) return

    // An emptied query only cleared the tab it was emptied in; a tab arriving
    // with highlights from before the clearing has to give them up here.
    if (!this.searchQuery) {
      view.clearSearch()
      this.findInfo.textContent = `No results`
      return
    }

    const count = view.refreshMatches(this.searchQuery, this.searchOptions)
    const state = view.searchState

    this.findInfo.textContent = count > 0 && state ? `${state.currentIndex + 1} of ${count}` : `No results`
  }

  /**
   * Keeps the match list and the counter describing the document as it is being
   * typed in, rather than the one the last search ran against.
   *
   * Deferred, because this arrives from inside the editor's own
   * dispatchTransaction: dispatching another transaction there updates the state
   * without repainting, so the count moved while the highlights did not.
   */
  private _refreshSearchAfterEdit(view: TabEditorView) {
    if (!this.searchQuery) return

    queueMicrotask(() => {
      // Re-checked on the way out: the tab may have been closed or switched
      // away from while this was waiting.
      if (view !== this.getActiveTabEditorView()) return

      // F3 paints highlights with the box closed, and with it closed nothing
      // will keep them describing the document; better gone than drifting
      // onto text that no longer matches.
      if (!this.findReplaceOpen) {
        view.clearSearch()
        return
      }

      this._syncSearchTo(view)
    })
  }

  clearAllSearches() {
    for (const view of this.renderer.tabEditorViews) {
      if (!view.isBinary) view.clearSearch()
    }
  }

  /** Closing the widget also gives up where each document was being searched. */
  clearAllSearchRanges() {
    for (const view of this.renderer.tabEditorViews) {
      if (!view.isBinary) view.clearSearchRange()
    }
    this.syncFindInSelectionButton()
  }

  /**
   * Paints the Find in Selection button from the active view.
   *
   * Unlike the other three options this state belongs to one document — the
   * range is a stretch of it — so the button has to be told when the tab under
   * it changes.
   */
  syncFindInSelectionButton() {
    const view = this.getActiveTabEditorView()
    const usable = !!view && !view.isBinary

    // Greyed the way every other unavailable action in the app is: nothing was
    // selected when the widget opened, so there is no range to confine anything to.
    this.renderer.findOptionSelection.classList.toggle(DOM.CLASS_SELECTED, usable && view.searchInRange)
    this.renderer.findOptionSelection.classList.toggle(DOM.CLASS_DEACTIVE, !(usable && view.hasSearchRange()))
  }

  private _processFindAndSelect(view: TabEditorView) {
    if (view.isBinary) {
      if (this.findReplaceOpen) this.findInfo.textContent = `No results`
      return
    }

    this._syncSearchTo(view)
  }
}
