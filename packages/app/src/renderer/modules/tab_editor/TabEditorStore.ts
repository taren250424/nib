import type { TabEditorViewModel } from "../../viewmodels/TabEditorViewModel"
import type { TabEditorDto } from "@shared/dto/TabEditorDto"
import type { SearchOptions } from "./search"
import { injectable } from "inversify"

@injectable()
export class TabEditorStore {
  private _idToTabEditorViewModel: Map<number, TabEditorViewModel> = new Map()

  private _activeTabId = -1
  private _activeTabIndex = -1
  private _contextTabId = -1

  private _findReplaceOpen = false
  private _findDirection: "up" | "down" = "down"

  private _searchQuery = ""
  private _replaceQuery = ""

  private _searchOptions: SearchOptions = {
    matchCase: false,
    wholeWord: false,
    useRegex: false,
  }

  private _autoSaveMode = "off"

  //

  toTabEditorViewModel(dto: TabEditorDto): TabEditorViewModel {
    return {
      id: dto.id,
      isModified: dto.isModified,
      filePath: dto.filePath,
      fileName: dto.fileName,
      isBinary: dto.isBinary,
      initialContent: this._idToTabEditorViewModel.get(dto.id)!.initialContent,
    }
  }

  //

  get activeTabId() {
    return this._activeTabId
  }

  set activeTabId(id: number) {
    this._activeTabId = id
  }

  get activeTabIndex() {
    return this._activeTabIndex
  }

  set activeTabIndex(index: number) {
    this._activeTabIndex = index
  }

  get contextTabId() {
    return this._contextTabId
  }

  set contextTabId(id: number) {
    this._contextTabId = id
  }

  removeContextTabId() {
    this._contextTabId = -1
  }

  //

  get idToTabEditorViewModel(): ReadonlyMap<number, TabEditorViewModel> {
    return this._idToTabEditorViewModel
  }

  getTabEditorViewModelById(id: number) {
    return this._idToTabEditorViewModel.get(id)!
  }

  setTabEditorViewModelById(id: number, viewModel: TabEditorViewModel) {
    this._idToTabEditorViewModel.set(id, viewModel)
  }

  deleteTabEditorViewModelById(id: number) {
    this._idToTabEditorViewModel.delete(id)
  }

  //

  get findReplaceOpen() {
    return this._findReplaceOpen
  }

  set findReplaceOpen(open: boolean) {
    this._findReplaceOpen = open
  }

  get findDirection() {
    return this._findDirection
  }

  set findDirection(direction: "up" | "down") {
    this._findDirection = direction
  }

  get searchQuery() {
    return this._searchQuery
  }

  set searchQuery(query: string) {
    this._searchQuery = query
  }

  get replaceQuery() {
    return this._replaceQuery
  }

  set replaceQuery(query: string) {
    this._replaceQuery = query
  }

  get searchOptions() {
    return this._searchOptions
  }

  get autoSaveMode() {
    return this._autoSaveMode
  }

  set autoSaveMode(mode: string) {
    this._autoSaveMode = mode
  }
}
