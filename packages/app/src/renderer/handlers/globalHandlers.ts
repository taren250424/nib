import {
  FocusTracker,
  KeybindingService,
  MOUSE_EVENTS,
  MouseEventBus,
  UI_ZONES_VALUES,
  mouseDownOutside,
} from "@renderer/core"

const state = {
  down: false,
  ticking: false,
}

export function handleGlobalInput(
  mouseBus: MouseEventBus,
  focusTracker: FocusTracker,
  keybindingService: KeybindingService
) {
  bindDocumentMousedownEvent(focusTracker, mouseBus)
  bindDocumentFocusEvents(focusTracker)

  bindDocumentMousedownEventForDrag(mouseBus)
  bindDocumentMousemoveEventForDrag(mouseBus)
  bindDocumentMouseupEventForDrag(mouseBus)
  bindDocumentMouseleaveEventForDrag(mouseBus)

  bindDocumentKeydownEvent(focusTracker, keybindingService)
}

//

function bindDocumentMousedownEvent(focusTracker: FocusTracker, mouseBus: MouseEventBus) {
  document.addEventListener("mousedown", (e) => {
    const target = e.target as HTMLElement

    const activeItem = UI_ZONES_VALUES.find((item) => target.closest(item.dom))
    if (activeItem) {
      // Update focusedTask only when the clicked zone has a task.
      // For zones without a task (e.g. MENU_ITEM, WINDOW),
      // keep the previously focused task.
      if (activeItem.task !== "") focusTracker.setFocusedTask(activeItem.task)
    }

    UI_ZONES_VALUES.forEach((item) => {
      if (item !== activeItem) {
        mouseBus.emit(mouseDownOutside(item.id), e)
      }
    })

    focusTracker.syncFocus()
  })
}

// Keyboard navigation moves focus without any mousedown, so the zone has to be
// re-read from focus events too. focusout fires before the next element is
// focused, hence the microtask: it lets activeElement settle before we look.
function bindDocumentFocusEvents(focusTracker: FocusTracker) {
  const sync = () => queueMicrotask(() => focusTracker.syncFocus())

  document.addEventListener("focusin", sync)
  document.addEventListener("focusout", sync)
}

//

function bindDocumentMousedownEventForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return
    state.down = true
    mouseBus.emit(MOUSE_EVENTS.DOWN, e)
  })
}

function bindDocumentMousemoveEventForDrag(mouseBus: MouseEventBus) {
  // One MOVE per frame, carrying the last position of that frame. Emitting the
  // event that scheduled the frame would hand every consumer — ghost, insert
  // indicator, resizer — a position up to a frame old.
  let latest: MouseEvent | null = null

  document.addEventListener("mousemove", (e) => {
    latest = e
    if (!state.ticking) {
      state.ticking = true
      window.requestAnimationFrame(() => {
        state.ticking = false
        if (latest) mouseBus.emit(MOUSE_EVENTS.MOVE, latest)
      })
    }
  })
}

function bindDocumentMouseupEventForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mouseup", (e) => {
    if (state.down) {
      mouseBus.emit(MOUSE_EVENTS.UP, e)
      state.down = false
    }
  })
}

function bindDocumentMouseleaveEventForDrag(mouseBus: MouseEventBus) {
  document.addEventListener("mouseleave", (e) => {
    if (state.down) state.down = false
    mouseBus.emit(MOUSE_EVENTS.LEAVE, e)
  })
}

//

function bindDocumentKeydownEvent(focusTracker: FocusTracker, keybindingService: KeybindingService) {
  document.addEventListener("keydown", (e) => {
    // Which binding applies is answered from the context keys, and focus events
    // publish those on a microtask. Settle it first so a key pressed right after
    // focus moved is resolved against where focus actually is.
    focusTracker.syncFocus()

    keybindingService.handleKeyEvent(e)
  })
}
