import type { TreeViewModel } from "../../viewmodels/TreeViewModel"

import { inject, injectable } from "inversify"

import fileSvg from "../../assets/icons/file.svg?raw"
import closedFolderSvg from "../../assets/icons/closed_folder.svg?raw"
import openedFolderSvg from "../../assets/icons/opened_folder.svg?raw"
import { DI, DOM } from "@renderer/constants"
import type { TreeElements } from "./TreeElements"

@injectable()
export class TreeRenderer {
  private _ghost: HTMLElement | null = null

  private _pathToTreeWrapper: Map<string, HTMLElement> = new Map()

  constructor(@inject(DI.TreeElements) readonly elements: TreeElements) {}

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

    const children = document.createElement("div")
    children.classList.add(DOM.CLASS_TREE_NODE_CHILDREN)
    children.classList.toggle(DOM.CLASS_EXPANDED, viewModel.expanded)

    const wrapper = document.createElement("div")
    wrapper.classList.add(DOM.CLASS_TREE_NODE_WRAPPER)

    node.appendChild(type)
    node.appendChild(text)
    wrapper.appendChild(node)
    wrapper.appendChild(children)

    this._pathToTreeWrapper.set(viewModel.path, wrapper)

    return wrapper
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

      this._pathToTreeWrapper.set(viewModel.path, container)
      container.dataset[DOM.DATASET_ATTR_TREE_PATH] = viewModel.path
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

  clearPathToTreeWrapper() {
    this._pathToTreeWrapper.clear()
  }

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
