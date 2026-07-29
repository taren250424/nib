import "@milkdown/theme-nord/style.css"
import { TreeFacade } from "../modules"
import { DOM, CUSTOM_EVENTS } from "../constants"
import { Dispatcher } from "@renderer/dispatch"
import type { AppEvents } from "@renderer/dispatch"
import { EventEmitter } from "events"

export function handleTree(dispatcher: Dispatcher, emitter: EventEmitter, treeFacade: TreeFacade) {
  bindTreeTopMenuEvents(dispatcher, treeFacade)

  bindContainerClickEvent(dispatcher, treeFacade)

  bindContextmenuToggleEvents(emitter, treeFacade)
  bindContextmenuClickEvents(dispatcher, treeFacade)

  bindMousedownEventsForDrag(emitter, treeFacade)
  bindMousemoveEventsForDrag(emitter, treeFacade)
  bindMouseupEventsForDrag(dispatcher, emitter, treeFacade)
  bindMouseleaveEventsForDrag(emitter, treeFacade)
}

// NOTE: nothing here clears the selected/focused marks when a click lands
// elsewhere. The marks say which node the tree's commands would act on, which
// stays true while focus is away; how they look when the tree is not the active
// zone is a `.tree-active` rule in tree.scss.

function bindTreeTopMenuEvents(dispatcher: Dispatcher, treeFacade: TreeFacade) {
  const { treeTopAddFile, treeTopAddDirectory } = treeFacade.renderer.elements

  treeTopAddFile.addEventListener("click", async () => {
    await dispatcher.dispatch("create", "element", false)
  })

  treeTopAddDirectory.addEventListener("click", async () => {
    await dispatcher.dispatch("create", "element", true)
  })
}

//

function bindContainerClickEvent(dispatcher: Dispatcher, treeFacade: TreeFacade) {
  const { treeNodeContainer } = treeFacade.renderer.elements

  treeNodeContainer.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement
    const el = target.closest(`${DOM.SELECTOR_TREE_NODE}, ${DOM.SELECTOR_TREE_NODE_CONTAINER}`)! as HTMLElement

    if (el.matches(DOM.SELECTOR_TREE_NODE_CONTAINER)) _processContainer()
    else await _processNode(e, el)
  })

  function _processContainer() {
    // The root row does not exist as an element, so clicking the empty area
    // below the tree means "the root is the current item" — that is what a
    // create with nothing selected falls back to.
    treeFacade.setSelection([], 0)
  }

  async function _processNode(e: MouseEvent, treeNode: HTMLElement) {
    const path = treeNode.dataset[DOM.DATASET_ATTR_TREE_PATH]!
    const index = treeFacade.getFlattenIndexByPath(path)
    if (index === undefined) return

    if (e.shiftKey) {
      treeFacade.extendSelectionTo(index)
      return
    }

    if (e.ctrlKey) {
      treeFacade.toggleSelection(index)
      return
    }

    // Select before opening, not after: the open goes through the command
    // queue, and until it comes back the highlight would still be on whatever
    // was selected before the click.
    treeFacade.setSelection([index])

    const viewModel = treeFacade.getTreeViewModelByPath(path)
    if (!viewModel) return
    if (viewModel.directory) await dispatcher.dispatch("openDirectoryByTreeNode", "element", treeNode)
    else await dispatcher.dispatch("openFile", "element", path)
  }
}

//

function bindContextmenuToggleEvents(emitter: EventEmitter, treeFacade: TreeFacade) {
  const { treeNodeContainer } = treeFacade.renderer.elements

  treeNodeContainer.addEventListener("contextmenu", (e) => {
    treeFacade.handleShowContextmenu(e)
  })

  emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.OUT.TREE_CONTEXTMENU, () => {
    treeFacade.handleHideContextmenu()
  })
}

function bindContextmenuClickEvents(dispatcher: Dispatcher, treeFacade: TreeFacade) {
  const { treeContextCut, treeContextCopy, treeContextPaste, treeContextRename, treeContextDelete } =
    treeFacade.renderer.elements

  // Closing happens after the command, not before, because paste reads the
  // right-clicked index and closing clears it. A failed command still closes.
  const bindItem = (element: HTMLElement, event: AppEvents) => {
    element.addEventListener("click", async () => {
      try {
        await dispatcher.dispatch(event, "context-menu")
      } catch (err) {
        console.error(`[treeHandlers] ${event} from the context menu failed:`, err)
      } finally {
        treeFacade.handleHideContextmenu()
      }
    })
  }

  bindItem(treeContextCut, "cut")
  bindItem(treeContextCopy, "copy")
  bindItem(treeContextPaste, "paste")
  bindItem(treeContextRename, "rename")
  bindItem(treeContextDelete, "delete")
}

//

//

function bindMousedownEventsForDrag(emitter: EventEmitter, treeFacade: TreeFacade) {
  emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.DEFAULT, (e) => {
    const target = e.target as HTMLElement
    const node = target.closest(DOM.SELECTOR_TREE_NODE) as HTMLElement
    if (!node) return

    let count = treeFacade.getSelectedIndices().length
    if (count === 0) {
      const path = node.dataset[DOM.DATASET_ATTR_TREE_PATH]!
      const idx = treeFacade.getFlattenIndexByPath(path)
      if (idx === undefined) return
      treeFacade.setSelection([idx])
      count = 1
    }

    treeFacade.initDrag(count, e.clientX, e.clientY)
  })
}

function bindMousemoveEventsForDrag(emitter: EventEmitter, treeFacade: TreeFacade) {
  emitter.on(CUSTOM_EVENTS.MOUSE_MOVE.DEFAULT, (e) => {
    if (!treeFacade.isMouseDown()) return

    if (!treeFacade.isDrag()) {
      const { x, y } = treeFacade.getStartPosition()
      if (Math.abs(e.clientX - x) > 5 || Math.abs(e.clientY - y) > 5) {
        treeFacade.startDrag()
      } else {
        return
      }
    }

    treeFacade.moveGhost(e.clientX, e.clientY)
    treeFacade.updateDragOverStatus(e.target)
  })
}

function bindMouseupEventsForDrag(dispatcher: Dispatcher, emitter: EventEmitter, treeFacade: TreeFacade) {
  // EventEmitter neither awaits nor catches async listeners, so the drop has to
  // terminate its own promise or a failing move becomes an unhandled rejection.
  emitter.on(CUSTOM_EVENTS.MOUSE_UP.DEFAULT, () => {
    dropDraggedTreeNodes(dispatcher, treeFacade).catch((err) => {
      console.error("[treeHandlers] drag drop failed:", err)
    })
  })
}

async function dropDraggedTreeNodes(dispatcher: Dispatcher, treeFacade: TreeFacade) {
  if (!treeFacade.isDrag()) {
    treeFacade.setMouseDown(false)
    return
  }

  const dropPath = treeFacade.getInsertPath()
  const canDrop = dropPath !== ""

  treeFacade.clearDrag()

  if (canDrop) {
    treeFacade.setSelectedDragIndexByPath(dropPath)
    await dispatcher.dispatch("cut", "drag")
    await dispatcher.dispatch("paste", "drag")
  }
}

function bindMouseleaveEventsForDrag(emitter: EventEmitter, treeFacade: TreeFacade) {
  emitter.on(CUSTOM_EVENTS.MOUSE_LEAVE.DEFAULT, () => {
    if (treeFacade.isDrag()) {
      treeFacade.clearDrag()
    }
  })
}
