import "reflect-metadata"
import { app, BrowserWindow } from "electron"
import path from "path"
import { Container } from "inversify"

import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabRepository from "@main/modules/contracts/ITabRepository"
import type IDialogManager from "@main/modules/contracts/IDialogManager"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"
import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type ITabUtils from "./modules/contracts/ITabUtils"
import type IFileWatcher from "./modules/contracts/IFileWatcher"
import type ISideRepository from "./modules/contracts/ISideRepository"
import type IWindowRepository from "./modules/contracts/IWindowRepository"
import type IWindowUtils from "./modules/contracts/IWindowUtils"
import type ISettingsRepository from "./modules/contracts/ISettingsRepository"
import type ISettingsUtils from "./modules/contracts/ISettingsUtils"

import {
  TAB_SESSION_PATH,
  TREE_SESSION_PATH,
  SIDE_SESSION_PATH,
  WINDOW_SESSION_PATH,
  SETTINGS_SESSION_PATH,
} from "./constants/file_info"

import DI_KEYS from "./constants/di_keys"

import FileManager from "./modules/fs/FileManager"
import FileWatcher from "./modules/fs/FileWatcher"
import dialogManager from "./modules/ui/dialogManager"

import TabRepository from "./modules/tab/TabRepository"
import TreeRepository from "./modules/tree/TreeRepository"
import SideRepository from "./modules/side/SideRepository"
import WindowRepository from "./modules/window/WindowRepository"
import SettingsRepository from "./modules/settings/SettingsRepository"

import FileService from "@services/FileService"
import TabService from "@services/TabService"
import TreeService from "@services/TreeService"
import SideService from "./services/SideService"
import SettingsService from "./services/SettingsService"

import TreeUtils from "./modules/tree/TreeUtils"
import TabUtils from "./modules/tab/TabUtils"
import WindowUtils from "./modules/window/WindowUtils"
import SettingsUtils from "./modules/settings/SettingsUtils"

export default class DIContainer {
  private static _instance: Container | null = null
  private static _mainWindow: BrowserWindow | null = null

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static init(mainWindow: BrowserWindow) {
    if (this._instance) throw new Error("DIContainer.init(mainWindow) must be called before getInstance()")
    this._mainWindow = mainWindow
  }

  public static getInstance(): Container {
    if (!this._mainWindow) throw new Error("DIContainer.init(mainWindow) must be called before getInstance()")

    if (!this._instance) {
      const container = new Container()

      container.bind<IFileManager>(DI_KEYS.FileManager).to(FileManager).inSingletonScope()
      container.bind<IDialogManager>(DI_KEYS.dialogManager).toConstantValue(dialogManager)
      container.bind<ITreeUtils>(DI_KEYS.TreeUtils).to(TreeUtils).inSingletonScope()
      container.bind<ITabUtils>(DI_KEYS.TabUtils).to(TabUtils).inSingletonScope()
      container.bind<IWindowUtils>(DI_KEYS.WindowUtils).to(WindowUtils).inSingletonScope()
      container.bind<ISettingsUtils>(DI_KEYS.SettingsUtils).to(SettingsUtils).inSingletonScope()

      const userDataPath = app.getPath("userData")
      const tabSessionPath = path.join(userDataPath, TAB_SESSION_PATH)
      const treeSessionPath = path.join(userDataPath, TREE_SESSION_PATH)
      const sideSessionPath = path.join(userDataPath, SIDE_SESSION_PATH)
      const windowSessionPath = path.join(userDataPath, WINDOW_SESSION_PATH)
      const settingsSessionPath = path.join(userDataPath, SETTINGS_SESSION_PATH)

      const fileManager = container.get<IFileManager>(DI_KEYS.FileManager)

      container
        .bind<ITabRepository>(DI_KEYS.TabRepository)
        .toDynamicValue(() => new TabRepository(tabSessionPath, fileManager))
        .inSingletonScope()

      container
        .bind<ITreeRepository>(DI_KEYS.TreeRepository)
        .toDynamicValue(() => new TreeRepository(treeSessionPath, fileManager))
        .inSingletonScope()

      container
        .bind<ISideRepository>(DI_KEYS.SideRepository)
        .toDynamicValue(() => new SideRepository(sideSessionPath, fileManager))
        .inSingletonScope()

      container
        .bind<IWindowRepository>(DI_KEYS.WindowRepository)
        .toDynamicValue(() => new WindowRepository(windowSessionPath, fileManager))
        .inSingletonScope()

      container
        .bind<ISettingsRepository>(DI_KEYS.SettingsRepository)
        .toDynamicValue(() => new SettingsRepository(settingsSessionPath, fileManager))
        .inSingletonScope()

      const tabUtils = container.get<ITabUtils>(DI_KEYS.TabUtils)
      const treeUtils = container.get<ITreeUtils>(DI_KEYS.TreeUtils)
      const tabRepository = container.get<ITabRepository>(DI_KEYS.TabRepository)
      const treeRepository = container.get<ITreeRepository>(DI_KEYS.TreeRepository)

      container
        .bind<IFileWatcher>(DI_KEYS.FileWatcher)
        .toDynamicValue(() => new FileWatcher(this._mainWindow!, tabUtils, treeUtils, tabRepository, treeRepository))
        .inSingletonScope()

      container.bind(DI_KEYS.FileService).to(FileService).inSingletonScope()
      container.bind(DI_KEYS.TabService).to(TabService).inSingletonScope()
      container.bind(DI_KEYS.TreeService).to(TreeService).inSingletonScope()
      container.bind(DI_KEYS.SideService).to(SideService).inSingletonScope()
      container.bind(DI_KEYS.SettingsService).to(SettingsService).inSingletonScope()

      this._instance = container
    }

    return this._instance
  }
}
