import type ClipboardMode from "@shared/types/ClipboardMode"
import type TrashMap from "@shared/types/TrashMap"
import type { RendererToMainAPI } from "@shared/preload"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { SideDto } from "@shared/dto/SideDto"
import type { SettingsDto } from "@shared/dto/SettingsDto"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import { ipcRenderer } from "electron"

const rendererToMain: RendererToMainAPI = {
  loadedRenderer: () => {
    ipcRenderer.send(electronAPI.events.rendererToMain.loadedRenderer)
  },
  showMainWindow: () => {
    ipcRenderer.send(electronAPI.events.rendererToMain.showMainWindow)
  },

  requestMinimizeWindow: () => {
    ipcRenderer.send(electronAPI.events.rendererToMain.requestMinimizeWindow)
  },
  requestMaximizeWindow: () => {
    ipcRenderer.send(electronAPI.events.rendererToMain.requestMaximizeWindow)
  },
  requestUnmaximizeWindow: () => {
    ipcRenderer.send(electronAPI.events.rendererToMain.requestUnmaximizeWindow)
  },

  newTab: () => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.newTab)
  },
  openFile: (filePath?: string) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.openFile, filePath)
  },
  openDirectory: (data?: TreeDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.openDirectory, data)
  },
  save: (data: TabEditorDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.save, data)
  },
  tempSave: (data: TabEditorDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.tempSave, data)
  },
  saveAs: (data: TabEditorDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.saveAs, data)
  },
  saveAll: (data: TabEditorsDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.saveAll, data)
  },

  closeTab: (data: TabEditorDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.closeTab, data)
  },
  closeOtherTabs: (tabEditorDtoToExclude: TabEditorDto, tabEditorsDto: TabEditorsDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.closeOtherTabs, tabEditorDtoToExclude, tabEditorsDto)
  },
  closeTabsToRight: (tabEditorDtoAsReference: TabEditorDto, tabEditorsDto: TabEditorsDto) => {
    return ipcRenderer.invoke(
      electronAPI.events.rendererToMain.closeTabsToRight,
      tabEditorDtoAsReference,
      tabEditorsDto
    )
  },
  closeAllTabs: (data: TabEditorsDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.closeAllTabs, data)
  },

  exit: (tabSessionData: TabEditorsDto, treeSessionData: TreeDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.exit, tabSessionData, treeSessionData)
  },

  cutEditor: (text: string) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.cutEditor, text)
  },
  copyEditor: (text: string) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.copyEditor, text)
  },
  copyTree: (src: string, dest: string) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.copyTree, src, dest)
  },
  pasteEditor: () => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.pasteEditor)
  },
  pasteTree: (targetDto: TreeDto, selectedDtos: TreeDto[], clipboardMode: ClipboardMode) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.pasteTree, targetDto, selectedDtos, clipboardMode)
  },

  rename: (prePath: string, newPath: string) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.rename, prePath, newPath)
  },
  delete: (arr: string[]) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.delete, arr)
  },
  undo_delete: (trashMap: TrashMap[] | null) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.undo_delete, trashMap)
  },
  deletePermanently: (path: string) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.deletePermanently, path)
  },
  create: (path: string, directory: boolean) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.create, path, directory)
  },

  syncSettingsSessionFromRenderer: (dto: SettingsDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.syncSettingsSessionFromRenderer, dto)
  },
  syncSideSessionFromRenderer: (dto: SideDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.syncSideSessionFromRenderer, dto)
  },
  syncTabSessionFromRenderer: (tabEditorsDto: TabEditorsDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.syncTabSessionFromRenderer, tabEditorsDto)
  },
  syncTreeSessionFromRenderer: (treeDto: TreeDto) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.syncTreeSessionFromRenderer, treeDto)
  },
  getSyncedTreeSession: () => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.getSyncedTreeSession)
  },

  setWatchSkipState: (state: boolean) => {
    return ipcRenderer.invoke(electronAPI.events.rendererToMain.setWatchSkipState, state)
  },
}

export default rendererToMain
