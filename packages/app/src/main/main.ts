import { app, BrowserWindow, Menu } from "electron"
import started from "electron-squirrel-startup"
import path from "node:path"
import { fileURLToPath } from "url"

import type IFileManager from "./modules/contracts/IFileManager"
import type ITreeRepository from "./modules/contracts/ITreeRepository"
import type ITabRepository from "./modules/contracts/ITabRepository"
import type ITreeUtils from "./modules/contracts/ITreeUtils"
import type IDialogManager from "./modules/contracts/IDialogManager"
import type ITabUtils from "./modules/contracts/ITabUtils"
import type IFileWatcher from "./modules/contracts/IFileWatcher"
import type ISideRepository from "./modules/contracts/ISideRepository"
import type IWindowRepository from "./modules/contracts/IWindowRepository"
import type IWindowUtils from "./modules/contracts/IWindowUtils"
import type ISettingsRepository from "./modules/contracts/ISettingsRepository"
import type ISettingsUtils from "./modules/contracts/ISettingsUtils"

import registerFileHandlers from "./handlers/fileHandlers"
import registerLoadHandlers from "./handlers/loadHandlers"
import registerWindowHandlers from "./handlers/windowHandlers"
import registerExitHandlers from "./handlers/exitHandlers"
import registerEditHandlers from "./handlers/editHandlers"
import registerTabHandlers from "./handlers/tabHandlers"
import registerTreeHandlers from "./handlers/treeHandlers"
import registerWatchHandlers from "./handlers/watchHandlers"
import registerSideHandlers from "./handlers/sideHandlers"
import registerSettingsHandlers from "./handlers/settingsHandlers"

import FileService from "./services/FileService"
import TabService from "./services/TabService"
import TreeService from "./services/TreeService"
import SideService from "./services/SideService"
import SettingsService from "./services/SettingsService"

import DI_KEYS from "./constants/di_keys"
import DIContainer from "./DiContainer"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const createMainWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: "hidden",
    show: false,
    icon: path.join(__dirname, "..", "shared", "logo", "logo_256"), // Icon for the app window.
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      sandbox: false,
    },
  })

  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow.webContents.session.setSpellCheckerLanguages([])
    mainWindow.webContents.session.setSpellCheckerEnabled(false)
  })

  return mainWindow
}

const loadUrl = (mainWindow: BrowserWindow) => {
  if (typeof MAIN_WINDOW_VITE_DEV_SERVER_URL !== "undefined") {
    // forge - dev
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools({ mode: "detach" })
  } else {
    // electron-builder - prod
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"))
  }
}

const bootstrapApp = () => {
  const mainWindow = createMainWindow()
  Menu.setApplicationMenu(null)

  DIContainer.init(mainWindow)
  const diContainer = DIContainer.getInstance()

  const fileManager = diContainer.get<IFileManager>(DI_KEYS.FileManager)
  const fileWatcher = diContainer.get<IFileWatcher>(DI_KEYS.FileWatcher)
  const dialogManager = diContainer.get<IDialogManager>(DI_KEYS.dialogManager)

  const windowRepository = diContainer.get<IWindowRepository>(DI_KEYS.WindowRepository)
  const settingsRepository = diContainer.get<ISettingsRepository>(DI_KEYS.SettingsRepository)
  const sideRepository = diContainer.get<ISideRepository>(DI_KEYS.SideRepository)
  const tabRepository = diContainer.get<ITabRepository>(DI_KEYS.TabRepository)
  const treeRepository = diContainer.get<ITreeRepository>(DI_KEYS.TreeRepository)

  const windowUtils = diContainer.get<IWindowUtils>(DI_KEYS.WindowUtils)
  const settingsUtils = diContainer.get<ISettingsUtils>(DI_KEYS.SettingsUtils)
  const tabUtils = diContainer.get<ITabUtils>(DI_KEYS.TabUtils)
  const treeUtils = diContainer.get<ITreeUtils>(DI_KEYS.TreeUtils)

  const fileService = diContainer.get<FileService>(DI_KEYS.FileService)
  const tabService = diContainer.get<TabService>(DI_KEYS.TabService)
  const treeService = diContainer.get<TreeService>(DI_KEYS.TreeService)
  const sideService = diContainer.get<SideService>(DI_KEYS.SideService)
  const settingsService = diContainer.get<SettingsService>(DI_KEYS.SettingsService)

  registerLoadHandlers(
    mainWindow,
    fileManager,
    fileWatcher,
    windowRepository,
    settingsRepository,
    sideRepository,
    tabRepository,
    treeRepository,
    windowUtils,
    settingsUtils,
    tabUtils,
    treeUtils
  )
  registerWindowHandlers(mainWindow, windowRepository)
  registerFileHandlers(mainWindow, fileService)
  registerExitHandlers(mainWindow, fileManager, dialogManager, tabRepository, treeRepository)
  registerTabHandlers(mainWindow, tabService)
  registerTreeHandlers(treeService, dialogManager)
  registerSideHandlers(sideService)
  registerEditHandlers()
  registerWatchHandlers(fileWatcher)
  registerSettingsHandlers(settingsService)

  loadUrl(mainWindow)
}

if (started) app.quit()
app.on("ready", bootstrapApp)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit()
  }
})
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    bootstrapApp()
  }
})
