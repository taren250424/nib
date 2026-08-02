import "./styles/index.scss"
import "simplebar/dist/simplebar.css"

import { DI } from "./constants"
import diContainer from "./diContainer"

// Registers the <velin-select> custom element before any module queries it.
import "./components/VelinSelect"

import {
  CommandQueue,
  CommandRegistry,
  ContextKeyService,
  FocusTracker,
  KeybindingService,
  MouseEventBus,
} from "./core"
import { createCommandDescriptors } from "./commands"
import { KEYBINDINGS } from "./commands/keybindings"

import {
  CommandManager,
  FindReplaceController,
  MenuElements,
  TabEditorFacade,
  TreeFacade,
  SettingsFacade,
  SideFacade,
  InfoFacade,
  WindowFacade,
  ZoomController,
} from "./modules"

import {
  handleContextKeys,
  handleGlobalInput,
  handleMenuItems,
  handleCommandMenus,
  handleShortcutLabels,
  handleInfo,
  handleLoad,
  handleSettings,
  handleSide,
  handleTabEditor,
  handleTree,
  handleWindow,
  handleSync,
  createCommandRunner,
} from "./handlers"

window.addEventListener("DOMContentLoaded", () => {
  const menuElements = diContainer.get<MenuElements>(DI.MenuElements)

  const commandQueue = diContainer.get<CommandQueue>(DI.CommandQueue)
  const focusTracker = diContainer.get<FocusTracker>(DI.FocusTracker)
  const contextKeyService = diContainer.get<ContextKeyService>(DI.ContextKeyService)
  const zoomController = diContainer.get<ZoomController>(DI.ZoomController)
  const keybindingService = diContainer.get<KeybindingService>(DI.KeybindingService)

  const infoFacade = diContainer.get<InfoFacade>(DI.InfoFacade)
  const settingsFacade = diContainer.get<SettingsFacade>(DI.SettingsFacade)
  const tabEditorFacade = diContainer.get<TabEditorFacade>(DI.TabEditorFacade)
  const treeFacade = diContainer.get<TreeFacade>(DI.TreeFacade)
  const sideFacade = diContainer.get<SideFacade>(DI.SideFacade)
  const windowFacade = diContainer.get<WindowFacade>(DI.WindowFacade)

  const mouseBus = diContainer.get<MouseEventBus>(DI.MouseEventBus)

  // Commands and their bindings must exist before any input can reach one,
  // including the ones session load runs.
  const commandRegistry = diContainer.get<CommandRegistry>(DI.CommandRegistry)
  const commandManager = diContainer.get<CommandManager>(DI.CommandManager)
  const findReplaceController = diContainer.get<FindReplaceController>(DI.FindReplaceController)
  commandRegistry.registerAll(
    createCommandDescriptors({
      commandManager,
      findReplaceController,
      zoomController,
      sideFacade,
      infoFacade,
      menuElements,
      tabEditorFacade,
      treeFacade,
    })
  )
  keybindingService.registerAll(KEYBINDINGS)

  // How the remaining UI elements — buttons, the find widget, tree clicks, a
  // drop — reach a command now that the keyboard and the menus have tables.
  const run = createCommandRunner(commandRegistry, focusTracker)

  handleContextKeys(focusTracker, contextKeyService)
  handleGlobalInput(mouseBus, focusTracker, keybindingService)
  handleMenuItems(mouseBus, menuElements)
  handleCommandMenus(commandRegistry, contextKeyService, menuElements)
  handleShortcutLabels(menuElements, treeFacade.renderer.elements, tabEditorFacade.renderer.elements)

  handleTabEditor(run, mouseBus, commandRegistry, focusTracker, tabEditorFacade)
  handleInfo(infoFacade)
  handleWindow(windowFacade, run)
  handleTree(run, mouseBus, commandRegistry, focusTracker, treeFacade)
  handleSide(mouseBus, sideFacade)
  handleSettings(run, settingsFacade)
  handleSync(commandQueue, tabEditorFacade, treeFacade, commandManager)

  handleLoad(run, windowFacade, settingsFacade, tabEditorFacade, treeFacade, sideFacade, infoFacade, menuElements)

  window.rendererToMain.loadedRenderer()
})
