import "@milkdown/theme-nord/style.css"
import { TreeFacade } from "../modules"
import { DOM } from "../constants"
import { TREE_CONTEXT_MENU_BINDINGS } from "@renderer/commands/contextMenuBindings"
import {
  MOUSE_EVENTS,
  UI_ZONES,
  mouseDownOutside,
  type CommandRegistry,
  type FocusManager,
  type MouseEventBus,
} from "@renderer/core"
import { bindContextMenu, renderContextMenuState } from "./menu"
import type { RunCommand } from "./runCommand"

export function handleTree(
  run: RunCommand,
  mouseBus: MouseEventBus,
  commandRegistry: CommandRegistry,
  focusManager: FocusManager,
  treeFacade: TreeFacade
) {
  bindTreeTopMenuEvents(run, treeFacade)

  bindContainerClickEvent(run, treeFacade)

  bindContextmenuToggleEvents(mouseBus, commandRegistry, focusManager, treeFacade)

  bindMousedownEventsForDrag(mouseBus, treeFacade)
  bindMousemoveEventsForDrag(mouseBus, treeFacade)
  bindMouseupEventsForDrag(run, mouseBus, treeFacade)
  bindMouseleaveEventsForDrag(mouseBus, treeFacade)
}

// NOTE: nothing here clears the selected/focused marks when a click lands
// elsewhere. The marks say which node the tree's commands would act on, which
// stays true while focus is away; how they look when the tree is not the active
// zone is a `.tree-active` rule in tree.scss.

function bindTreeTopMenuEvents(run: RunCommand, treeFacade: TreeFacade) {
  const { treeTopAddFile, treeTopAddDirectory } = treeFacade.renderer.elements

  treeTopAddFile.addEventListener("click", async () => {
    await run("tree.create", false)
  })

  treeTopAddDirectory.addEventListener("click", async () => {
    await run("tree.create", true)
  })
}

//

function bindContainerClickEvent(run: RunCommand, treeFacade: TreeFacade) {
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
    if (viewModel.directory) await run("tree.expandDirectory", treeNode)
    else await run("file.open", path)

    // Opening a file hands focus to the editor, and a click in the tree is not
    // a request to leave it — the arrow keys have to keep moving the selection.
    // Re-resolved because the node may have been deleted while the open waited
    // in the command queue.
    const openedIndex = treeFacade.getFlattenIndexByPath(path)
    if (openedIndex !== undefined) treeFacade.focusIndex(openedIndex)
  }
}

//

function bindContextmenuToggleEvents(
  mouseBus: MouseEventBus,
  commandRegistry: CommandRegistry,
  focusManager: FocusManager,
  treeFacade: TreeFacade
) {
  const elements = treeFacade.renderer.elements

  bindContextMenu(commandRegistry, TREE_CONTEXT_MENU_BINDINGS, elements, () => treeFacade.handleHideContextmenu())

  elements.treeNodeContainer.addEventListener("contextmenu", (e) => {
    // Opening the menu moves the selection to the right-clicked node, and the
    // selection is what half of these commands apply to — so the greying is
    // computed after it, not before.
    treeFacade.handleShowContextmenu(e)
    renderContextMenuState(commandRegistry, focusManager, TREE_CONTEXT_MENU_BINDINGS, elements)
  })

  mouseBus.on(mouseDownOutside(UI_ZONES.TREE_CONTEXT_MENU.id), () => {
    treeFacade.handleHideContextmenu()
  })
}

//

//

function bindMousedownEventsForDrag(mouseBus: MouseEventBus, treeFacade: TreeFacade) {
  mouseBus.on(MOUSE_EVENTS.DOWN, (e) => {
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

function bindMousemoveEventsForDrag(mouseBus: MouseEventBus, treeFacade: TreeFacade) {
  mouseBus.on(MOUSE_EVENTS.MOVE, (e) => {
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
    treeFacade.updateDragOverStatus(e.target as HTMLElement)
  })
}

function bindMouseupEventsForDrag(run: RunCommand, mouseBus: MouseEventBus, treeFacade: TreeFacade) {
  // The bus neither awaits nor catches async listeners, so the drop has to
  // terminate its own promise or a failing move becomes an unhandled rejection.
  mouseBus.on(MOUSE_EVENTS.UP, () => {
    dropDraggedTreeNodes(run, treeFacade).catch((err) => {
      console.error("[treeHandlers] drag drop failed:", err)
    })
  })
}

async function dropDraggedTreeNodes(run: RunCommand, treeFacade: TreeFacade) {
  if (!treeFacade.isDrag()) {
    treeFacade.setMouseDown(false)
    return
  }

  const dropPath = treeFacade.getInsertPath()
  const canDrop = dropPath !== ""

  treeFacade.clearDrag()

  if (canDrop) {
    treeFacade.setSelectedDragIndexByPath(dropPath)
    await run("tree.move")
  }
}

function bindMouseleaveEventsForDrag(mouseBus: MouseEventBus, treeFacade: TreeFacade) {
  // Unconditional: below the 5px threshold isDrag() is still false but the
  // mousedown has been recorded, and leaving then would keep it recorded —
  // re-entering with the button up turned the first 5px of travel into a
  // drag with nothing held. clearDrag resets both and repeats safely.
  mouseBus.on(MOUSE_EVENTS.LEAVE, () => {
    treeFacade.clearDrag()
  })
}
