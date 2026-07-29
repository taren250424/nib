import type ClipboardMode from "@shared/types/ClipboardMode"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TreeViewModel } from "../../viewmodels/TreeViewModel"

import { injectable } from "inversify"

@injectable()
export class TreeStore {
  private _flattenTree: TreeViewModel[] = []
  private _pathToFlattenTreeIndex: Map<string, number> = new Map()

  private _contextTreeIndex = -1
  private _lastSelectedIndex = -1
  private _selectedDragIndex = -1

  // Set of user-selected indices (no children included). For just ui.
  private _selectedIndices = new Set<number>()

  // Set of full paths that have been copied (including all nested children).
  // Unlike selectedIndices, this persists even if folders are collapsed.
  // Used during copy/cut commands to track exactly what to paste later.
  // Always resolved at the time of the command (not tied to UI state).
  private _clipboardPaths = new Set<string>()
  private _clipboardMode: ClipboardMode = "none"

  //

  toTreeDto(viewModel: TreeViewModel): TreeDto {
    if (!Object.keys(viewModel).length) return {} as TreeDto

    return {
      path: viewModel.path,
      name: viewModel.name,
      indent: viewModel.indent,
      directory: viewModel.directory,
      expanded: viewModel.expanded,
      children: Array.isArray(viewModel.children) ? viewModel.children.map((child) => this.toTreeDto(child)) : null,
    }
  }

  toTreeViewModel(dto: TreeDto): TreeViewModel {
    return {
      path: dto.path,
      name: dto.name,
      indent: dto.indent,
      directory: dto.directory,
      expanded: dto.expanded,
      selected: false,
      children: dto.children ? dto.children.map((child) => this.toTreeViewModel(child)) : null,
    }
  }

  //

  getRootTreeViewModel(): TreeViewModel {
    if (this._flattenTree.length === 0) return {} as TreeViewModel

    const pathToNode = new Map<string, TreeViewModel>()
    // Make a copy so we do not mutate the cached objects
    for (let i = 0; i < this._flattenTree.length; i++) {
      const node = this._flattenTree[i]
      pathToNode.set(node.path, { ...node, children: node.directory ? [] : null })
    }

    for (let i = 1; i < this._flattenTree.length; i++) {
      const node = pathToNode.get(this._flattenTree[i].path)!

      for (let j = i - 1; j >= 0; j--) {
        const possibleParent = this._flattenTree[j]

        if (possibleParent.indent === node.indent - 1) {
          const parent = pathToNode.get(possibleParent.path)!
          if (!parent.children) parent.children = []
          parent.children.push(node)
          break
        }
      }
    }

    return pathToNode.get(this._flattenTree[0].path)!
  }

  setRootTreeViewModel(root: TreeViewModel) {
    this.flattenTree = this.toFlatList(root)
    this.syncPathToFlattenTreeIndex()
  }

  syncPathToFlattenTreeIndex() {
    this._pathToFlattenTreeIndex.clear()

    for (let i = 0; i < this._flattenTree.length; i++) {
      this._pathToFlattenTreeIndex.set(this._flattenTree[i].path, i)
    }
  }

  updatePathToFlattenTreeIndex(startIndex: number) {
    for (let i = startIndex; i < this._flattenTree.length; i++) {
      this._pathToFlattenTreeIndex.set(this._flattenTree[i].path, i)
    }
  }

  //

  toFlatList(tree: TreeViewModel): TreeViewModel[] {
    const result: TreeViewModel[] = []

    function dfs(node: TreeViewModel) {
      result.push(node)
      if (node.children) {
        for (const child of node.children) {
          dfs(child)
        }
      }
    }

    dfs(tree)
    return result
  }

  findParentDirectoryIndex(index: number): number {
    const indent = this._flattenTree[index].indent
    let i = index - 1
    while (i >= 0) {
      if (this._flattenTree[i].indent < indent) {
        return i
      }
      i--
    }
    return 0
  }

  //

  insertChildNodes(parent: TreeViewModel) {
    const index = this._pathToFlattenTreeIndex.get(parent.path)!

    const childrenToInsert = this.toFlatList(parent).slice(1) // Remove the first element (the node itself) using slice(1)
    this._flattenTree.splice(index + 1, 0, ...childrenToInsert)

    this.updatePathToFlattenTreeIndex(index + 1)
  }

  removeChildNodes(parent: TreeViewModel) {
    const index = this._pathToFlattenTreeIndex.get(parent.path)!

    let removeCount = 0
    for (let i = index + 1; i < this._flattenTree.length; i++) {
      if (this._flattenTree[i].indent <= parent.indent) break
      this._pathToFlattenTreeIndex.delete(this._flattenTree[i].path)
      removeCount++
    }

    if (removeCount > 0) {
      this._flattenTree.splice(index + 1, removeCount)
      this.updatePathToFlattenTreeIndex(index + 1)
    }
  }

  //

  findSortedChildInsertIndex(parent: TreeViewModel, newName: string, isDirectory: boolean): number {
    if (!parent.children) return 0

    for (let i = 0; i < parent.children.length; i++) {
      const child = parent.children[i]

      // Directories come first
      if (isDirectory && !child.directory) return i
      if (!isDirectory && child.directory) continue

      // Same type: alphabetical
      if (newName.localeCompare(child.name) < 0) return i
    }

    return parent.children.length
  }

  getSubtreeSize(flatIdx: number): number {
    const baseIndent = this._flattenTree[flatIdx].indent
    let count = 1
    for (let i = flatIdx + 1; i < this._flattenTree.length; i++) {
      if (this._flattenTree[i].indent <= baseIndent) break
      count++
    }
    return count
  }

  insertIntoFlattenTree(position: number, nodes: TreeViewModel[]) {
    this._flattenTree.splice(position, 0, ...nodes)
    this.updatePathToFlattenTreeIndex(position)
  }

  //

  get flattenTree(): readonly TreeViewModel[] {
    return this._flattenTree
  }

  set flattenTree(arr: TreeViewModel[]) {
    this._flattenTree = arr
  }

  spliceFlattenTree(start: number, length: number) {
    this._flattenTree.splice(start, length)
  }

  //

  getTreeViewModelByIndex(index: number) {
    return this._flattenTree[index]
  }

  getTreeViewModelByPath(path: string) {
    const idx = this.getFlattenIndexByPath(path)
    return this._flattenTree[idx]
  }

  //

  getFlattenIndexByPath(path: string) {
    return this._pathToFlattenTreeIndex.get(path)!
  }

  setFlattenIndexByPath(path: string, index: number) {
    this._pathToFlattenTreeIndex.set(path, index)
  }

  deleteFlattenIndexByPath(path: string) {
    this._pathToFlattenTreeIndex.delete(path)
  }

  //

  get lastSelectedIndex() {
    return this._lastSelectedIndex
  }

  set lastSelectedIndex(index: number) {
    this._lastSelectedIndex = index
  }

  removeLastSelectedIndex() {
    this._lastSelectedIndex = -1
  }

  //

  get contextTreeIndex() {
    return this._contextTreeIndex
  }

  set contextTreeIndex(index: number) {
    this._contextTreeIndex = index
  }

  removeContextTreeIndex() {
    this._contextTreeIndex = -1
  }

  //

  get selectedDragIndex() {
    return this._selectedDragIndex
  }

  set selectedDragIndex(index: number) {
    this._selectedDragIndex = index
  }

  //

  addSelectedIndices(index: number) {
    this._selectedIndices.add(index)
  }

  getSelectedIndices(): number[] {
    return [...this._selectedIndices]
  }

  clearSelectedIndices() {
    this._selectedIndices.clear()
  }

  //

  get clipboardMode() {
    return this._clipboardMode
  }

  set clipboardMode(mode: ClipboardMode) {
    this._clipboardMode = mode
  }

  addClipboardPaths(path: string) {
    this._clipboardPaths.add(path)
  }

  getClipboardPaths(): string[] {
    return [...this._clipboardPaths]
  }

  clearClipboardPaths() {
    this._clipboardPaths.clear()
  }
}
