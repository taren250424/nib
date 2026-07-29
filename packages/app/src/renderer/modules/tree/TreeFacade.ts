import type ClipboardMode from "@shared/types/ClipboardMode"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TreeViewModel } from "../../viewmodels/TreeViewModel"

import { inject, injectable } from "inversify"
import { DI, DOM } from "../../constants"
import { TreeRenderer } from "./TreeRenderer"
import { TreeStore } from "./TreeStore"
import { TreeDragManager } from "./TreeDragManager"
import { CLASS_SELECTED } from "@renderer/constants/dom"
import { ContextKeyService } from "@renderer/core"
import { adjustMenuPosition, assert } from "@renderer/utils"

@injectable()
export class TreeFacade {
	constructor(
		@inject(DI.TreeStore) public readonly store: TreeStore,
		@inject(DI.TreeRenderer) public readonly renderer: TreeRenderer,
		@inject(DI.TreeDragManager) public readonly drag: TreeDragManager,
		@inject(DI.ContextKeyService) private readonly contextKeyService: ContextKeyService
	) {}

	// store

	toTreeDto(viewModel: TreeViewModel): TreeDto {
		return this.store.toTreeDto(viewModel)
	}

	toTreeViewModel(dto: TreeDto): TreeViewModel {
		return this.store.toTreeViewModel(dto)
	}

	//

	getRootTreeViewModel(): TreeViewModel {
		return this.store.getRootTreeViewModel()
	}

	// NOTE: Full rebuild — only use for initial load or directory switch.
	// For incremental changes (create/delete/paste), use applyCreate/applyDelete/applyPaste.
	setRootTreeViewModel(root: TreeViewModel) {
		this.store.setRootTreeViewModel(root)
	}

	syncPathToFlattenTreeIndex() {
		this.store.syncPathToFlattenTreeIndex()
	}

	updatePathToFlattenTreeIndex(startIndex: number) {
		this.store.updatePathToFlattenTreeIndex(startIndex)
	}

	//

	toFlatList(tree: TreeViewModel) {
		return this.store.toFlatList(tree)
	}

	findParentDirectoryIndex(index: number) {
		return this.store.findParentDirectoryIndex(index)
	}

	//

	insertChildNodes(node: TreeViewModel) {
		this.store.insertChildNodes(node)
	}

	removeChildNodes(node: TreeViewModel) {
		this.store.removeChildNodes(node)
	}

	//

	get flattenTree(): readonly TreeViewModel[] {
		return this.store.flattenTree
	}

	set flattenTree(arr: TreeViewModel[]) {
		this.store.flattenTree = arr
	}

	spliceFlattenTree(start: number, length: number) {
		this.store.spliceFlattenTree(start, length)
	}

	//

	getTreeViewModelByIndex(index: number) {
		return this.store.getTreeViewModelByIndex(index)
	}

	getTreeViewModelByPath(path: string) {
		return this.store.getTreeViewModelByPath(path)
	}

	//

	getFlattenIndexByPath(path: string) {
		return this.store.getFlattenIndexByPath(path)
	}

	setFlattenIndexByPath(path: string, index: number) {
		this.store.setFlattenIndexByPath(path, index)
	}

	deleteFlattenIndexByPath(path: string) {
		this.store.deleteFlattenIndexByPath(path)
	}

	//

	get lastSelectedIndex() {
		return this.store.lastSelectedIndex
	}

	set lastSelectedIndex(index: number) {
		// -1 is the explicit "no selection" sentinel. Any other index must be live:
		// commands and watcher sync are serialized, so a dead index here is an
		// internal bug — surface it in dev, tolerate it in production.
		const viewModel = this.store.flattenTree[index]
		assert(index === -1 || viewModel, `lastSelectedIndex: dead index ${index}`)
		if (viewModel) {
			const wrapper = this.getTreeWrapperByPath(viewModel.path)
			const treeNode = wrapper?.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement | null
			treeNode?.focus()
		}
		this.store.lastSelectedIndex = viewModel ? index : -1
	}

	removeLastSelectedIndex() {
		this.store.lastSelectedIndex = -1
	}

	setLastSelectedIndexByPath(path: string) {
		const idx = this.store.getFlattenIndexByPath(path)
		this.lastSelectedIndex = idx !== undefined ? idx : -1
	}

	//

	get contextTreeIndex() {
		return this.store.contextTreeIndex
	}

	set contextTreeIndex(index: number) {
		this.store.contextTreeIndex = index
	}

	removeContextTreeIndex() {
		this.store.removeContextTreeIndex()
	}

	setContextTreeIndexByPath(path: string) {
		this.store.contextTreeIndex = this.store.getFlattenIndexByPath(path)!
	}

	//

	get selectedDragIndex() {
		return this.store.selectedDragIndex
	}

	set selectedDragIndex(index: number) {
		this.store.selectedDragIndex = index
	}

	setSelectedDragIndexByPath(path: string) {
		this.store.selectedDragIndex = this.store.getFlattenIndexByPath(path)!
	}

	//

	addSelectedIndices(index: number) {
		this.store.addSelectedIndices(index)
	}

	getSelectedIndices(): number[] {
		return this.store.getSelectedIndices()
	}

	clearSelectedIndices() {
		this.store.clearSelectedIndices()
	}

	//

	get clipboardMode() {
		return this.store.clipboardMode
	}

	set clipboardMode(mode: ClipboardMode) {
		this.store.clipboardMode = mode
	}

	addClipboardPaths(path: string) {
		this.store.addClipboardPaths(path)
		this._publishClipboardContext()
	}

	getClipboardPaths(): string[] {
		return this.store.getClipboardPaths()
	}

	clearClipboardPaths() {
		const paths = this.store.getClipboardPaths()
		for (const path of paths) {
			const wrapper = this.getTreeWrapperByPath(path)
			wrapper?.classList.remove(DOM.CLASS_CUT)
		}

		this.store.clearClipboardPaths()
		this._publishClipboardContext()
	}

	/** Drops the clipboard entirely: pending paths, their cut styling, and the mode. */
	clearClipboard() {
		this.clearClipboardPaths()
		this.store.clipboardMode = "none"
	}

	// Both mutators funnel through here, so whether there is anything to paste is
	// announced from the same place it changes.
	private _publishClipboardContext() {
		this.contextKeyService.set("treeHasClipboard", this.store.getClipboardPaths().length > 0)
	}

	// renderer

	// NOTE: Full rebuild — only use for initial load or directory switch.
	// For incremental changes, use applyCreate/applyDelete/applyPaste.
	render(viewModel: TreeViewModel, container?: HTMLElement) {
		this.renderer.render(viewModel, container)
	}

	//

	createInput(directory: boolean, indent: number) {
		return this.renderer.createInput(directory, indent)
	}

	createGhost(count: number) {
		return this.renderer.createGhost(count)
	}

	removeGhost() {
		this.renderer.removeGhost()
	}

	//

	clearPathToTreeWrapper() {
		this.renderer.clearPathToTreeWrapper()
	}

	getTreeNodeByPath(path: string) {
		return this.renderer.getTreeNodeByPath(path)
	}

	getTreeWrapperByPath(path: string) {
		return this.renderer.getTreeWrapperByPath(path)
	}

	setTreeWrapperByPath(path: string, wrapper: HTMLElement) {
		this.renderer.setTreeWrapperByPath(path, wrapper)
	}

	deleteTreeWrapperByPath(path: string) {
		this.renderer.deleteTreeWrapperByPath(path)
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

	getDragTreeCount() {
		return this.drag.getDragTreeCount()
	}

	setDragTreeCount(count: number) {
		this.drag.setDragTreeCount(count)
	}

	//

	getInsertWrapper() {
		return this.drag.getInsertWrapper()
	}

	setInsertWrapper(wrapper: HTMLElement | null) {
		this.drag.setInsertWrapper(wrapper)
	}

	getInsertPath() {
		return this.drag.getInsertPath()
	}

	setInsertPath(path: string) {
		this.drag.setInsertPath(path)
	}

	// orchestra - drag

	initDrag(count: number, x: number, y: number) {
		this.setMouseDown(true)
		this.setDragTreeCount(count)
		this.setStartPosition(x, y)
	}

	moveGhost(x: number, y: number) {
		const ghost = this.createGhost(this.getDragTreeCount())
		ghost.style.left = `${x + 5}px`
		ghost.style.top = `${y + 5}px`
	}

	updateDragOverStatus(target: HTMLElement) {
		const previousWrapper = this.getInsertWrapper()

		let currentWrapper = (target.closest(DOM.SELECTOR_TREE_NODE_WRAPPER) ||
			target.closest(DOM.SELECTOR_TREE_NODE_CONTAINER)) as HTMLElement

		if (!currentWrapper) {
			this.clearDrag()
			return
		}

		const isInitialContainer = currentWrapper.matches(DOM.SELECTOR_TREE_NODE_CONTAINER)
		const initialPath = isInitialContainer
			? currentWrapper.dataset[DOM.DATASET_ATTR_TREE_PATH]!
			: (currentWrapper.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement).dataset[DOM.DATASET_ATTR_TREE_PATH]!

		let targetViewModel = this.getTreeViewModelByPath(initialPath)
		if (!targetViewModel) {
			this.clearDrag()
			return
		}

		if (!targetViewModel.directory) {
			const currentIndex = this.getFlattenIndexByPath(initialPath)!
			const parentIndex = this.findParentDirectoryIndex(currentIndex)

			targetViewModel = this.flattenTree[parentIndex]!
			currentWrapper = this.getTreeWrapperByPath(targetViewModel.path)!
		}

		if (previousWrapper === currentWrapper) return
		if (previousWrapper) previousWrapper.classList.remove(DOM.CLASS_TREE_DRAG_OVERLAY)

		const finalPath = targetViewModel.path

		this.setInsertPath(finalPath)
		this.setInsertWrapper(currentWrapper)
		currentWrapper.classList.add(DOM.CLASS_TREE_DRAG_OVERLAY)
	}

	clearDrag() {
		this.endDrag()
		this.removeGhost()
	}

	// orchestra

	getTreeWrapperByIndex(index: number) {
		const viewModel = this.store.getTreeViewModelByIndex(index)
		return this.renderer.getTreeWrapperByPath(viewModel.path)
	}

	getTreeNodeByIndex(index: number) {
		const wrapper = this.getTreeWrapperByIndex(index)!
		return wrapper.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement
	}

	//

	handleShowContextmenu(e: MouseEvent) {
		const treeNode = (e.target as HTMLElement).closest(DOM.SELECTOR_TREE_NODE) as HTMLElement
		if (!treeNode) return

		treeNode.classList.add(DOM.CLASS_FOCUSED)

		const path = treeNode.dataset[DOM.DATASET_ATTR_TREE_PATH]!
		this.setContextTreeIndexByPath(path)

		const { treeContextMenu, treeContextPaste } = this.renderer.elements

		// What paste consumes is the clipboard, not the current selection: cutting and
		// then clicking elsewhere used to grey the item out with a full clipboard. The
		// target need not be a directory either — paste redirects to the parent folder.
		const isPasteDisabled = this.getClipboardPaths().length === 0

		treeContextPaste.classList.toggle(DOM.CLASS_DEACTIVE, isPasteDisabled)
		treeContextMenu.classList.add(DOM.CLASS_SELECTED)
		adjustMenuPosition(e, treeContextMenu)
	}

	handleHideContextmenu() {
		if (this.contextTreeIndex !== -1) {
			this.contextTreeIndex = -1
			this.renderer.elements.treeContextMenu.classList.remove(CLASS_SELECTED)
		}
	}

	blur(index: number) {
		if (index === -1) return

		if (index === 0) {
			this.renderer.elements.treeNodeContainer.classList.remove(DOM.CLASS_FOCUSED)
		} else {
			const node = this.getTreeNodeByIndex(index)
			node.classList.remove(DOM.CLASS_FOCUSED)
		}
	}

	clearTreeSelected() {
		const selectedIndices = this.getSelectedIndices()
		// Clear state first so a dead index can't survive in the set. Serialized
		// mutations mean dead indices here are internal bugs — assert in dev,
		// tolerate in production.
		this.clearSelectedIndices()
		for (const i of selectedIndices) {
			const viewModel = this.store.flattenTree[i]
			assert(viewModel, `clearTreeSelected: dead index ${i}`)
			if (!viewModel) continue
			const wrapper = this.getTreeWrapperByPath(viewModel.path)
			const node = wrapper?.querySelector(DOM.SELECTOR_TREE_NODE)
			node?.classList.remove(DOM.CLASS_SELECTED)
		}
	}

	//

	async applyRename(preBase: string, newBase: string) {
		const start = this.getFlattenIndexByPath(preBase)!

		for (let i = start; i < this.flattenTree.length; i++) {
			const vm = this.getTreeViewModelByIndex(i)

			if (vm.path.startsWith(preBase)) {
				const oldPath = vm.path

				const idx = this.getFlattenIndexByPath(oldPath)!
				const wrapper = this.getTreeWrapperByPath(oldPath)!
				const node = this.getTreeNodeByPath(oldPath)

				this.deleteFlattenIndexByPath(oldPath)
				this.deleteTreeWrapperByPath(oldPath)

				const relative = window.utils.getRelativePath(preBase, oldPath)
				const newPath = window.utils.getJoinedPath(newBase, relative)

				vm.path = newPath
				vm.name = window.utils.getBaseName(newPath)

				this.setFlattenIndexByPath(newPath, idx)
				this.setTreeWrapperByPath(newPath, wrapper)
				node.dataset[DOM.DATASET_ATTR_TREE_PATH] = newPath
				node.title = newPath
			} else {
				break
			}
		}
	}

	// Snapshot selection state as paths so it can be re-resolved after the
	// flattenTree indices shift. Selection correction lives here (inside apply*),
	// never in callers.
	private _captureSelectionPaths() {
		const selected: string[] = []
		for (const i of this.getSelectedIndices()) {
			const viewModel = this.store.flattenTree[i]
			if (viewModel) selected.push(viewModel.path)
		}

		return {
			selected,
			last: this.store.flattenTree[this.store.lastSelectedIndex]?.path ?? null,
			context: this.store.flattenTree[this.store.contextTreeIndex]?.path ?? null,
		}
	}

	private _restoreSelectionPaths(snapshot: { selected: string[]; last: string | null; context: string | null }) {
		this.clearSelectedIndices()
		for (const path of snapshot.selected) {
			const idx = this.getFlattenIndexByPath(path)
			if (idx !== undefined) this.addSelectedIndices(idx)
		}

		// Assign via store to avoid the facade setter's focus side effect.
		const lastIdx = snapshot.last !== null ? this.getFlattenIndexByPath(snapshot.last) : undefined
		this.store.lastSelectedIndex = lastIdx !== undefined ? lastIdx : -1

		const contextIdx = snapshot.context !== null ? this.getFlattenIndexByPath(snapshot.context) : undefined
		this.store.contextTreeIndex = contextIdx !== undefined ? contextIdx : -1
	}

	applyDelete(indices: number[]) {
		indices = indices.filter((i) => this.store.flattenTree[i] !== undefined)
		if (indices.length === 0) return

		indices.sort((a, b) => b - a)
		const minIndex = indices[indices.length - 1]

		const selectionSnapshot = this._captureSelectionPaths()

		for (const index of indices) {
			const target = this.store.flattenTree[index]
			const baseIndent = target.indent

			let parentIndex = -1
			for (let i = index - 1; i >= 0; i--) {
				if (this.store.flattenTree[i].indent === baseIndent - 1) {
					parentIndex = i
					break
				}
			}

			const toDelete: TreeViewModel[] = []

			// Collects the deletion target: Self + all children
			for (let i = index; i < this.store.flattenTree.length; i++) {
				const node = this.getTreeViewModelByIndex(i)
				if (i !== index && node.indent <= baseIndent) break
				toDelete.push(node)
				this.deleteFlattenIndexByPath(node.path)
			}

			if (parentIndex >= 0) {
				const parent = this.flattenTree[parentIndex]
				if (parent.children) {
					parent.children = parent.children.filter(
						(child: any) => child.path !== target.path
					)
				}
			}

			for (const node of toDelete) {
				const path = node.path
				const wrapper = this.getTreeWrapperByPath(path)
				
				wrapper?.remove()

				this.deleteTreeWrapperByPath(path)
			}

			this.spliceFlattenTree(index, toDelete.length)
		}

		this.updatePathToFlattenTreeIndex(minIndex)
		this._restoreSelectionPaths(selectionSnapshot)
	}

	applyCreate(parentPath: string, createdPath: string, isDirectory: boolean) {
		const parent = this.getTreeViewModelByPath(parentPath)
		// Parent may be unknown to the tree (e.g. watcher event under a directory
		// that was never loaded) — nothing to update.
		if (!parent) return
		// Already present (e.g. watcher echo of our own create) — skip duplicates.
		if (parent.children?.some((child) => child.path === createdPath)) return

		const name = window.utils.getBaseName(createdPath)

		const newNode: TreeViewModel = {
			path: createdPath,
			name,
			indent: parent.indent + 1,
			directory: isDirectory,
			expanded: false,
			children: isDirectory ? [] : null,
			selected: false,
		}

		// Insert into parent.children at sorted position
		if (!parent.children) parent.children = []
		const childInsertIdx = this.store.findSortedChildInsertIndex(parent, name, isDirectory)
		parent.children.splice(childInsertIdx, 0, newNode)

		// If parent is not expanded, only update the model (DOM stays collapsed)
		if (!parent.expanded) return

		// Calculate flattenTree insert position
		const parentFlatIdx = this.getFlattenIndexByPath(parentPath)!
		let flatInsertIdx: number
		if (childInsertIdx === 0) {
			flatInsertIdx = parentFlatIdx + 1
		} else {
			const prevSibling = parent.children[childInsertIdx - 1]
			const prevSiblingFlatIdx = this.getFlattenIndexByPath(prevSibling.path)!
			const prevSubtreeSize = this.store.getSubtreeSize(prevSiblingFlatIdx)
			flatInsertIdx = prevSiblingFlatIdx + prevSubtreeSize
		}

		// Insert into flattenTree (selection indices at/after the insert point shift by one)
		const selectionSnapshot = this._captureSelectionPaths()
		this.store.insertIntoFlattenTree(flatInsertIdx, [newNode])
		this._restoreSelectionPaths(selectionSnapshot)

		// Insert into DOM
		const container = this.getChildrenContainer(parentPath)
		const nextSibling = childInsertIdx < parent.children.length - 1
			? parent.children[childInsertIdx + 1]
			: null
		const beforeElement = nextSibling ? this.getTreeWrapperByPath(nextSibling.path) : null

		this.renderer.renderSingleNode(newNode, container, beforeElement)
	}

	applyPaste(parentPath: string, newPaths: string[], isDirectories: boolean[]) {
		for (let i = 0; i < newPaths.length; i++) {
			this.applyCreate(parentPath, newPaths[i], isDirectories[i])
		}
	}

	private getChildrenContainer(parentPath: string): HTMLElement {
		const parentFlatIdx = this.getFlattenIndexByPath(parentPath)!
		const wrapper = this.getTreeWrapperByPath(parentPath)!

		// Root: wrapper IS the container (simpleBar content element)
		if (parentFlatIdx === 0) return wrapper

		// Non-root: children container is nested inside wrapper
		return wrapper.querySelector(DOM.SELECTOR_TREE_NODE_CHILDREN) as HTMLElement
	}
}
