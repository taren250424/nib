import "@milkdown/theme-nord/style.css"

import { CUSTOM_EVENTS, DOM } from "../constants"
import { TabEditorFacade } from "../modules"
import { Dispatcher } from "@renderer/dispatch"
import { EventEmitter } from "events"
import { debounce } from "@renderer/utils"

export function handleTabEditor(dispatcher: Dispatcher, emitter: EventEmitter, tabEditorFacade: TabEditorFacade) {
	bindContainerClickEvent(dispatcher, tabEditorFacade)

	bindContextmenuToggleEvents(emitter, tabEditorFacade)
	bindContextmenuClickEvents(dispatcher, tabEditorFacade)

	bindFindReplaceEvents(dispatcher, tabEditorFacade)

	bindMousedownEventsForDrag(emitter, tabEditorFacade)
	bindMousemoveEventsForDrag(emitter, tabEditorFacade)
	bindMouseupEventsForDrag(emitter, tabEditorFacade)
	bindMouseleaveEventsForDrag(emitter, tabEditorFacade)

	bindWindowBlurEventForAutoSave(tabEditorFacade)
}

//

function bindContainerClickEvent(dispatcher: Dispatcher, tabEditorFacade: TabEditorFacade) {
	const { tabContainer } = tabEditorFacade.renderer.elements

	tabContainer.addEventListener("click", async (e) => {
		const target = e.target as HTMLElement
		const tabBox = target.closest(DOM.SELECTOR_TAB) as HTMLElement
		if (!tabBox) return

		if (target.tagName === "BUTTON") {
			const id = parseInt(tabBox.dataset[DOM.DATASET_ATTR_TAB_ID]!)
			await dispatcher.dispatch("closeTab", "button", id)
		} else if (target.tagName === "SPAN") {
			const id = parseInt(tabBox.dataset[DOM.DATASET_ATTR_TAB_ID]!)
			tabEditorFacade.activateTabEditorById(id)
		}
	})
}

//

function bindContextmenuToggleEvents(emitter: EventEmitter, tabEditorFacade: TabEditorFacade) {
	const { tabContainer } = tabEditorFacade.renderer.elements

	tabContainer.addEventListener("contextmenu", (e: MouseEvent) => {
		tabEditorFacade.handleShowContextmenu(e)
	})

	emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.OUT.TAB_CONTEXTMENU, () => {
		tabEditorFacade.handleHideContextmenu()
	})
}

function bindContextmenuClickEvents(dispatcher: Dispatcher, tabEditorFacade: TabEditorFacade) {
	const { tabContextClose, tabContextCloseOthers, tabContextCloseRight, tabContextCloseAll } =
		tabEditorFacade.renderer.elements

	tabContextClose.addEventListener("click", async () => {
		await dispatcher.dispatch("closeTab", "context-menu", tabEditorFacade.contextTabId)
		tabEditorFacade.handleHideContextmenu()
	})

	tabContextCloseOthers.addEventListener("click", async () => {
		await dispatcher.dispatch("closeOtherTabs", "context-menu")
		tabEditorFacade.handleHideContextmenu()
	})

	tabContextCloseRight.addEventListener("click", async () => {
		await dispatcher.dispatch("closeTabsToRight", "context-menu")
		tabEditorFacade.handleHideContextmenu()
	})

	tabContextCloseAll.addEventListener("click", async () => {
		await dispatcher.dispatch("closeAllTabs", "context-menu")
		tabEditorFacade.handleHideContextmenu()
	})
}

//

function bindFindReplaceEvents(dispatcher: Dispatcher, tabEditorFacade: TabEditorFacade) {
	const {
		findUp,
		findDown,
		replaceCurrent,
		replaceAll,
		closeFindReplace,
		findInput,
		replaceInput,
		findOptionCase,
		findOptionWord,
		findOptionRegex,
	} = tabEditorFacade.renderer.elements

	// Prevent buttons from stealing focus from the input when clicked.
	// This keeps the find/replace input focused so keyboard shortcuts (e.g. Enter) work correctly.
	;[findUp, findDown, replaceCurrent, replaceAll, findOptionCase, findOptionWord, findOptionRegex].forEach((btn) => {
		btn.addEventListener("mousedown", (e) => e.preventDefault())
	})

	findOptionCase.addEventListener("click", async () => {
		await dispatcher.dispatch("toggleSearchOption", "menu", "matchCase")
	})

	findOptionWord.addEventListener("click", async () => {
		await dispatcher.dispatch("toggleSearchOption", "menu", "wholeWord")
	})

	findOptionRegex.addEventListener("click", async () => {
		await dispatcher.dispatch("toggleSearchOption", "menu", "useRegex")
	})

	findUp.addEventListener("click", async () => {
		await dispatcher.dispatch("find", "menu", "up")
	})

	findDown.addEventListener("click", async () => {
		await dispatcher.dispatch("find", "menu", "down")
	})

	replaceCurrent.addEventListener("click", async () => {
		await dispatcher.dispatch("replace", "menu")
	})

	replaceAll.addEventListener("click", async () => {
		await dispatcher.dispatch("replaceAll", "menu")
	})

	closeFindReplace.addEventListener("click", async () => {
		await dispatcher.dispatch("closeFindReplace", "menu")
	})

	findInput.addEventListener(
		"input",
		debounce(async (e: Event) => {
			const value = (e.target as HTMLInputElement).value
			await dispatcher.dispatch("searchQueryChanged", "menu", value)
		}, 300)
	)

	replaceInput.addEventListener("input", async (e: Event) => {
		const value = (e.target as HTMLInputElement).value
		await dispatcher.dispatch("replaceQueryChanged", "menu", value)
	})
}

//

function bindWindowBlurEventForAutoSave(tabEditorFacade: TabEditorFacade) {
	window.addEventListener("blur", () => {
		tabEditorFacade.notifyWindowBlurForAutoSave()
	})
}

//

function bindMousedownEventsForDrag(emitter: EventEmitter, tabEditorFacade: TabEditorFacade) {
	emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.DEFAULT, (e) => {
		const target = e.target as HTMLElement
		const tab = target.closest(DOM.SELECTOR_TAB) as HTMLElement
		if (!tab) return
		tabEditorFacade.initDrag(tab, e.clientX, e.clientY)
	})
}

function bindMousemoveEventsForDrag(emitter: EventEmitter, tabEditorFacade: TabEditorFacade) {
	emitter.on(CUSTOM_EVENTS.MOUSE_MOVE.DEFAULT, (e) => {
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

function bindMouseupEventsForDrag(emitter: EventEmitter, tabEditorFacade: TabEditorFacade) {
	// EventEmitter neither awaits nor catches async listeners, so the drop has to
	// terminate its own promise or a failing session sync becomes an unhandled rejection.
	emitter.on(CUSTOM_EVENTS.MOUSE_UP.DEFAULT, () => {
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

function bindMouseleaveEventsForDrag(emitter: EventEmitter, tabEditorFacade: TabEditorFacade) {
	emitter.on(CUSTOM_EVENTS.MOUSE_LEAVE.DEFAULT, () => {
		if (tabEditorFacade.isDrag()) {
			tabEditorFacade.clearDrag()
		}
	})
}
