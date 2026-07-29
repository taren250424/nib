import type { SideDto } from "@shared/dto/SideDto"
import type { TreeDto, TreePartialUpdate } from "../../dto/TreeDto"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { WindowDto } from "@shared/dto/WindowDto"
import type { SettingsDto } from "@shared/dto/SettingsDto"

export default interface MainToRendererAPI {
  session: (
    callback: (
      windowDto: WindowDto,
      settingsDto: SettingsDto,
      sideDto: SideDto,
      tabEditorsDto: TabEditorsDto,
      treeDto: TreeDto,
      version: string
    ) => void
  ) => void
  syncFromWatch: (
    callback: (tabEditorsDto: TabEditorsDto, treeDto: TreeDto, partialUpdates?: TreePartialUpdate[]) => void
  ) => void
  onMaximizeWindow: (callback: () => void) => void
  onUnmaximizeWindow: (callback: () => void) => void
}
