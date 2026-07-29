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
import { adjustMenuPosition } from "@renderer/utils"

@injectable()
export class TreeFacade {
  constructor(
    @inject(DI.TreeStore) public readonly store: TreeStore,
    @inject(DI.TreeRenderer) public readonly renderer: TreeRenderer,
    @inject(DI.TreeDragManager) public readonly drag: TreeDragManager,
    @inject(DI.ContextKeyService) private readonly contextKeyService: ContextKeyService
  ) {
    // Whether this selection is the one being acted on is the same question the
    // commands answer with focusedTask, so the dimming reads it from there
    // rather than from :focus-within — the two disagree while the context menu
    // holds focus, and the selection is still the menu's target then.
    this.contextKeyService.onDidChange((changed) => {
      if (changed.has("focusedTask")) this._syncActiveClass()
    })
  }

  private _syncActiveClass() {
    const active = this.contextKeyService.get("focusedTask") === "tree"
    this.renderer.elements.treeNodeContainer.classList.toggle(DOM.CLASS_TREE_ACTIVE, active)
  }

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
    this.renderer.syncNodeExpanded(node.path, true)
  }

  removeChildNodes(node: TreeViewModel) {
    // Collapsing hides rows that may be selected. Leaving them selected would
    // point the next delete or cut at nodes the user can no longer see, so the
    // selection retreats to the directory that swallowed them.
    const removedPaths = this.store.removeChildNodes(node)
    let focusSwallowed = false

    for (const path of removedPaths) {
      if (this.store.isFocused(path)) focusSwallowed = true
      this.store.deselectPath(path)
      this.renderer.syncNodeState(path)
    }

    if (focusSwallowed) this.store.focusedPath = node.path

    this.renderer.syncNodeState(node.path)
    this.renderer.syncNodeExpanded(node.path, false)
    this._publishSelectionContext()
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

  // selection
  //
  // Everything that changes what is selected or focused goes through
  // _applySelection. The store, the DOM classes and the context keys move
  // together there, so what is highlighted, what a command will act on and which
  // menu items are enabled cannot drift apart — which is exactly how a
  // right-click once deleted a directory the user had stopped looking at.

  /** Replaces the selection. Focus and the Shift anchor land on `focusIndex`. */
  setSelection(indices: readonly number[], focusIndex?: number) {
    const paths = this._toPaths(indices)
    const focusPath = focusIndex === undefined ? (paths[paths.length - 1] ?? null) : this._pathAt(focusIndex)

    this._applySelection(paths, focusPath, focusPath)
  }

  clearSelection() {
    this._applySelection([], null, null)
  }

  /** Ctrl-click: flips one node, leaving the rest of the selection alone. */
  toggleSelection(index: number) {
    const path = this._pathAt(index)
    if (path === null) return

    const paths = this.store.getSelectedPaths()
    const next = this.store.isSelected(path) ? paths.filter((p) => p !== path) : [...paths, path]

    this._applySelection(next, path, path)
  }

  /**
   * Shift-click and Shift+Arrow: the run from the anchor to `index`.
   *
   * The anchor stays where the last plain click put it. Moving it with each
   * extension is what made a repeated Shift+Down grow a selection it should have
   * been shrinking.
   */
  extendSelectionTo(index: number) {
    const path = this._pathAt(index)
    if (path === null) return

    const anchorPath = this.store.anchorPath
    const anchorIndex = anchorPath !== null ? this.store.getFlattenIndexByPath(anchorPath) : undefined

    // No anchor yet (nothing selected, or the anchor was collapsed away) — this
    // node becomes one, and the range is just itself.
    if (anchorIndex === undefined) {
      this._applySelection([path], path, path)
      return
    }

    // Index 0 is the root, which has no row and cannot be part of a range.
    const start = Math.max(1, Math.min(anchorIndex, index))
    const end = Math.max(anchorIndex, index)

    const paths: string[] = []
    for (let i = start; i <= end; i++) {
      const rowPath = this._pathAt(i)
      if (rowPath !== null) paths.push(rowPath)
    }

    this._applySelection(paths, path, anchorPath)
  }

  /**
   * Moves the current item and gives it real DOM focus, which is what scrolls it
   * into view. Kept apart from the selection setters: assigning the current item
   * used to focus an element as a side effect, and callers that only wanted the
   * bookkeeping had to reach past the facade into the store to avoid it.
   */
  focusIndex(index: number) {
    const path = this._pathAt(index)
    if (path === null) return

    if (!this.store.isFocused(path)) {
      this._applySelection(this.store.getSelectedPaths(), path, path)
    }

    // The root's wrapper is the container of every other node, so asking it for
    // a tree node would hand back the first child. It has no row to focus.
    if (index === 0) return

    const treeNode = this.getTreeWrapperByPath(path)?.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement | null
    treeNode?.focus()
  }

  /** The current item: the target of rename, create, paste and arrow movement. */
  get focusedIndex(): number {
    const path = this.store.focusedPath
    if (path === null) return -1
    return this.store.getFlattenIndexByPath(path) ?? -1
  }

  getSelectedIndices(): number[] {
    const indices: number[] = []
    for (const path of this.store.getSelectedPaths()) {
      const index = this.store.getFlattenIndexByPath(path)
      if (index !== undefined) indices.push(index)
    }
    return indices.sort((a, b) => a - b)
  }

  getSelectedPaths(): string[] {
    return this.store.getSelectedPaths()
  }

  private _applySelection(paths: readonly string[], focusPath: string | null, anchorPath: string | null) {
    // Repaint the union of before and after: a node that just left the selection
    // needs its class removed as much as a new one needs it added.
    const touched = new Set<string>([...this.store.getSelectedPaths(), ...paths])
    if (this.store.focusedPath !== null) touched.add(this.store.focusedPath)
    if (focusPath !== null) touched.add(focusPath)

    this.store.setSelectedPaths(paths)
    this.store.focusedPath = focusPath
    this.store.anchorPath = anchorPath

    for (const path of touched) this.renderer.syncNodeState(path)

    this._publishSelectionContext()
  }

  private _publishSelectionContext() {
    const focusedPath = this.store.focusedPath
    const focused = focusedPath !== null ? this.store.getTreeViewModelByPath(focusedPath) : undefined

    this.contextKeyService.update({
      treeHasSelection: this.store.getSelectedPaths().length > 0,
      // The current item is what the single-target commands act on, so it is
      // also what "is the selection a directory" has to mean for them.
      treeSelectionIsDirectory: focused?.directory ?? false,
    })
  }

  private _pathAt(index: number): string | null {
    return this.store.flattenTree[index]?.path ?? null
  }

  private _toPaths(indices: readonly number[]): string[] {
    const paths: string[] = []
    for (const index of indices) {
      const path = this._pathAt(index)
      if (path !== null) paths.push(path)
    }
    return paths
  }

  //

  get contextTreeIndex(): number {
    const path = this.store.contextPath
    if (path === null) return -1
    return this.store.getFlattenIndexByPath(path) ?? -1
  }

  get selectedDragIndex(): number {
    const path = this.store.dragTargetPath
    if (path === null) return -1
    return this.store.getFlattenIndexByPath(path) ?? -1
  }

  setSelectedDragIndexByPath(path: string) {
    this.store.dragTargetPath = path
  }

  // clipboard

  get clipboardMode() {
    return this.store.clipboardMode
  }

  getClipboardPaths(): string[] {
    return this.store.getClipboardPaths()
  }

  /** Replaces the clipboard. Only a cut greys its sources out; a copy leaves them. */
  setClipboard(paths: readonly string[], mode: ClipboardMode) {
    const touched = new Set<string>([...this.store.getClipboardPaths(), ...paths])

    this.store.setClipboardPaths(paths)
    this.store.clipboardMode = mode

    for (const path of touched) this.renderer.syncNodeState(path)
    this._publishClipboardContext()
  }

  /** Drops the clipboard entirely: pending paths, their cut styling, and the mode. */
  clearClipboard() {
    this.setClipboard([], "none")
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

  getTreeNodeByPath(path: string) {
    return this.renderer.getTreeNodeByPath(path)
  }

  /** Repaints one node after something outside the selection touched its row. */
  refreshNodeState(path: string) {
    this.renderer.syncNodeState(path)
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

    const path = treeNode.dataset[DOM.DATASET_ATTR_TREE_PATH]!
    const index = this.getFlattenIndexByPath(path)

    // Cut, copy, rename and delete all act on the selection, so opening the menu
    // somewhere outside it has to bring the selection here first. Without this,
    // right-clicking a file inside a directory that was left selected — which is
    // what pasting into it leaves behind — made Delete remove the directory.
    //
    // Right-clicking inside an existing multi-selection keeps it, so the menu can
    // still act on all of it.
    if (index === undefined) return

    if (!this.store.isSelected(path)) this.setSelection([index], index)

    // Focus the row in both cases. A right-click does not move focus on its own
    // the way a left-click does, so without this the tree is not the focused
    // zone — and every item in the menu about to open reads focusedTask through
    // its `when` and greys itself out.
    this.focusIndex(index)

    this.store.contextPath = path

    // Which items apply is not decided here. It is one `when` per command now,
    // read by the handler that wired the clicks — the copy of those rules that
    // used to live at this spot had already drifted from the commands it was
    // describing.
    const { treeContextMenu } = this.renderer.elements
    treeContextMenu.classList.add(DOM.CLASS_SELECTED)
    adjustMenuPosition(e, treeContextMenu)
  }

  /**
   * Hides the menu, and only that.
   *
   * Whether the menu is showing is the menu's own state — gating this on the
   * right-clicked node once left the menu on screen after deleting it. The node
   * itself outlives the close because the command runs after it, and is
   * overwritten by the next right-click.
   */
  handleHideContextmenu() {
    this.renderer.elements.treeContextMenu.classList.remove(CLASS_SELECTED)
  }

  //

  async applyRename(preBase: string, newBase: string) {
    const start = this.getFlattenIndexByPath(preBase)!
    const renamedPaths: string[] = []

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

        // Selection and clipboard are keyed by path, and this is the one
        // operation that moves a path out from under them.
        this.store.renamePath(oldPath, newPath)
        renamedPaths.push(newPath)
      } else {
        break
      }
    }

    // The rename replaced the row's contents, so its marks are repainted from
    // the state they were just carried over to.
    for (const path of renamedPaths) this.renderer.syncNodeState(path)

    this._publishSelectionContext()
  }

  applyDelete(indices: number[]) {
    indices = indices.filter((i) => this.store.flattenTree[i] !== undefined)
    if (indices.length === 0) return

    indices.sort((a, b) => b - a)
    const minIndex = indices[indices.length - 1]

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
          parent.children = parent.children.filter((child: any) => child.path !== target.path)
        }
      }

      for (const node of toDelete) {
        const path = node.path
        const wrapper = this.getTreeWrapperByPath(path)

        wrapper?.remove()

        this.deleteTreeWrapperByPath(path)
        // The node is gone for good, so the clipboard drops it too — otherwise
        // deleted paths pile up there and a later paste asks for files that no
        // longer exist.
        this.store.forgetPath(path)
      }

      this.spliceFlattenTree(index, toDelete.length)
    }

    this.updatePathToFlattenTreeIndex(minIndex)

    this._publishSelectionContext()
    this._publishClipboardContext()
  }

  applyCreate(parentPath: string, createdPath: string, isDirectory: boolean) {
    const parent = this.getTreeViewModelByPath(parentPath)
    // Parent may be unknown to the tree (e.g. watcher event under a directory
    // that was never loaded) — nothing to update.
    if (!parent) return
    // Already present (e.g. watcher echo of our own create) — skip duplicates.
    if (parent.children?.some((child) => child.path === createdPath)) return

    // Collapsed and never read: leave the model alone. Expanding reads the
    // directory from disk and that read already contains the new node. Recording
    // a lone child here would make the directory look loaded, so expanding would
    // render only this node and hide everything actually inside it.
    if (!parent.expanded && !parent.children?.length) return

    const name = window.utils.getBaseName(createdPath)

    const newNode: TreeViewModel = {
      path: createdPath,
      name,
      indent: parent.indent + 1,
      directory: isDirectory,
      expanded: false,
      children: isDirectory ? [] : null,
    }

    // Insert into parent.children at sorted position
    if (!parent.children) parent.children = []
    const childInsertIdx = this.store.findSortedChildInsertIndex(parent, name, isDirectory)
    parent.children.splice(childInsertIdx, 0, newNode)

    // flattenTree holds the visible rows, so a collapsed parent contributes none;
    // its children join it when it expands.
    if (parent.expanded) {
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

      // Rows below shift down by one. Nothing to correct: the selection names
      // paths, so it follows the nodes rather than the positions they were at.
      this.store.insertIntoFlattenTree(flatInsertIdx, [newNode])
    }

    // The DOM node goes in either way. Expanding only renders into an empty
    // container, so a node skipped here while collapsed would stay invisible
    // until a full rebuild — which is what hid files pasted into a closed
    // directory that had been opened at some point earlier.
    const container = this.getChildrenContainer(parentPath)
    const nextSibling = childInsertIdx < parent.children.length - 1 ? parent.children[childInsertIdx + 1] : null
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
