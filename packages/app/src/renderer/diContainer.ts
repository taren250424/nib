import "reflect-metadata"
import { DI } from "./constants"
import { Container } from "inversify"

import { CommandRegistry } from "./core/CommandRegistry"
import { ContextKeyService } from "./core/ContextKeyService"
import { FocusTracker } from "./core/FocusTracker"
import { KeybindingService } from "./core/KeybindingService"
import { CommandQueue } from "./core/CommandQueue"
import { MouseEventBus } from "./core/EventBus"

import { MenuElements } from "./modules/menu/MenuElements"

import { TabEditorFacade } from "./modules/tab_editor/TabEditorFacade"
import { TabEditorStore } from "./modules/tab_editor/TabEditorStore"
import { TabEditorRenderer } from "./modules/tab_editor/TabEditorRenderer"
import { TabEditorElements } from "./modules/tab_editor/TabEditorElements"
import { TabDragState } from "./modules/tab_editor/TabDragState"
import { FindReplaceController } from "./modules/tab_editor/FindReplaceController"

import { SideFacade } from "./modules/side/SideFacade"
import { SideStore } from "./modules/side/SideStore"
import { SideRenderer } from "./modules/side/SideRenderer"
import { SideElements } from "./modules/side/SideElements"
import { SideDragState } from "./modules/side/SideDragState"

import { TreeFacade } from "./modules/tree/TreeFacade"
import { TreeStore } from "./modules/tree/TreeStore"
import { TreeRenderer } from "./modules/tree/TreeRenderer"
import { TreeElements } from "./modules/tree/TreeElements"
import { TreeDragState } from "./modules/tree/TreeDragState"

import { SettingsFacade } from "./modules/settings/SettingsFacade"
import { SettingsStore } from "./modules/settings/SettingsStore"
import { SettingsRenderer } from "./modules/settings/SettingsRenderer"
import { SettingsElements } from "./modules/settings/SettingsElements"

import { WindowFacade } from "./modules/window/WindowFacade"
import { WindowStore } from "./modules/window/WindowStore"
import { WindowRenderer } from "./modules/window/WindowRenderer"
import { WindowElements } from "./modules/window/WindowElements"

import { InfoFacade } from "./modules/info/InfoFacade"
import { InfoElements } from "./modules/info/InfoElements"

import { ZoomController } from "./modules/zoom/ZoomController"

import { CommandManager } from "./modules/CommandManager"

const diContainer = new Container()

diContainer.bind(DI.FocusTracker).to(FocusTracker).inSingletonScope()
diContainer.bind(DI.ContextKeyService).to(ContextKeyService).inSingletonScope()
diContainer.bind(DI.CommandRegistry).to(CommandRegistry).inSingletonScope()
diContainer.bind(DI.KeybindingService).to(KeybindingService).inSingletonScope()

diContainer.bind(DI.MenuElements).to(MenuElements).inSingletonScope()

diContainer.bind(DI.TabEditorFacade).to(TabEditorFacade).inSingletonScope()
diContainer.bind(DI.TabEditorStore).to(TabEditorStore).inSingletonScope()
diContainer.bind(DI.TabEditorRenderer).to(TabEditorRenderer).inSingletonScope()
diContainer.bind(DI.TabEditorElements).to(TabEditorElements).inSingletonScope()
diContainer.bind(DI.TabDragState).to(TabDragState).inSingletonScope()
diContainer.bind(DI.FindReplaceController).to(FindReplaceController).inSingletonScope()

diContainer.bind(DI.SideFacade).to(SideFacade).inSingletonScope()
diContainer.bind(DI.SideStore).to(SideStore).inSingletonScope()
diContainer.bind(DI.SideRenderer).to(SideRenderer).inSingletonScope()
diContainer.bind(DI.SideElements).to(SideElements).inSingletonScope()
diContainer.bind(DI.SideDragState).to(SideDragState).inSingletonScope()

diContainer.bind(DI.TreeFacade).to(TreeFacade).inSingletonScope()
diContainer.bind(DI.TreeStore).to(TreeStore).inSingletonScope()
diContainer.bind(DI.TreeRenderer).to(TreeRenderer).inSingletonScope()
diContainer.bind(DI.TreeElements).to(TreeElements).inSingletonScope()
diContainer.bind(DI.TreeDragState).to(TreeDragState).inSingletonScope()

diContainer.bind(DI.SettingsFacade).to(SettingsFacade).inSingletonScope()
diContainer.bind(DI.SettingsStore).to(SettingsStore).inSingletonScope()
diContainer.bind(DI.SettingsRenderer).to(SettingsRenderer).inSingletonScope()
diContainer.bind(DI.SettingsElements).to(SettingsElements).inSingletonScope()

diContainer.bind(DI.WindowFacade).to(WindowFacade).inSingletonScope()
diContainer.bind(DI.WindowStore).to(WindowStore).inSingletonScope()
diContainer.bind(DI.WindowRenderer).to(WindowRenderer).inSingletonScope()
diContainer.bind(DI.WindowElements).to(WindowElements).inSingletonScope()

diContainer.bind(DI.InfoFacade).to(InfoFacade).inSingletonScope()
diContainer.bind(DI.InfoElements).to(InfoElements).inSingletonScope()

diContainer.bind(DI.ZoomController).to(ZoomController).inSingletonScope()

diContainer.bind(DI.CommandQueue).to(CommandQueue).inSingletonScope()
diContainer.bind(DI.CommandManager).to(CommandManager).inSingletonScope()
diContainer.bind(DI.MouseEventBus).to(MouseEventBus).inSingletonScope()

export default diContainer
