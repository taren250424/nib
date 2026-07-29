import type { TreeDto } from "@shared/dto/TreeDto"
import type { TreeElements } from "@renderer/modules/tree/TreeElements"

import { ContextKeyService } from "@renderer/core"
import { TreeFacade } from "@renderer/modules/tree/TreeFacade"
import { TreeRenderer } from "@renderer/modules/tree/TreeRenderer"
import { TreeStore } from "@renderer/modules/tree/TreeStore"
import { TreeDragManager } from "@renderer/modules/tree/TreeDragManager"

/**
 * A tree wired to a real document, minus SimpleBar and the DI container.
 *
 * The renderer's own tests are the point: every bug that reached a user so far
 * has been in this DOM code, and the node-environment suites cannot see it.
 */
export function createTreeHarness() {
  document.body.innerHTML = `
    <div id="tree-top"><span id="tree-top-name"></span></div>
    <div id="tree-node-container"><div id="content"></div></div>
    <div id="tree-context-menu"><div id="tree-context-paste"></div></div>
  `

  const treeNodeContainer = document.querySelector("#tree-node-container") as HTMLElement
  const content = document.querySelector("#content") as HTMLElement

  const elements = {
    treeNodeContainer,
    treeTop: document.querySelector("#tree-top") as HTMLElement,
    treeTopName: document.querySelector("#tree-top-name") as HTMLElement,
    treeContextMenu: document.querySelector("#tree-context-menu") as HTMLElement,
    treeContextPaste: document.querySelector("#tree-context-paste") as HTMLElement,
    simpleBar: {
      getContentElement: () => content,
      // Scrollbar geometry; nothing here depends on it.
      recalculate: () => undefined,
    },
  } as unknown as TreeElements

  const store = new TreeStore()
  const renderer = new TreeRenderer(elements, store)
  const contextKeyService = new ContextKeyService()
  const facade = new TreeFacade(store, renderer, new TreeDragManager(), contextKeyService)

  return { facade, store, renderer, contextKeyService, elements, content }
}

/** Loads a tree the way the session and the directory dialog do. */
export function loadTree(harness: ReturnType<typeof createTreeHarness>, dto: TreeDto) {
  const viewModel = harness.facade.toTreeViewModel(dto)
  harness.facade.render(viewModel)
  harness.facade.setRootTreeViewModel(viewModel)
  return viewModel
}

type NodeSpec = { name: string; children?: NodeSpec[]; expanded?: boolean }

/** Builds a TreeDto from a nested shorthand; a `children` array means directory. */
export function buildDto(root: NodeSpec, parentPath = "", indent = 0): TreeDto {
  const path = parentPath === "" ? root.name : `${parentPath}/${root.name}`
  const directory = root.children !== undefined

  return {
    path,
    name: root.name,
    indent,
    directory,
    expanded: directory ? (root.expanded ?? true) : false,
    children: directory ? root.children!.map((child) => buildDto(child, path, indent + 1)) : null,
  }
}

export function rowOf(harness: ReturnType<typeof createTreeHarness>, path: string) {
  return harness.renderer.getTreeNodeByPath(path)
}

export function wrapperOf(harness: ReturnType<typeof createTreeHarness>, path: string) {
  return harness.renderer.getTreeWrapperByPath(path)
}

/** The path helpers the tree calls through the preload bridge. */
export function installWindowUtils() {
  const posix = {
    getBaseName: (p: string) => p.slice(p.lastIndexOf("/") + 1),
    getDirName: (p: string) => p.slice(0, p.lastIndexOf("/")),
    getJoinedPath: (a: string, b: string) => (b === "" ? a : `${a}/${b}`),
    getRelativePath: (from: string, to: string) => (to === from ? "" : to.slice(from.length + 1)),
  }

  ;(window as unknown as { utils: typeof posix }).utils = posix
}
