import "./styles/index.scss"
import "@milkdown/theme-nord/style.css"
import "simplebar/dist/simplebar.css"

import { DI } from "./constants"
import diContainer from "./diContainer"

// Registers the <velin-select> custom element before any module queries it.
import "./components/VelinSelect"

import {
  CommandQueue,
  CommandRegistry,
  ContextKeyService,
  FocusManager,
  KeybindingService,
  MouseEventBus,
} from "./core"
import { createCommandDescriptors } from "./commands"
import { KEYBINDINGS } from "./commands/keybindings"

import {
  CommandManager,
  FindReplaceManager,
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
  const focusManager = diContainer.get<FocusManager>(DI.FocusManager)
  const contextKeyService = diContainer.get<ContextKeyService>(DI.ContextKeyService)
  const zoomManager = diContainer.get<ZoomManager>(DI.ZoomManager)
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
  const findReplaceManager = diContainer.get<FindReplaceManager>(DI.FindReplaceManager)
  commandRegistry.registerAll(
    createCommandDescriptors({
      commandManager,
      findReplaceManager,
      zoomManager,
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
  const run = createCommandRunner(commandRegistry, focusManager)

  handleContextKeys(focusManager, contextKeyService)
  handleGlobalInput(mouseBus, focusManager, keybindingService)
  handleMenuItems(mouseBus, menuElements)
  handleCommandMenus(commandRegistry, contextKeyService, menuElements)
  handleShortcutLabels(menuElements, treeFacade.renderer.elements, tabEditorFacade.renderer.elements)

  handleTabEditor(run, mouseBus, commandRegistry, focusManager, tabEditorFacade)
  handleInfo(infoFacade)
  handleWindow(windowFacade, run)
  handleTree(run, mouseBus, commandRegistry, focusManager, treeFacade)
  handleSide(mouseBus, sideFacade)
  handleSettings(run, settingsFacade)
  handleSync(commandQueue, tabEditorFacade, treeFacade, commandManager)

  handleLoad(run, windowFacade, settingsFacade, tabEditorFacade, treeFacade, sideFacade, infoFacade, menuElements)

  window.rendererToMain.loadedRenderer()
})
