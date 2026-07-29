import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"
import type IFileManager from "../modules/contracts/IFileManager"
import type ITabRepository from "../modules/contracts/ITabRepository"
import type ITabUtils from "../modules/contracts/ITabUtils"
import type IFileWatcher from "@main/modules/contracts/IFileWatcher"
import type ISideRepository from "@main/modules/contracts/ISideRepository"
import type IWindowRepository from "@main/modules/contracts/IWindowRepository"
import type IWindowUtils from "@main/modules/contracts/IWindowUtils"
import type ISettingsRepository from "@main/modules/contracts/ISettingsRepository"
import type ISettingsUtils from "@main/modules/contracts/ISettingsUtils"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { SideDto } from "@shared/dto/SideDto"
import { app, BrowserWindow } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { getBoundsByWindowSession } from "../actions/windowActions"

export async function loadedRenderer(
  mainWindow: BrowserWindow,
  fileManager: IFileManager,
  fileWatcher: IFileWatcher,
  windowRepository: IWindowRepository,
  settingsRepository: ISettingsRepository,
  sideRepository: ISideRepository,
  tabRepository: ITabRepository,
  treeRepository: ITreeRepository,
  windowUtils: IWindowUtils,
  settingsUtils: ISettingsUtils,
  tabUtils: ITabUtils,
  treeUtils: ITreeUtils
) {
  // session.
  const windowSession = await windowRepository.readWindowSession()
  const windowBoundsModel = getBoundsByWindowSession(windowSession)
  mainWindow.setBounds({
    x: windowBoundsModel.x,
    y: windowBoundsModel.y,
    width: windowBoundsModel.width,
    height: windowBoundsModel.height,
  })
  if (windowSession?.maximize) mainWindow.maximize()

  const settingsSession = await settingsRepository.readSettingsSession()

  const sideSession = await sideRepository.readSideSession()

  const tabSession = await tabRepository.readTabSession()
  const newTabSession = tabSession ? await tabUtils.syncSessionWithFs(tabSession) : null
  if (newTabSession) await tabRepository.writeTabSession(newTabSession)

  const treeSession = await treeRepository.readTreeSession()
  const newTreeSession = treeSession ? await treeUtils.syncWithFs(treeSession) : null
  if (newTreeSession) await treeRepository.writeTreeSession(newTreeSession)

  const windowDto = windowSession ? windowUtils.toWindowDto(windowSession) : null
  const settingsDto = settingsSession ? settingsUtils.toSettingsDto(settingsSession) : null
  const sideDto = sideSession ? (sideSession as SideDto) : null
  const tabDto = newTabSession ? await tabUtils.toTabEditorsDto(newTabSession) : null
  const treeDto = newTreeSession ? (newTreeSession as TreeDto) : null

  const version = app.getVersion()

  mainWindow.webContents.send(
    electronAPI.events.mainToRenderer.session,
    windowDto,
    settingsDto,
    sideDto,
    tabDto,
    treeDto,
    version
  )
  fileManager.cleanTrash()

  if (newTreeSession) fileWatcher.watch(newTreeSession.path)

  // info.
  mainWindow.webContents.send(electronAPI.events.mainToRenderer.info, version)
}
