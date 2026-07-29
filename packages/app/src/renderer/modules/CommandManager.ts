import { inject, injectable } from "inversify"

import type Response from "@shared/types/Response"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"

import type { ICommand } from "../commands/"
import type { SettingsViewModel } from "../viewmodels/SettingsViewModel"

import { DI, DOM } from "../constants"

import closedFolderSvg from "../assets/icons/closed_folder.svg?raw"
import openedFolderSvg from "../assets/icons/opened_folder.svg?raw"

import { CommandQueue, FocusManager } from "../core"
import { TabEditorFacade, TreeFacade, SettingsFacade } from "./index"
import { CreateCommand, DeleteCommand, PasteCommand, RenameCommand } from "../commands"

import { sleep } from "../utils/sleep"

@injectable()
export class CommandManager {
	private undoStack: ICommand[] = []
	private redoStack: ICommand[] = []

	constructor(
		@inject(DI.FocusManager) private readonly focusManager: FocusManager,
		@inject(DI.SettingsFacade) private readonly settingsFacade: SettingsFacade,
		@inject(DI.TabEditorFacade) private readonly tabEditorFacade: TabEditorFacade,
		@inject(DI.TreeFacade) private readonly treeFacade: TreeFacade,
		@inject(DI.CommandQueue) private readonly commandQueue: CommandQueue
	) {}

	// Convention: public perform* methods enqueue; private _do* bodies run inside
	// the queue and must only call other _do* helpers (an enqueue from inside a
	// queued task would deadlock the chain).

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
		const cmd = this.undoStack.pop()
		if (!cmd) return

		try {
			await this._withWatchSkip(() => cmd.undo())
			this.redoStack.push(cmd)
		} catch (err) {
			// Undo failed (e.g., parent copied into child, or src/dest no longer exists).
			// OS/File system may have ignored the operation; we just skip it to avoid breaking the stack.
			console.error("[CommandManager] undo(tree) failed:", err)
		}
	}

	performRedoEditor() {
		this.tabEditorFacade.redoEditor()
	}

	performRedoTree() {
		return this.commandQueue.enqueue(() => this._doRedoTree())
	}

	private async _doRedoTree() {
		const cmd = this.redoStack.pop()
		if (!cmd) return

		try {
			await this._withWatchSkip(() => cmd.execute())
			this.undoStack.push(cmd)
		} catch (err) {
			console.error("[CommandManager] redo(tree) failed:", err)
		}
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

		// Everything below indexes into the tree that is being replaced, so it has to
		// be dropped with it: stale wrappers, selection indices pointing past the end
		// of the new tree, and a clipboard naming paths from the old directory.
		this.treeFacade.clearPathToTreeWrapper() // Must clear map manually before render (no built-in clear).
		this.treeFacade.render(responseViewModel)

		this.treeFacade.removeLastSelectedIndex()
		this.treeFacade.clearSelectedIndices()
		this.treeFacade.clearClipboard()
		this.treeFacade.setRootTreeViewModel(responseViewModel)

		// Cleanup previous tabs.
		const tabEditorsDto = this.tabEditorFacade.getTabEditorsDto()
		const closeAllTabsResponse = await window.rendererToMain.closeAllTabs(tabEditorsDto)
		if (closeAllTabsResponse.result) this.tabEditorFacade.removeAllTabs(closeAllTabsResponse.data)
	}

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

	performOpenFileOrDirectoryByLastSelectedIndex() {
		return this.commandQueue.enqueue(() => this._doOpenFileOrDirectoryByLastSelectedIndex())
	}

	private async _doOpenFileOrDirectoryByLastSelectedIndex() {
		const idx = Math.max(this.treeFacade.lastSelectedIndex, 0)
		const viewModel = this.treeFacade.getTreeViewModelByIndex(idx)
		if (!viewModel) return

		if (viewModel.directory) {
			const treeNode = this.treeFacade.getTreeNodeByIndex(idx)
			await this._doOpenDirectoryByTreeNode(treeNode)
		} else {
			await this._doOpenFile(viewModel.path)
		}

		// Re-focus the tree node to reclaim focus lost to the editor during the opening process.
		const treeNode = this.treeFacade.getTreeNodeByIndex(idx)
		treeNode.focus()
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
			const cmd = await this._executeCreation(viewModel.path, name, isDirectory)
			const filePath = cmd.getCreatedPath()

			if (filePath) {
				this._selectTreeNodeAfterCreate(filePath)
				if (!isDirectory) await this._openTabEditorAfterCreate(filePath, cmd)
			}
		})
	}

	private async _resolveParentDirectory() {
		let idx = Math.max(this.treeFacade.lastSelectedIndex, 0)
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

	private async _executeCreation(parentPath: string, name: string, isDirectory: boolean) {
		const cmd = new CreateCommand(this.treeFacade, this.tabEditorFacade, parentPath, name, isDirectory)

		try {
			await this._withWatchSkip(() => cmd.execute())
			this.undoStack.push(cmd)
			this.redoStack.length = 0
		} catch (error) {
			console.error("[CommandManager] create failed:", error)
		}

		return cmd
	}

	private _selectTreeNodeAfterCreate(filePath: string) {
		this.treeFacade.clearTreeSelected()
		const idx = this.treeFacade.getFlattenIndexByPath(filePath)
		if (idx === undefined) return
		this.treeFacade.addSelectedIndices(idx)
		this.treeFacade.lastSelectedIndex = idx
		const node = this.treeFacade.getTreeNodeByIndex(idx)
		node.classList.add(DOM.CLASS_FOCUSED, DOM.CLASS_SELECTED)
	}

	private async _openTabEditorAfterCreate(filePath: string, cmd: CreateCommand) {
		await this._doOpenFile(filePath)
		this.focusManager.setFocusedTask("editor")
		const tabView = this.tabEditorFacade.getTabEditorViewByPath(filePath)
		if (tabView) cmd.setOpenedTabId(tabView.getId())
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
			this._restoreTreeSpan(treeNode, newPath)
			return
		}

		await this.commandQueue.enqueue(() => this._executeRename(treeNode, isDirectory, oldPath, newPath))
	}

	private _resolveRenameTarget() {
		const treeNode = this.treeFacade.getTreeNodeByIndex(this.treeFacade.lastSelectedIndex)
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

	private async _executeRename(treeNode: HTMLElement, isDirectory: boolean, prePath: string, newPath: string) {
		const cmd = new RenameCommand(this.treeFacade, this.tabEditorFacade, treeNode, isDirectory, prePath, newPath)

		try {
			await this._withWatchSkip(() => cmd.execute())
			this.undoStack.push(cmd)
			this.redoStack.length = 0
		} catch (error) {
			console.error("[CommandManager] rename failed:", error)
			this._restoreTreeSpan(treeNode, prePath)
		}
	}

	private _restoreTreeSpan(treeNode: HTMLElement, path: string) {
		const treeNodeInput = treeNode.querySelector(`.${DOM.CLASS_TREE_NODE_INPUT}`) as HTMLElement
		const restoreSpan = document.createElement("span")
		restoreSpan.classList.add(DOM.CLASS_TREE_NODE_TEXT, "ellipsis")
		restoreSpan.textContent = window.utils.getBaseName(path)
		treeNode.replaceChild(restoreSpan, treeNodeInput)
	}

	//

	performDelete() {
		return this.commandQueue.enqueue(() => this._doDelete())
	}

	private async _doDelete() {
		// Capture paths, not indices: the command re-resolves them at apply time,
		// so overlapping/stale requests can never delete the wrong nodes.
		const selectedPaths: string[] = []
		for (const idx of this.treeFacade.getSelectedIndices()) {
			const viewModel = this.treeFacade.getTreeViewModelByIndex(idx)
			if (viewModel) selectedPaths.push(viewModel.path)
		}
		if (selectedPaths.length === 0) return

		const cmd = new DeleteCommand(this.treeFacade, this.tabEditorFacade, selectedPaths)

		try {
			await this._withWatchSkip(() => cmd.execute())
			this.undoStack.push(cmd)
			this.redoStack.length = 0
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
		this.treeFacade.clearClipboardPaths()
		this.treeFacade.clipboardMode = "cut"

		for (const idx of this.treeFacade.getSelectedIndices()) {
			this.treeFacade.getTreeWrapperByIndex(idx).classList.add(DOM.CLASS_CUT)
			this.treeFacade.addClipboardPaths(this.treeFacade.getTreeViewModelByIndex(idx).path)
		}
	}

	async performCopyEditor() {
		const sel = window.getSelection()
		const selectedText = window.getSelection()?.toString()
		if (!sel || !selectedText) return

		await window.rendererToMain.copyEditor(selectedText)
	}

	/** Roots only, for the same reason as {@link performCutTree}. */
	performCopyTree() {
		this.treeFacade.clearClipboardPaths()
		this.treeFacade.clipboardMode = "copy"

		for (const idx of this.treeFacade.getSelectedIndices()) {
			this.treeFacade.addClipboardPaths(this.treeFacade.getTreeViewModelByIndex(idx).path)
		}
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
		await this._enqueuePasteTree(this.treeFacade.lastSelectedIndex)
	}

	async performPasteTreeWithDrag() {
		await this._enqueuePasteTree(this.treeFacade.selectedDragIndex)
	}

	private _enqueuePasteTree(targetIndex: number): Promise<void> {
		if (targetIndex === -1) return Promise.resolve()

		// Capture the target as a path: the index may shift before the queued task runs.
		const targetViewModel = this.treeFacade.getTreeViewModelByIndex(targetIndex)
		if (!targetViewModel) return Promise.resolve()

		return this.commandQueue.enqueue(() => this._doPasteTree(targetViewModel.path))
	}

	private async _doPasteTree(targetPath: string) {
		let targetIndex = this.treeFacade.getFlattenIndexByPath(targetPath)
		if (targetIndex === undefined) return

		let targetViewModel = this.treeFacade.getTreeViewModelByIndex(targetIndex)

		const clipboardPaths = this.treeFacade.getClipboardPaths() ?? []
		const isPastingOnSelf = clipboardPaths.includes(targetViewModel.path)

		if (!targetViewModel.directory || isPastingOnSelf) {
			targetIndex = this.treeFacade.findParentDirectoryIndex(targetIndex)
			targetViewModel = this.treeFacade.getTreeViewModelByIndex(targetIndex)
		}

		const selectedViewModels = []
		for (const path of clipboardPaths) {
			const viewModel = this.treeFacade.getTreeViewModelByPath(path)
			if (viewModel) selectedViewModels.push(viewModel)
		}
		if (selectedViewModels.length === 0) return

		const clipboardMode = this.treeFacade.clipboardMode
		const cmd = new PasteCommand(
			this.treeFacade,
			this.tabEditorFacade,
			targetViewModel,
			selectedViewModels,
			clipboardMode
		)

		try {
			await this._withWatchSkip(() => cmd.execute())
			this.undoStack.push(cmd)
			this.redoStack.length = 0

			// A cut is consumed by its paste. Without this the sources keep their
			// greyed-out cut styling forever and the mode never leaves "cut", so
			// Paste stays enabled pointing at nodes that have already moved.
			// Copy keeps its clipboard so it can be pasted repeatedly.
			if (clipboardMode === "cut") this.treeFacade.clearClipboard()
		} catch (error) {
			console.error("[CommandManager] paste failed:", error)
		}
	}

	//

	toggleFindReplaceBox(showReplace: boolean) {
		const activeView = this.tabEditorFacade.getActiveTabEditorView()
		if (!activeView || activeView.isBinary) return

		// Seed the query from the editor selection, like most editors do.
		const selectedText = activeView.getSelectedText()
		if (selectedText && !selectedText.includes("\n")) {
			this.tabEditorFacade.searchQuery = selectedText
			this.tabEditorFacade.findInput.value = selectedText
		}

		this.tabEditorFacade.findAndReplaceContainer.style.display = "flex"
		this.tabEditorFacade.replaceBox.style.display = showReplace ? "flex" : "none"
		this.tabEditorFacade.findReplaceOpen = true
		this.tabEditorFacade.replaceInfo.textContent = ""

		if (showReplace) this.tabEditorFacade.replaceInput.select()
		else this.tabEditorFacade.findInput.select()

		// Anchor the session where the caret is, so typing the query searches
		// outwards from the reading position rather than from the last match.
		activeView.captureSearchAnchor()
		this._refreshFind()
	}

	performSearchQueryChanged(query: string) {
		this.tabEditorFacade.searchQuery = query
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

	performToggleSearchOption(option: "matchCase" | "wholeWord" | "useRegex") {
		const enabled = this.tabEditorFacade.toggleSearchOption(option)

		const buttons = {
			matchCase: this.tabEditorFacade.findOptionCase,
			wholeWord: this.tabEditorFacade.findOptionWord,
			useRegex: this.tabEditorFacade.findOptionRegex,
		}
		buttons[option].classList.toggle(DOM.CLASS_SELECTED, enabled)

		// Match lists computed with the previous options are meaningless now.
		this.tabEditorFacade.clearAllSearches()
		this._refreshFind()
	}

	performFind(direction: "up" | "down") {
		this.tabEditorFacade.findNextMatch(direction)
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

		const replaced = view.replaceCurrentMatch(replaceInput)
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

		const replacedCount = view.replaceAllMatches(findInput, replaceInput, this.tabEditorFacade.searchOptions)

		// Match positions and the count label are invalid after the rewrite.
		this.tabEditorFacade.findNextMatch()

		this.tabEditorFacade.replaceInfo.textContent = replacedCount > 0 ? `${replacedCount} replaced` : ""
	}

	performCloseFindReplaceBox() {
		if (!this.tabEditorFacade.findReplaceOpen) return

		this.tabEditorFacade.findAndReplaceContainer.style.display = "none"

		this.tabEditorFacade.clearAllSearches()
		this.tabEditorFacade.replaceInfo.textContent = ""

		this.tabEditorFacade.findReplaceOpen = false

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
