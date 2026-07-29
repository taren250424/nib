import "reflect-metadata"
import { DI } from "./constants"
import { Container } from "inversify"

import { ContextKeyService } from "./core/ContextKeyService"
import { FocusManager } from "./core/FocusManager"
import { ShortcutRegistry } from "./core/ShortcutRegistry"
import { CommandQueue } from "./core/CommandQueue"

import { MenuElements } from "./modules/menu/MenuElements"

import { TabEditorFacade } from "./modules/tab_editor/TabEditorFacade"
import { TabEditorStore } from "./modules/tab_editor/TabEditorStore"
import { TabEditorRenderer } from "./modules/tab_editor/TabEditorRenderer"
import { TabEditorElements } from "./modules/tab_editor/TabEditorElements"
import { TabDragManager } from "./modules/tab_editor/TabDragManager"

import { SideFacade } from "./modules/side/SideFacade"
import { SideStore } from "./modules/side/SideStore"
import { SideRenderer } from "./modules/side/SideRenderer"
import { SideElements } from "./modules/side/SideElements"
import { SideDragManager } from "./modules/side/SideDragManager"

import { TreeFacade } from "./modules/tree/TreeFacade"
import { TreeStore } from "./modules/tree/TreeStore"
import { TreeRenderer } from "./modules/tree/TreeRenderer"
import { TreeElements } from "./modules/tree/TreeElements"
import { TreeDragManager } from "./modules/tree/TreeDragManager"

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

import { ZoomManager } from "./modules/zoom/ZoomManager"

import { CommandManager } from "./modules/CommandManager"
import { Dispatcher } from "./dispatch"
import { EventEmitter } from 'events';

const diContainer = new Container()

diContainer.bind(DI.FocusManager).to(FocusManager).inSingletonScope()
diContainer.bind(DI.ContextKeyService).to(ContextKeyService).inSingletonScope()
diContainer.bind(DI.ShortcutRegistry).to(ShortcutRegistry).inSingletonScope()

diContainer.bind(DI.MenuElements).to(MenuElements).inSingletonScope()

diContainer.bind(DI.TabEditorFacade).to(TabEditorFacade).inSingletonScope()
diContainer.bind(DI.TabEditorStore).to(TabEditorStore).inSingletonScope()
diContainer.bind(DI.TabEditorRenderer).to(TabEditorRenderer).inSingletonScope()
diContainer.bind(DI.TabEditorElements).to(TabEditorElements).inSingletonScope()
diContainer.bind(DI.TabDragManager).to(TabDragManager).inSingletonScope()

diContainer.bind(DI.SideFacade).to(SideFacade).inSingletonScope()
diContainer.bind(DI.SideStore).to(SideStore).inSingletonScope()
diContainer.bind(DI.SideRenderer).to(SideRenderer).inSingletonScope()
diContainer.bind(DI.SideElements).to(SideElements).inSingletonScope()
diContainer.bind(DI.SideDragManager).to(SideDragManager).inSingletonScope()

diContainer.bind(DI.TreeFacade).to(TreeFacade).inSingletonScope()
diContainer.bind(DI.TreeStore).to(TreeStore).inSingletonScope()
diContainer.bind(DI.TreeRenderer).to(TreeRenderer).inSingletonScope()
diContainer.bind(DI.TreeElements).to(TreeElements).inSingletonScope()
diContainer.bind(DI.TreeDragManager).to(TreeDragManager).inSingletonScope()

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

diContainer.bind(DI.ZoomManager).to(ZoomManager).inSingletonScope()

diContainer.bind(DI.CommandQueue).to(CommandQueue).inSingletonScope()
diContainer.bind(DI.CommandManager).to(CommandManager).inSingletonScope()
diContainer.bind(DI.Dispatcher).to(Dispatcher).inSingletonScope()
diContainer.bind(DI.EventEmitter).to(EventEmitter).inSingletonScope()

export default diContainer
