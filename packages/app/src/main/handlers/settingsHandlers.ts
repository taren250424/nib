import type { SettingsDto } from "@shared/dto/SettingsDto"
import { ipcMain } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import SettingsService from "@main/services/SettingsService"

export default function registerSettingsHandlers(settingsService: SettingsService) {
  ipcMain.handle(electronAPI.events.rendererToMain.syncSettingsSessionFromRenderer, async (_e, dto: SettingsDto) => {
    await settingsService.syncSettingsSession(dto)
  })
}
