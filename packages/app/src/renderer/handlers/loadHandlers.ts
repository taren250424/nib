import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { WindowDto } from "@shared/dto/WindowDto"
import type { SettingsDto } from "@shared/dto/SettingsDto"
import type { SideDto } from "@shared/dto/SideDto"

import { DOM } from "@renderer/constants"

import { toggleSide } from "@renderer/actions"
import { Dispatcher } from "../dispatch"

import {
  MenuElements,
  TabEditorFacade,
  TreeFacade,
  SettingsFacade,
  WindowFacade,
  SideFacade,
  InfoFacade,
} from "../modules"

export function handleLoad(
  dispatcher: Dispatcher,
  windowFacade: WindowFacade,
  settingsFacade: SettingsFacade,
  tabEditorFacade: TabEditorFacade,
  treeFacade: TreeFacade,
  sideFacade: SideFacade,
  infoFacade: InfoFacade,
  menuElements: MenuElements
) {
  window.mainToRenderer.session(
    async (
      windowDto: WindowDto,
      settingsDto: SettingsDto,
      sideDto: SideDto,
      tabEditorsDto: TabEditorsDto,
      treeDto: TreeDto,
      version: string
    ) => {
      processWindowSession(windowFacade, windowDto)
      processSettingsSession(settingsFacade, settingsDto)
      processSideSession(sideFacade, sideDto)
      processTabEditorSession(tabEditorFacade, tabEditorsDto)
      processTreeSession(treeFacade, treeDto)

      initSettings(dispatcher, settingsFacade)
      initSide(sideFacade, menuElements)
      initInfo(infoFacade, version)
      initWindow(windowFacade)

      window.rendererToMain.showMainWindow()
    }
  )
}

//

function processWindowSession(facade: WindowFacade, dto: WindowDto) {
  if (dto) {
    facade.setWindowMaximizeState(dto.maximize)
  }
}

function processSettingsSession(facade: SettingsFacade, dto: SettingsDto) {
  if (dto) {
    const settingsViewModel = facade.toSettingsViewModel(dto)
    facade.setSettingsValue(settingsViewModel)
  }
}

function processSideSession(facade: SideFacade, dto: SideDto) {
  if (dto) {
    facade.setSideOpenState(dto.open)
    facade.setSideWidth(dto.width)
  }
}

async function processTabEditorSession(facade: TabEditorFacade, dto: TabEditorsDto) {
  if (dto) {
    await facade.loadTabs(dto)
  }
}

function processTreeSession(facade: TreeFacade, dto: TreeDto) {
  if (dto) {
    const viewModel = facade.toTreeViewModel(dto)
    facade.render(viewModel)
    facade.setRootTreeViewModel(viewModel)
  }
}

//

async function initSettings(dispatcher: Dispatcher, settingsFacade: SettingsFacade) {
  const { menus, contents } = settingsFacade.renderer.elements
  menus[0].classList.add(DOM.CLASS_SELECTED)
  contents[0].style.display = "block"

  const viewModel = settingsFacade.getSettingsValue()
  settingsFacade.render(viewModel)
  await dispatcher.dispatch("applySettings", "programmatic", viewModel)
}

function initSide(sideFacade: SideFacade, menuElements: MenuElements) {
  toggleSide(menuElements, sideFacade)
}

function initInfo(infoFacade: InfoFacade, version: string) {
  infoFacade.elements.version.textContent = version
}

function initWindow(windowFacade: WindowFacade) {
  if (windowFacade.isWindowMaximize()) windowFacade.renderUnMaximizeButtonSvg()
  else windowFacade.renderMaximizeButtonSvg()
}
