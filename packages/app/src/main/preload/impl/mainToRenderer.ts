import type { MainToRendererAPI } from "@shared/preload"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto, TreePartialUpdate } from "@shared/dto/TreeDto"
import type { SideDto } from "@shared/dto/SideDto"
import type { WindowDto } from "@shared/dto/WindowDto"
import type { SettingsDto } from "@shared/dto/SettingsDto"
import { ipcRenderer } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"

const mainToRenderer: MainToRendererAPI = {
  session: (
    callback: (
      windowDto: WindowDto,
      settingsDto: SettingsDto,
      sideDto: SideDto,
      tabEditorsDto: TabEditorsDto,
      treeDto: TreeDto,
      version: string
    ) => void
  ) => {
    ipcRenderer.on(
      electronAPI.events.mainToRenderer.session,
      (_e, windowDto, settingsDto, sideDto, tabEditorsDto, treeDto, version) => {
        callback(windowDto, settingsDto, sideDto, tabEditorsDto, treeDto, version)
      }
    )
  },
  syncFromWatch: (
    callback: (tabEditorsDto: TabEditorsDto, treeDto: TreeDto, partialUpdates?: TreePartialUpdate[]) => void
  ) => {
    ipcRenderer.on(electronAPI.events.mainToRenderer.syncFromWatch, (_e, tabEditorsDto, treeDto, partialUpdates) => {
      callback(tabEditorsDto, treeDto, partialUpdates)
    })
  },
  onMaximizeWindow: (callback: () => void) => {
    ipcRenderer.on(electronAPI.events.mainToRenderer.onMaximizeWindow, () => {
      callback()
    })
  },
  onUnmaximizeWindow: (callback: () => void) => {
    ipcRenderer.on(electronAPI.events.mainToRenderer.onUnmaximizeWindow, () => {
      callback()
    })
  },
}

export default mainToRenderer
