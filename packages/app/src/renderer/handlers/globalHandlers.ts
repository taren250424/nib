import {
  FocusManager,
  KeybindingService,
  MOUSE_EVENTS,
  MouseEventBus,
  UI_ZONES_VALUES,
  mouseDownOutside,
  type Task,
} from "@renderer/core"

const state = {
  down: false,
  ticking: false,
}

export function handleGlobalInput(
  mouseBus: MouseEventBus,
  focusManager: FocusManager,
  keybindingService: KeybindingService
) {
  bindDocumentMousedownEvnet(focusManager, mouseBus)
  bindDocumentFocusEvents(focusManager)

  bindDocumentMousedownEvnetForDrag(mouseBus)
  bindDocumentMousemoveEvnetForDrag(mouseBus)
  bindDocumentMouseupEvnetForDrag(mouseBus)
  bindDocumentMouseleaveEvnetForDrag(mouseBus)

  bindDocumentKeydownEvent(focusManager, keybindingService)
}

//

function bindDocumentMousedownEvnet(focusManager: FocusManager, mouseBus: MouseEventBus) {
  document.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement

    const activeItem = UI_ZONES_VALUES.find((item) => target.closest(item.dom))
    if (activeItem) {
      focusManager.setFocusedZone(activeItem.id)
      // Update focusedTask only when the clicked zone has a task.
      // For zones without a task (e.g. MENU_ITEM, WINDOW),
      // keep the previously focused task.
      if (activeItem.task !== "") focusManager.setFocusedTask(activeItem.task as Task)
    }

    UI_ZONES_VALUES.forEach((item) => {
      if (item !== activeItem) {
        mouseBus.emit(mouseDownOutside(item.id), e)
      }
    })

    focusManager.syncFocus()
  })
}

// Keyboard navigation moves focus without any mousedown, so the zone has to be
// re-read from focus events too. focusout fires before the next element is
// focused, hence the microtask: it lets activeElement settle before we look.
function bindDocumentFocusEvents(focusManager: FocusManager) {
  const sync = () => queueMicrotask(() => focusManager.syncFocus())

  document.addEventListener("focusin", sync)
  document.addEventListener("focusout", sync)
}

//

function bindDocumentMousedownEvnetForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return
    state.down = true
    mouseBus.emit(MOUSE_EVENTS.DOWN, e)
  })
}

function bindDocumentMousemoveEvnetForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mousemove", (e) => {
    if (!state.ticking) {
      state.ticking = true
      window.requestAnimationFrame(() => {
        mouseBus.emit(MOUSE_EVENTS.MOVE, e)
        state.ticking = false
      })
    }
  })
}

function bindDocumentMouseupEvnetForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mouseup", (e) => {
    if (state.down) {
      mouseBus.emit(MOUSE_EVENTS.UP, e)
      state.down = false
    }
  })
}

function bindDocumentMouseleaveEvnetForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mouseleave", (e) => {
    if (state.down) state.down = false
    mouseBus.emit(MOUSE_EVENTS.LEAVE, e)
  })
}

//

function bindDocumentKeydownEvent(focusManager: FocusManager, keybindingService: KeybindingService) {
  document.addEventListener("keydown", (e) => {
    // Which binding applies is answered from the context keys, and focus events
    // publish those on a microtask. Settle it first so a key pressed right after
    // focus moved is resolved against where focus actually is.
    focusManager.syncFocus()

    keybindingService.handleKeyEvent(e)
  })
}
