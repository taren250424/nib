import "./styles/index.scss"
import "@milkdown/theme-nord/style.css"
import 'simplebar/dist/simplebar.css'

import { DI } from "./constants"
import diContainer from "./diContainer"

// Registers the <velin-select> custom element before any module queries it.
import "./components/VelinSelect"

import { CommandQueue, ContextKeyService, FocusManager, ShortcutRegistry } from "./core"
import { Dispatcher } from "./dispatch"
import { EventEmitter } from "events"

import {
	MenuElements,
	TabEditorFacade,
	TreeFacade,
	SettingsFacade,
	SideFacade,
	InfoFacade,
	WindowFacade,
	ZoomManager,
} from "./modules"

import {
	handleContextKeys,
	handleGlobalInput,
	handleMenuItems,
	handleFileMenu,
	handleEditMenu,
	handleViewMenu,
	handleHelpMenu,
	handleInfo,
	handleLoad,
	handleSettings,
	handleSide,
	handleTabEditor,
	handleTree,
	handleWindow,
	handleSync,
} from "./handlers"

window.addEventListener("DOMContentLoaded", () => {
	const menuElements = diContainer.get<MenuElements>(DI.MenuElements)

	const commandQueue = diContainer.get<CommandQueue>(DI.CommandQueue)
	const focusManager = diContainer.get<FocusManager>(DI.FocusManager)
	const contextKeyService = diContainer.get<ContextKeyService>(DI.ContextKeyService)
	const zoomManager = diContainer.get<ZoomManager>(DI.ZoomManager)
	const shortcutRegistry = diContainer.get<ShortcutRegistry>(DI.ShortcutRegistry)

	const infoFacade = diContainer.get<InfoFacade>(DI.InfoFacade)
	const settingsFacade = diContainer.get<SettingsFacade>(DI.SettingsFacade)
	const tabEditorFacade = diContainer.get<TabEditorFacade>(DI.TabEditorFacade)
	const treeFacade = diContainer.get<TreeFacade>(DI.TreeFacade)
	const sideFacade = diContainer.get<SideFacade>(DI.SideFacade)
	const windowFacade = diContainer.get<WindowFacade>(DI.WindowFacade)

	const dispatcher = diContainer.get<Dispatcher>(DI.Dispatcher)
	const emitter = diContainer.get<EventEmitter>(DI.EventEmitter)

	handleContextKeys(focusManager, contextKeyService)
	handleGlobalInput(dispatcher, emitter, focusManager, shortcutRegistry)
	handleMenuItems(emitter, menuElements)
	handleFileMenu(dispatcher, shortcutRegistry, menuElements, settingsFacade, tabEditorFacade, treeFacade)
	handleEditMenu(dispatcher, shortcutRegistry, menuElements)
	handleViewMenu(shortcutRegistry, menuElements, zoomManager, sideFacade)
	handleHelpMenu(shortcutRegistry, menuElements, infoFacade)

	handleTabEditor(dispatcher, emitter, tabEditorFacade, shortcutRegistry)
	handleInfo(infoFacade)
	handleWindow(windowFacade, tabEditorFacade, treeFacade)
	handleTree(dispatcher, emitter, focusManager, treeFacade, shortcutRegistry)
	handleSide(emitter, sideFacade)
	handleSettings(dispatcher, settingsFacade)
	handleSync(commandQueue, tabEditorFacade, treeFacade)

	handleLoad(
		dispatcher,
		windowFacade,
		settingsFacade,
		tabEditorFacade,
		treeFacade,
		sideFacade,
		infoFacade,
		menuElements
	)

	window.rendererToMain.loadedRenderer()
})
