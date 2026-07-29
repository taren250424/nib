import { CUSTOM_EVENTS } from "@renderer/constants"
import { FocusManager, ShortcutRegistry, UI_ZONES_VALUES, type Task } from "@renderer/core"
import type { Dispatcher } from "@renderer/dispatch"
import { EventEmitter } from "events"

const state = {
	down: false,
	ticking: false,
}

export function handleGlobalInput(
	dispatcher: Dispatcher,
	emitter: EventEmitter,
	focusManager: FocusManager,
	shortcutRegistry: ShortcutRegistry
) {
	bindDocumentMousedownEvnet(focusManager, emitter)
	bindDocumentFocusEvents(focusManager)

	bindDocumentMousedownEvnetForDrag(emitter)
	bindDocumentMousemoveEvnetForDrag(emitter)
	bindDocumentMouseupEvnetForDrag(emitter)
	bindDocumentMouseleaveEvnetForDrag(emitter)

	bindDocumentKeydownEvent(shortcutRegistry)
	bindShortcutEvent(dispatcher, shortcutRegistry)
}

//

function bindDocumentMousedownEvnet(focusManager: FocusManager, emitter: EventEmitter) {
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
				emitter.emit(item.outEvent, e)
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

function bindDocumentMousedownEvnetForDrag(emitter: EventEmitter) {
	document.addEventListener("mousedown", (e) => {
		if (e.button !== 0) return
		state.down = true
		emitter.emit(CUSTOM_EVENTS.MOUSE_DOWN.DEFAULT, e)
	})
}

function bindDocumentMousemoveEvnetForDrag(emitter: EventEmitter) {
	document.addEventListener("mousemove", (e) => {
		if (!state.ticking) {
			state.ticking = true
			window.requestAnimationFrame(() => {
				emitter.emit(CUSTOM_EVENTS.MOUSE_MOVE.DEFAULT, e)
				state.ticking = false
			})
		}
	})
}

function bindDocumentMouseupEvnetForDrag(emitter: EventEmitter) {
	document.addEventListener("mouseup", (e) => {
		if (state.down) {
			emitter.emit(CUSTOM_EVENTS.MOUSE_UP.DEFAULT, e)
			state.down = false
		}
	})
}

function bindDocumentMouseleaveEvnetForDrag(emitter: EventEmitter) {
	document.addEventListener("mouseleave", (e) => {
		if (state.down) state.down = false
		emitter.emit(CUSTOM_EVENTS.MOUSE_LEAVE.DEFAULT, e)
	})
}

//

function bindDocumentKeydownEvent(shortcutRegistry: ShortcutRegistry) {
	document.addEventListener("keydown", (e) => {
		shortcutRegistry.handleKeyEvent(e)
	})
}

function bindShortcutEvent(dispatcher: Dispatcher, shortcutRegistry: ShortcutRegistry) {
	shortcutRegistry.register("ESC", async () => await dispatcher.dispatch("esc", "shortcut"))
	shortcutRegistry.register("ENTER", async () => await dispatcher.dispatch("enter", "shortcut"))
	shortcutRegistry.register("Shift+ENTER", async () => await dispatcher.dispatch("shiftEnter", "shortcut"))
}
