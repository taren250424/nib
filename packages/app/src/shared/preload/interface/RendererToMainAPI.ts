import type Response from "@shared/types/Response"
import type { TreeDto } from "@shared/dto/TreeDto"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type ClipboardMode from "@shared/types/ClipboardMode"
import type TrashMap from "@shared/types/TrashMap"
import type { SideDto } from "@shared/dto/SideDto"
import type { SettingsDto } from "@shared/dto/SettingsDto"

export default interface RendererToMainAPI {
  loadedRenderer: () => void
  showMainWindow: () => void

  requestMinimizeWindow: () => void
  requestMaximizeWindow: () => void
  requestUnmaximizeWindow: () => void

  newTab: () => Promise<Response<number>>
  openFile: (filePath?: string) => Promise<Response<TabEditorDto>>
  openDirectory: (data?: TreeDto) => Promise<Response<TreeDto>>
  save: (data: TabEditorDto) => Promise<Response<TabEditorDto>>
  tempSave: (data: TabEditorDto) => Promise<Response<void>>
  saveAs: (data: TabEditorDto) => Promise<Response<TabEditorDto>>
  saveAll: (data: TabEditorsDto) => Promise<Response<TabEditorsDto>>

  closeTab: (data: TabEditorDto) => Promise<Response<void>>
  closeOtherTabs: (tabEditorDtoToExclude: TabEditorDto, tabEditorsDto: TabEditorsDto) => Promise<Response<boolean[]>>
  closeTabsToRight: (
    tabEditorDtoAsReference: TabEditorDto,
    tabEditorsDto: TabEditorsDto
  ) => Promise<Response<boolean[]>>
  closeAllTabs: (data: TabEditorsDto) => Promise<Response<boolean[]>>

  exit: (tabSessionData: TabEditorsDto, treeSessionData: TreeDto) => Promise<void>

  cutEditor: (text: string) => Promise<void>
  copyEditor: (text: string) => Promise<void>
  pasteEditor: () => Promise<string>
  copyTree: (src: string, dest: string) => Promise<void>
  pasteTree: (targetDto: TreeDto, selectedDtos: TreeDto[], clipboardMode: ClipboardMode) => Promise<Response<string[]>>

  rename: (prePath: string, newPath: string) => Promise<Response<string>>
  delete: (arr: string[]) => Promise<Response<TrashMap[] | null>>
  undo_delete: (trashMap: TrashMap[] | null) => Promise<boolean>
  deletePermanently: (path: string) => Promise<void>
  create: (path: string, directory: boolean) => Promise<Response<string>>

  syncSettingsSessionFromRenderer: (dto: SettingsDto) => Promise<boolean>
  syncSideSessionFromRenderer: (dto: SideDto) => Promise<boolean>
  syncTabSessionFromRenderer: (dto: TabEditorsDto) => Promise<boolean>
  syncTreeSessionFromRenderer: (dto: TreeDto) => Promise<boolean>
  getSyncedTreeSession: () => Promise<TreeDto | null>

  setWatchSkipState: (state: boolean) => Promise<void>
}
