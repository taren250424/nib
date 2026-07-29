import "@milkdown/theme-nord/style.css"

import { exit as actExit } from "../../actions"
import { MenuElements, TabEditorFacade, TreeFacade, SettingsFacade } from "@renderer/modules"
import { Dispatcher } from "../../dispatch"

export function handleFileMenu(
	dispatcher: Dispatcher,
	menueElements: MenuElements,
	settingsFacade: SettingsFacade,
	tabEditorFacade: TabEditorFacade,
	treeFacade: TreeFacade
) {
	bindMenuEvents(dispatcher, menueElements, settingsFacade, tabEditorFacade, treeFacade)
}

function bindMenuEvents(
	dispatcher: Dispatcher,
	menuElements: MenuElements,
	settingsFacade: SettingsFacade,
	tabEditorFacade: TabEditorFacade,
	treeFacade: TreeFacade
) {
	const { newTab, openFile, openDirectory, save, saveAs, saveAll, settings, exit } = menuElements

	newTab.addEventListener("click", async () => {
		await dispatcher.dispatch("newTab", "menu")
	})

	openFile.addEventListener("click", async () => {
		await dispatcher.dispatch("openFile", "menu")
	})

	openDirectory.addEventListener("click", async () => {
		await dispatcher.dispatch("openDirectoryByDialog", "menu")
	})

	save.addEventListener("click", async () => {
		await dispatcher.dispatch("save", "menu")
	})

	saveAs.addEventListener("click", async () => {
		await dispatcher.dispatch("saveAs", "menu")
	})

	saveAll.addEventListener("click", async () => {
		await dispatcher.dispatch("saveAll", "menu")
	})

	settings.addEventListener("click", () => {
		settingsFacade.openSettings()
	})

	exit.addEventListener("click", () => {
		actExit(tabEditorFacade, treeFacade)
	})
}
