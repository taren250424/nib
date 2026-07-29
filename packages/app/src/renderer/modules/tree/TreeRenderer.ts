import type { TreeViewModel } from "../../viewmodels/TreeViewModel"

import { inject, injectable } from "inversify"

import fileSvg from "../../assets/icons/file.svg?raw"
import closedFolderSvg from "../../assets/icons/closed_folder.svg?raw"
import openedFolderSvg from "../../assets/icons/opened_folder.svg?raw"
import { DI, DOM } from "@renderer/constants"
import type { TreeElements } from "./TreeElements"
import { TreeStore } from "./TreeStore"

@injectable()
export class TreeRenderer {
  private _ghost: HTMLElement | null = null

  private _pathToTreeWrapper: Map<string, HTMLElement> = new Map()
  private _rootPath: string | null = null

  constructor(
    @inject(DI.TreeElements) readonly elements: TreeElements,
    @inject(DI.TreeStore) private readonly store: TreeStore
  ) {}

  //

  private _createNodeWrapper(viewModel: TreeViewModel): HTMLElement {
    const type = document.createElement("div")
    type.classList.add(DOM.CLASS_TREE_NODE_TYPE)

    if (!viewModel.directory) {
      type.classList.add("file")
      type.innerHTML = fileSvg
    } else {
      type.classList.add("folder")
      type.innerHTML = viewModel.expanded ? openedFolderSvg : closedFolderSvg
    }

    const text = document.createElement("span")
    text.classList.add(DOM.CLASS_TREE_NODE_TEXT, "ellipsis")
    text.textContent = viewModel.name

    const node = document.createElement("div")
    node.classList.add(DOM.CLASS_TREE_NODE)
    node.style.paddingLeft = `${4 + (viewModel.indent - 1) * 16}px`
    node.dataset[DOM.DATASET_ATTR_TREE_PATH] = viewModel.path
    node.title = viewModel.path
    node.tabIndex = -1
    node.setAttribute("role", "treeitem")
    node.setAttribute("aria-level", String(viewModel.indent))
    if (viewModel.directory) node.setAttribute("aria-expanded", String(viewModel.expanded))

    const children = document.createElement("div")
    children.classList.add(DOM.CLASS_TREE_NODE_CHILDREN)
    children.classList.toggle(DOM.CLASS_EXPANDED, viewModel.expanded)
    children.setAttribute("role", "group")

    const wrapper = document.createElement("div")
    wrapper.classList.add(DOM.CLASS_TREE_NODE_WRAPPER)

    node.appendChild(type)
    node.appendChild(text)
    wrapper.appendChild(node)
    wrapper.appendChild(children)

    this._pathToTreeWrapper.set(viewModel.path, wrapper)
    // Paint from the store rather than leaving it to whoever asked for the
    // render: a node built without this is a node whose selected/focused/cut
    // marks vanish the moment anything re-renders it.
    this.syncNodeState(viewModel.path)

    return wrapper
  }

  /**
   * Brings one node's selected/focused/cut marks back in line with the store.
   *
   * Every path that produces those marks ends here, so the highlighted node and
   * the node a command will act on are the same node by construction.
   */
  syncNodeState(path: string) {
    const wrapper = this._pathToTreeWrapper.get(path)
    if (!wrapper) return

    // The root has no row of its own — its wrapper is the scroll container
    // holding every other node, so querying it for a tree node would find the
    // first child instead. Its focus shows on the container.
    if (path === this._rootPath) {
      this.elements.treeNodeContainer.classList.toggle(DOM.CLASS_FOCUSED, this.store.isFocused(path))
      return
    }

    // Cut marks the wrapper, not the row: the greying is meant to carry to the
    // children being moved along with it.
    wrapper.classList.toggle(DOM.CLASS_CUT, this.store.isCut(path))

    const node = wrapper.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement | null
    if (!node) return

    const selected = this.store.isSelected(path)
    node.classList.toggle(DOM.CLASS_SELECTED, selected)
    node.classList.toggle(DOM.CLASS_FOCUSED, this.store.isFocused(path))
    node.setAttribute("aria-selected", String(selected))
  }

  /** Reflects an expand/collapse the tree performed on an existing node. */
  syncNodeExpanded(path: string, expanded: boolean) {
    const node = this._pathToTreeWrapper.get(path)?.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement | null
    node?.setAttribute("aria-expanded", String(expanded))
  }

  private _renderElement(container: HTMLElement, viewModel: TreeViewModel) {
    const wrapper = this._createNodeWrapper(viewModel)
    container.appendChild(wrapper)

    if (viewModel.expanded && viewModel.children && viewModel.children.length > 0) {
      const childrenContainer = wrapper.querySelector(DOM.SELECTOR_TREE_NODE_CHILDREN) as HTMLElement
      for (const child of viewModel.children) {
        this._renderElement(childrenContainer, child)
      }
    }
  }

  renderSingleNode(viewModel: TreeViewModel, container: HTMLElement, beforeElement?: Element | null) {
    const wrapper = this._createNodeWrapper(viewModel)

    if (beforeElement) {
      container.insertBefore(wrapper, beforeElement)
    } else {
      container.appendChild(wrapper)
    }
  }

  render(viewModel: TreeViewModel, container?: HTMLElement) {
    if (!container) {
      this.elements.treeTopName.textContent = viewModel.name

      // container = this.elements.treeNodeContainer
      container = this.elements.simpleBar.getContentElement() as HTMLElement

      // Every wrapper below is about to be discarded. Clearing here rather than
      // asking callers to remember means a full render cannot leave the map
      // pointing at elements that are no longer in the document.
      this._pathToTreeWrapper.clear()
      this._rootPath = viewModel.path

      this._pathToTreeWrapper.set(viewModel.path, container)
      container.dataset[DOM.DATASET_ATTR_TREE_PATH] = viewModel.path
      container.setAttribute("role", "tree")
    }

    while (container.firstChild) {
      container.removeChild(container.firstChild)
    }

    if (viewModel.children) {
      for (const child of viewModel.children) {
        this._renderElement(container, child)
      }
    }

    this.elements.simpleBar.recalculate()
  }

  //

  createInput(directory: boolean, indent: number) {
    const type = document.createElement("div")
    type.classList.add(DOM.CLASS_TREE_NODE_TYPE)

    if (directory) {
      type.classList.add("folder")
      type.innerHTML = closedFolderSvg
    } else {
      type.classList.add("file")
      type.innerHTML = fileSvg
    }

    const input = document.createElement("input")
    input.type = "text"
    input.value = ""
    input.classList.add(DOM.CLASS_TREE_NODE_INPUT)

    const node = document.createElement("div")
    node.classList.add("tree-node-temp")
    node.style.paddingLeft = `${4 + indent * 16}px`

    const wrapper = document.createElement("div")
    wrapper.classList.add(DOM.CLASS_TREE_NODE_WRAPPER)

    node.appendChild(type)
    node.appendChild(input)
    wrapper.appendChild(node)

    return { wrapper, input }
  }

  createGhost(count: number) {
    if (this._ghost) return this._ghost

    const div = document.createElement("div")
    div.classList.add(DOM.CLASS_TREE_GHOST)
    div.textContent = `${count} items`

    this._ghost = div
    document.body.appendChild(div)

    return this._ghost
  }

  removeGhost() {
    if (this._ghost) {
      this._ghost.remove()
      this._ghost = null
    }
  }

  //

  getTreeNodeByPath(path: string) {
    const wrapper = this._pathToTreeWrapper.get(path)!
    return wrapper.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement
  }

  getTreeWrapperByPath(path: string) {
    return this._pathToTreeWrapper.get(path)!
  }

  setTreeWrapperByPath(path: string, wrapper: HTMLElement) {
    this._pathToTreeWrapper.set(path, wrapper)
  }

  deleteTreeWrapperByPath(path: string) {
    this._pathToTreeWrapper.delete(path)
  }
}
