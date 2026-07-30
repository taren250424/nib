import "@milkdown/theme-nord/style.css"

import { DOM } from "../constants"
import { TabEditorFacade } from "../modules"
import { TAB_CONTEXT_MENU_BINDINGS } from "@renderer/commands/contextMenuBindings"
import {
  MOUSE_EVENTS,
  UI_ZONES,
  mouseDownOutside,
  type CommandRegistry,
  type FocusManager,
  type MouseEventBus,
} from "@renderer/core"
import { debounce } from "@renderer/utils"
import { bindContextMenu, renderContextMenuState } from "./menu"
import type { RunCommand } from "./runCommand"

export function handleTabEditor(
  run: RunCommand,
  mouseBus: MouseEventBus,
  commandRegistry: CommandRegistry,
  focusManager: FocusManager,
  tabEditorFacade: TabEditorFacade
) {
  bindContainerClickEvent(run, tabEditorFacade)

  bindContextmenuToggleEvents(mouseBus, commandRegistry, focusManager, tabEditorFacade)

  bindFindReplaceEvents(run, tabEditorFacade)

  bindMousedownEventsForDrag(mouseBus, tabEditorFacade)
  bindMousemoveEventsForDrag(mouseBus, tabEditorFacade)
  bindMouseupEventsForDrag(mouseBus, tabEditorFacade)
  bindMouseleaveEventsForDrag(mouseBus, tabEditorFacade)

  bindWindowBlurEventForAutoSave(tabEditorFacade)
}

//

function bindContainerClickEvent(run: RunCommand, tabEditorFacade: TabEditorFacade) {
  const { tabContainer } = tabEditorFacade.renderer.elements

  tabContainer.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement
    const tabBox = target.closest(DOM.SELECTOR_TAB) as HTMLElement
    if (!tabBox) return

    if (target.tagName === "BUTTON") {
      const id = parseInt(tabBox.dataset[DOM.DATASET_ATTR_TAB_ID]!)
      await run("tab.close", id)
    } else if (target.tagName === "SPAN") {
      const id = parseInt(tabBox.dataset[DOM.DATASET_ATTR_TAB_ID]!)
      tabEditorFacade.activateTabEditorById(id)
    }
  })
}

//

function bindContextmenuToggleEvents(
  mouseBus: MouseEventBus,
  commandRegistry: CommandRegistry,
  focusManager: FocusManager,
  tabEditorFacade: TabEditorFacade
) {
  const elements = tabEditorFacade.renderer.elements

  bindContextMenu(commandRegistry, TAB_CONTEXT_MENU_BINDINGS, elements, () => tabEditorFacade.handleHideContextmenu())

  elements.tabContainer.addEventListener("contextmenu", (e: MouseEvent) => {
    tabEditorFacade.handleShowContextmenu(e)
    renderContextMenuState(commandRegistry, focusManager, TAB_CONTEXT_MENU_BINDINGS, elements)
  })

  mouseBus.on(mouseDownOutside(UI_ZONES.TAB_CONTEXT_MENU.id), () => {
    tabEditorFacade.handleHideContextmenu()
  })
}

//

function bindFindReplaceEvents(run: RunCommand, tabEditorFacade: TabEditorFacade) {
  const {
    findUp,
    findDown,
    replaceCurrent,
    replaceAll,
    closeFindReplace,
    findReplaceToggle,
    findInput,
    replaceInput,
    findOptionCase,
    findOptionWord,
  } = tabEditorFacade.renderer.elements

  // Prevent buttons from stealing focus from the input when clicked.
  // This keeps the find/replace input focused so keyboard shortcuts (e.g. Enter) work correctly.
  ;[findUp, findDown, replaceCurrent, replaceAll, findOptionCase, findOptionWord, findReplaceToggle].forEach((btn) => {
    btn.addEventListener("mousedown", (e) => e.preventDefault())
  })

  findOptionCase.addEventListener("click", async () => {
    await run("find.toggleOption", "matchCase")
  })

  findOptionWord.addEventListener("click", async () => {
    await run("find.toggleOption", "wholeWord")
  })

  findUp.addEventListener("click", async () => {
    await run("find.next", "up")
  })

  findDown.addEventListener("click", async () => {
    await run("find.next", "down")
  })

  replaceCurrent.addEventListener("click", async () => {
    await run("find.replace")
  })

  replaceAll.addEventListener("click", async () => {
    await run("find.replaceAll")
  })

  findReplaceToggle.addEventListener("click", async () => {
    await run("find.toggleReplaceRow")
  })

  closeFindReplace.addEventListener("click", async () => {
    await run("find.close")
  })

  findInput.addEventListener(
    "input",
    debounce(async (e: Event) => {
      const value = (e.target as HTMLInputElement).value
      await run("find.queryChanged", value)
    }, 300)
  )

  replaceInput.addEventListener("input", async (e: Event) => {
    const value = (e.target as HTMLInputElement).value
    await run("find.replaceQueryChanged", value)
  })
}

//

function bindWindowBlurEventForAutoSave(tabEditorFacade: TabEditorFacade) {
  window.addEventListener("blur", () => {
    tabEditorFacade.notifyWindowBlurForAutoSave()
  })
}

//

function bindMousedownEventsForDrag(mouseBus: MouseEventBus, tabEditorFacade: TabEditorFacade) {
  mouseBus.on(MOUSE_EVENTS.DOWN, (e) => {
    const target = e.target as HTMLElement
    const tab = target.closest(DOM.SELECTOR_TAB) as HTMLElement
    if (!tab) return
    tabEditorFacade.initDrag(tab, e.clientX, e.clientY)
  })
}

function bindMousemoveEventsForDrag(mouseBus: MouseEventBus, tabEditorFacade: TabEditorFacade) {
  mouseBus.on(MOUSE_EVENTS.MOVE, (e) => {
    if (!tabEditorFacade.isMouseDown()) return

    if (!tabEditorFacade.isDrag()) {
      const { x, y } = tabEditorFacade.getStartPosition()
      if (Math.abs(e.clientX - x) > 5 || Math.abs(e.clientY - y) > 5) {
        tabEditorFacade.startDrag()
      } else {
        return
      }
    }

    tabEditorFacade.moveGhostTab(e.clientX, e.clientY)

    const newIndex = tabEditorFacade.getInsertIndexFromMouseX(e.clientX)
    if (tabEditorFacade.getInsertIndex() !== newIndex) {
      tabEditorFacade.setInsertIndex(newIndex)
      tabEditorFacade.updateDragIndicator(newIndex)
    }
  })
}

function bindMouseupEventsForDrag(mouseBus: MouseEventBus, tabEditorFacade: TabEditorFacade) {
  // The bus neither awaits nor catches async listeners, so the drop has to
  // terminate its own promise or a failing session sync becomes an unhandled rejection.
  mouseBus.on(MOUSE_EVENTS.UP, () => {
    dropDraggedTab(tabEditorFacade).catch((err) => {
      console.error("[tabEditorHandlers] tab drag drop failed:", err)
    })
  })
}

async function dropDraggedTab(tabEditorFacade: TabEditorFacade) {
  if (!tabEditorFacade.isDrag()) {
    tabEditorFacade.setMouseDown(false)
    return
  }

  const from = tabEditorFacade.getTabEditorViewIndexById(tabEditorFacade.getTargetTabId())
  const to = tabEditorFacade.getInsertIndex()
  tabEditorFacade.moveTabEditorViewAndUpdateActiveIndex(from, to)

  tabEditorFacade.clearDrag()

  const tabEditorsDto = tabEditorFacade.getTabEditorsDto()
  const response = await window.rendererToMain.syncTabSessionFromRenderer(tabEditorsDto)

  if (!response) tabEditorFacade.moveTabEditorViewAndUpdateActiveIndex(to, from)
}

function bindMouseleaveEventsForDrag(mouseBus: MouseEventBus, tabEditorFacade: TabEditorFacade) {
  mouseBus.on(MOUSE_EVENTS.LEAVE, () => {
    if (tabEditorFacade.isDrag()) {
      tabEditorFacade.clearDrag()
    }
  })
}
