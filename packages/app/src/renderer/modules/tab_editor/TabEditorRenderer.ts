import type { TabEditorViewModel } from "@renderer/viewmodels/TabEditorViewModel"

import { inject, injectable } from "inversify"
import { Editor, editorViewCtx, parserCtx, rootCtx } from "@milkdown/kit/core"
import { history } from "@milkdown/kit/plugin/history"
import { commonmark } from "@milkdown/kit/preset/commonmark"
import { nord } from "@milkdown/theme-nord"
import "@milkdown/theme-nord/style.css"
import { TabEditorView } from "./TabEditorView"
import { BINARY_FILE_WARNING } from "./TabEditorFacade"
import { DI, DOM } from "@renderer/constants"
import type { TabEditorElements } from "./TabEditorElements"
import { throttle } from "../../utils/throttle"

@injectable()
export class TabEditorRenderer {
  private _tabEditorViews: TabEditorView[] = []
  private _pathToTabEditorViewMap: Map<string, TabEditorView> = new Map()

  private _ghostTab: HTMLElement | null = null
  private _indicator: HTMLElement | null = null
  private _autoSaveNotifier: (kind: "input" | "blur") => void = () => {
    /* no-op until the facade registers its notifier */
  }
  private _editNotifier: (view: TabEditorView) => void = () => {
    /* no-op until the facade registers its notifier */
  }
  private _throttledTempSave = throttle(async (view: TabEditorView, vm: TabEditorViewModel) => {
    await window.rendererToMain.tempSave({
      id: vm.id,
      isModified: vm.isModified,
      filePath: vm.filePath,
      fileName: vm.fileName,
      content: view.getContent(),
      isBinary: vm.isBinary,
    })
  }, 1500)

  constructor(@inject(DI.TabEditorElements) readonly elements: TabEditorElements) {}

  setAutoSaveNotifier(notifier: (kind: "input" | "blur") => void) {
    this._autoSaveNotifier = notifier
  }

  /** Told which view changed, so anything describing the document can catch up. */
  setEditNotifier(notifier: (view: TabEditorView) => void) {
    this._editNotifier = notifier
  }

  private _createTabEl(id: string, filePath: string, fileName: string) {
    const tabBox = document.createElement("div")
    tabBox.classList.add(DOM.CLASS_TAB)
    tabBox.dataset[DOM.DATASET_ATTR_TAB_ID] = id.toString()

    const tabSpan = document.createElement("span")
    tabSpan.title = filePath || ""
    tabSpan.textContent = fileName || "Untitled"

    const tabButton = document.createElement("button")
    tabButton.textContent = DOM.EXIT_TEXT
    tabButton.addEventListener("mouseenter", () => {
      if (tabBox.classList.contains(DOM.CLASS_IS_MODIFIED)) {
        tabButton.textContent = DOM.EXIT_TEXT
      }
    })

    tabButton.addEventListener("mouseleave", () => {
      if (tabBox.classList.contains(DOM.CLASS_IS_MODIFIED)) {
        tabButton.textContent = DOM.MODIFIED_TEXT
      }
    })

    tabBox.appendChild(tabSpan)
    tabBox.appendChild(tabButton)

    return { tabBox, tabSpan, tabButton }
  }

  private async _createEditorEl(isBinary: boolean, initialContent: string) {
    const editorBox = document.createElement("div")
    editorBox.className = DOM.CLASS_EDITOR_BOX

    let editor = null

    if (isBinary) {
      editorBox.innerText = BINARY_FILE_WARNING
      editorBox.classList.add(DOM.CLASS_BINARY)
    } else {
      editor = await Editor.make()
        .config((ctx) => {
          ctx.set(rootCtx, editorBox)
          nord(ctx)
        })
        .use(commonmark)
        .use(history)
        .create()
      editor.action((ctx) => {
        const parser = ctx.get(parserCtx)
        const view = ctx.get(editorViewCtx)
        const doc = parser(initialContent)

        // Apply initial content without pushing it to the undo stack.
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content).setMeta("addToHistory", false)

        view.dispatch(tr)
      })
    }

    return { editorBox, editor }
  }

  private _handleEditorInput(view: TabEditorView, vm: TabEditorViewModel) {
    const current = view.getContent()
    const isModified = current !== vm.initialContent

    if (isModified) {
      this._throttledTempSave(view, vm)
    }

    if (isModified && !vm.isModified) {
      vm.isModified = true
      view.setTabButtonTextContent(DOM.MODIFIED_TEXT)
      view.tabBox.classList.add(DOM.CLASS_IS_MODIFIED)
    } else if (!isModified && vm.isModified) {
      vm.isModified = false
      view.setTabButtonTextContent(DOM.EXIT_TEXT)
      view.tabBox.classList.remove(DOM.CLASS_IS_MODIFIED)

      this._throttledTempSave(view, vm)
    }

    this._editNotifier(view)
    this._autoSaveNotifier("input")
  }

  private _handleEditorBlur(view: TabEditorView, vm: TabEditorViewModel) {
    if (!vm.filePath && vm.isModified) {
      const firstLine = view.getEditorFirstLine()
      view.setTabSpanTextContent(firstLine || "Untitled")
    }

    this._autoSaveNotifier("blur")
  }

  async createTabAndEditor(viewModel: TabEditorViewModel) {
    const { id, isModified, isBinary, filePath, fileName, initialContent } = viewModel

    const { tabBox, tabSpan, tabButton } = this._createTabEl(String(id), filePath, fileName)
    const { editorBox, editor } = await this._createEditorEl(isBinary, initialContent)

    if (isModified) {
      tabButton.textContent = DOM.MODIFIED_TEXT
      tabBox.classList.add(DOM.CLASS_IS_MODIFIED)
    }

    this.elements.tabContainer.appendChild(tabBox)
    this.elements.editorContainer.appendChild(editorBox)

    const tabEditorView = new TabEditorView(
      tabBox,
      tabSpan,
      tabButton,
      editorBox,
      editor,
      isBinary,
      (view) => this._handleEditorInput(view, viewModel),
      (view) => this._handleEditorBlur(view, viewModel)
    )

    this._tabEditorViews.push(tabEditorView)
    this.setTabEditorViewByPath(filePath, tabEditorView)
  }

  removeTabAndEditor(index: number) {
    const [view] = this._tabEditorViews.splice(index, 1)
    view.destroy()
  }

  //

  get tabEditorViews(): readonly TabEditorView[] {
    return this._tabEditorViews
  }

  getTabEditorViewByIndex(index: number) {
    return this._tabEditorViews[index]
  }

  getTabEditorViewIndexById(id: number) {
    return this._tabEditorViews.findIndex((v) => v.getId() === id)
  }

  //

  get pathToTabEditorViewMap(): ReadonlyMap<string, TabEditorView> {
    return this._pathToTabEditorViewMap
  }

  getTabEditorViewByPath(path: string) {
    return this._pathToTabEditorViewMap.get(path)!
  }

  setTabEditorViewByPath(path: string, tabEditorVeiw: TabEditorView) {
    this._pathToTabEditorViewMap.set(path, tabEditorVeiw)
  }

  deleteTabEditorViewByPath(path: string) {
    this._pathToTabEditorViewMap.delete(path)
  }

  //

  undoEditor(index: number) {
    const view = this._tabEditorViews[index]
    view.undoEditor()
  }

  redoEditor(index: number) {
    const view = this._tabEditorViews[index]
    view.redoEditor()
  }

  pasteInEditor(index: number, text: string) {
    const view = this._tabEditorViews[index]
    view.pasteInEditor(text)
  }

  //

  moveTabEditorView(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return

    const adjustedToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex

    const [view] = this._tabEditorViews.splice(fromIndex, 1)
    this._tabEditorViews.splice(toIndex, 0, view)

    const container = this.elements.tabContainer
    const refNode = container.children[adjustedToIndex > fromIndex ? adjustedToIndex + 1 : adjustedToIndex]
    container.insertBefore(view.tabBox, refNode || null)
  }

  //

  private _createGhostTabEl(fileName: string) {
    const div = document.createElement("div")
    div.classList.add(DOM.CLASS_TAB)
    div.classList.add(DOM.CLASS_TAB_GHOST)

    const span = document.createElement("span")
    span.textContent = fileName ? fileName : "Untitled"

    const button = document.createElement("button")
    button.textContent = DOM.EXIT_TEXT

    div.appendChild(span)
    div.appendChild(button)

    return div
  }

  createGhostTab(fileName: string) {
    if (this._ghostTab) return this._ghostTab
    const ghostTab = this._createGhostTabEl(fileName)
    this._ghostTab = ghostTab
    document.body.appendChild(ghostTab)
    return ghostTab
  }

  removeGhostTab() {
    if (this._ghostTab) {
      this._ghostTab.remove()
      this._ghostTab = null
    }
  }

  createIndicator() {
    if (this._indicator) return this._indicator
    const _indicator = document.createElement("div")
    _indicator.className = "tab-indicator"
    this._indicator = _indicator
    return this._indicator
  }

  removeIndicator() {
    if (this._indicator) {
      this._indicator.remove()
      this._indicator = null
    }
  }

  //

  // The find widget lives inside the editor container, so it inherits all of
  // this rather than needing its own copy.
  changeFontSize(baseSize: number) {
    const container = this.elements.editorContainer
    const setVar = (name: string, value: string) => container.style.setProperty(name, value)

    const scale = {
      spacing: 0.25,
      radiusLg: 0.5,
      sm: 0.875,
      base: 1.0,
      xl: 1.25,
      xl_2: 1.5,
      xl_3: 1.875,
    }

    // Font sizes
    setVar("--text-sm", `${baseSize * scale.sm}px`)
    setVar("--text-base", `${baseSize * scale.base}px`)
    setVar("--text-xl", `${baseSize * scale.xl}px`)
    setVar("--text-2xl", `${baseSize * scale.xl_2}px`)
    setVar("--text-3xl", `${baseSize * scale.xl_3}px`)

    // Line heights
    setVar("--text-sm-line-height", (1.25 / 0.875).toString())
    setVar("--text-base-line-height", "1.5")
    setVar("--text-xl-line-height", (1.75 / 1.25).toString())
    setVar("--text-2xl-line-height", (2 / 1.5).toString())
    setVar("--text-3xl-line-height", (2.25 / 0.875).toString())

    // Etc
    setVar("--spacing", `${baseSize * scale.spacing}px`)
    setVar("--radius-lg", `${baseSize * scale.radiusLg}px`)
  }

  changeFontFamily(family: string) {
    this.elements.editorContainer.style.fontFamily = family
  }

  changeEditorWidth(width: number) {
    this.elements.editorContainer.style.setProperty("--editor-width", `${width}px`)
  }

  //

  get findAndReplaceContainer() {
    return this.elements.findAndReplaceContainer
  }

  get findBox() {
    return this.elements.findBox
  }

  get replaceBox() {
    return this.elements.replaceBox
  }

  get findInput() {
    return this.elements.findInput
  }

  get replaceInput() {
    return this.elements.replaceInput
  }

  get findInfo() {
    return this.elements.findInfo
  }

  get replaceInfo() {
    return this.elements.replaceInfo
  }

  get findOptionCase() {
    return this.elements.findOptionCase
  }

  get findOptionWord() {
    return this.elements.findOptionWord
  }

  get findOptionRegex() {
    return this.elements.findOptionRegex
  }

  get findReplaceToggle() {
    return this.elements.findReplaceToggle
  }
}
