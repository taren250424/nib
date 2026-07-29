import type { MenuElements } from "@renderer/modules/menu/MenuElements"
import { Dispatcher } from "../../dispatch"

export function handleEditMenu(dispatcher: Dispatcher, menuElements: MenuElements) {
	bindMenuEvents(dispatcher, menuElements)
}

function bindMenuEvents(dispatcher: Dispatcher, menuElements: MenuElements) {
	const { undo, redo, cut, copy, paste, find, replace } = menuElements

	undo.addEventListener("click", async () => {
		await dispatcher.dispatch("undo", "menu")
	})

	redo.addEventListener("click", async () => {
		await dispatcher.dispatch("redo", "menu")
	})

	cut.addEventListener("click", async () => {
		await dispatcher.dispatch("cut", "menu")
	})

	copy.addEventListener("click", async () => {
		await dispatcher.dispatch("copy", "menu")
	})

	paste.addEventListener("click", async () => {
		await dispatcher.dispatch("paste", "menu")
	})

	find.addEventListener("click", async () => {
		await dispatcher.dispatch("toggleFindReplace", "menu", false)
	})

	replace.addEventListener("click", async () => {
		await dispatcher.dispatch("toggleFindReplace", "menu", true)
	})
}
