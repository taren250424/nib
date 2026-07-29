import type ClipboardMode from "@shared/types/ClipboardMode"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TreeViewModel } from "../../viewmodels/TreeViewModel"

import { injectable } from "inversify"

@injectable()
export class TreeStore {
  private _flattenTree: TreeViewModel[] = []
  private _pathToFlattenTreeIndex: Map<string, number> = new Map()

  // Selection state is keyed by path, not by flattenTree index.
  //
  // Indices shift on every create, delete, expand and collapse, so an index kept
  // here means something different a moment later. That drift is where the
  // "the command acted on a node other than the highlighted one" bugs came from.
  // Paths only move on rename, which is the one operation that has to remap them
  // (see renamePath).
  //
  // `focused` is the current item: the anchor for keyboard movement and the
  // single target of rename, create and paste. `anchor` is where a Shift range
  // starts from, and stays put while the range grows.
  private _selectedPaths = new Set<string>()
  private _focusedPath: string | null = null
  private _anchorPath: string | null = null
  private _contextPath: string | null = null
  private _dragTargetPath: string | null = null

  // Set of full paths that have been copied (including all nested children).
  // Unlike the selection, this persists even if folders are collapsed.
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

  /** Collapses a directory out of the flat list. Returns the paths that left it. */
  removeChildNodes(parent: TreeViewModel): string[] {
    const index = this._pathToFlattenTreeIndex.get(parent.path)!

    const removedPaths: string[] = []
    for (let i = index + 1; i < this._flattenTree.length; i++) {
      if (this._flattenTree[i].indent <= parent.indent) break
      removedPaths.push(this._flattenTree[i].path)
      this._pathToFlattenTreeIndex.delete(this._flattenTree[i].path)
    }

    if (removedPaths.length > 0) {
      this._flattenTree.splice(index + 1, removedPaths.length)
      this.updatePathToFlattenTreeIndex(index + 1)
    }

    return removedPaths
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

  getSelectedPaths(): string[] {
    return [...this._selectedPaths]
  }

  setSelectedPaths(paths: Iterable<string>) {
    this._selectedPaths = new Set(paths)
  }

  isSelected(path: string): boolean {
    return this._selectedPaths.has(path)
  }

  //

  get focusedPath() {
    return this._focusedPath
  }

  set focusedPath(path: string | null) {
    this._focusedPath = path
  }

  isFocused(path: string): boolean {
    return this._focusedPath === path
  }

  get anchorPath() {
    return this._anchorPath
  }

  set anchorPath(path: string | null) {
    this._anchorPath = path
  }

  //

  get contextPath() {
    return this._contextPath
  }

  set contextPath(path: string | null) {
    this._contextPath = path
  }

  get dragTargetPath() {
    return this._dragTargetPath
  }

  set dragTargetPath(path: string | null) {
    this._dragTargetPath = path
  }

  //

  get clipboardMode() {
    return this._clipboardMode
  }

  set clipboardMode(mode: ClipboardMode) {
    this._clipboardMode = mode
  }

  getClipboardPaths(): string[] {
    return [...this._clipboardPaths]
  }

  setClipboardPaths(paths: Iterable<string>) {
    this._clipboardPaths = new Set(paths)
  }

  /**
   * Whether the node is one of the roots waiting to be moved.
   *
   * Only cut greys nodes out; a copy leaves its sources looking untouched, which
   * is also why the mode is part of the answer rather than the path set alone.
   */
  isCut(path: string): boolean {
    return this._clipboardMode === "cut" && this._clipboardPaths.has(path)
  }

  //

  /**
   * The node is hidden but still exists (its parent collapsed). It drops out of
   * the selection — a command must never act on something off screen — while the
   * clipboard keeps it, since a cut folder can be collapsed and still pasted.
   */
  deselectPath(path: string) {
    this._selectedPaths.delete(path)
    if (this._focusedPath === path) this._focusedPath = null
    if (this._anchorPath === path) this._anchorPath = null
    if (this._contextPath === path) this._contextPath = null
    if (this._dragTargetPath === path) this._dragTargetPath = null
  }

  /** The node is gone from the tree entirely, so the clipboard loses it too. */
  forgetPath(path: string) {
    this.deselectPath(path)
    this._clipboardPaths.delete(path)
  }

  /** Rename is the only thing that moves a path, so it is the only remapper. */
  renamePath(oldPath: string, newPath: string) {
    const swap = (set: Set<string>) => {
      if (!set.delete(oldPath)) return
      set.add(newPath)
    }

    swap(this._selectedPaths)
    swap(this._clipboardPaths)

    if (this._focusedPath === oldPath) this._focusedPath = newPath
    if (this._anchorPath === oldPath) this._anchorPath = newPath
    if (this._contextPath === oldPath) this._contextPath = newPath
    if (this._dragTargetPath === oldPath) this._dragTargetPath = newPath
  }
}
