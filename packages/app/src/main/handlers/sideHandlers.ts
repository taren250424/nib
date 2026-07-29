import type { SideDto } from "@shared/dto/SideDto"
import { ipcMain } from "electron"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"
import SideService from "@main/services/SideService"

export default function registerSideHandlers(sideService: SideService) {
  ipcMain.handle(electronAPI.events.rendererToMain.syncSideSessionFromRenderer, async (_e, dto: SideDto) => {
    await sideService.syncSideSession(dto)
  })
}
