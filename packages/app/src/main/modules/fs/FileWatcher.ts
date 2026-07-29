import type { FSWatcher } from "chokidar"
import type ITabUtils from "../contracts/ITabUtils"
import type ITreeUtils from "../contracts/ITreeUtils"
import type ITabRepository from "../contracts/ITabRepository"
import type ITreeRepository from "../contracts/ITreeRepository"
import type { TreeDto, TreePartialUpdate } from "@shared/dto/TreeDto"
import path from "path"
import { BrowserWindow } from "electron"
import { watch } from "chokidar"
import { injectable } from "inversify"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"

@injectable()
export default class FileWatcher {
  private watcher: FSWatcher | null = null

  // Counter, not a boolean: commands acquire (true) / release (false) the skip,
  // so one command's delayed release cannot re-enable the watcher while another
  // command is still running.
  private skipCount = 0

  private timer: NodeJS.Timeout | null = null
  private pendingUpdates: TreePartialUpdate[] = []
  private readonly debounceTime = 300
  private readonly partialThreshold = 20

  constructor(
    private mainWindow: BrowserWindow,
    private tabUtils: ITabUtils,
    private treeUtils: ITreeUtils,
    private tabRepository: ITabRepository,
    private treeRepository: ITreeRepository
  ) {}

  setSkipState(state: boolean) {
    if (state) this.skipCount++
    else this.skipCount = Math.max(0, this.skipCount - 1)
  }

  async watch(dirPath: string) {
    this._watch(dirPath)
  }

  async close() {
    await this.watcher?.close()
    this.watcher = null
  }

  private async _watch(dirPath: string) {
    await this.watcher?.close()
    this.watcher = watch(dirPath, {
      persistent: true,
      ignoreInitial: true,
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 200,
        pollInterval: 100,
      },
      ignored: (filePath: string) => {
        const base = path.basename(filePath)
        return base.startsWith(".") || base === "desktop.ini" || base === "Thumbs.db"
      },
    })

    this.watcher.on("add", (changedPath) => this._process(changedPath, "add", false))
    this.watcher.on("addDir", (changedPath) => this._process(changedPath, "add", true))
    this.watcher.on("unlink", (changedPath) => this._process(changedPath, "remove", false))
    this.watcher.on("unlinkDir", (changedPath) => this._process(changedPath, "remove", true))

    this.watcher.on("error", (err) => {
      console.error("[watcher error]", err)
    })
  }

  private _process(changedPath: string, type: "add" | "remove", isDirectory: boolean) {
    if (this.skipCount > 0) return

    this.pendingUpdates.push({ type, path: changedPath, isDirectory })

    if (this.timer) clearTimeout(this.timer)

    this.timer = setTimeout(async () => {
      const updates = [...this.pendingUpdates]
      this.pendingUpdates = []
      this.timer = null

      const tabSession = await this.tabRepository.readTabSession()
      const newTabSession = tabSession ? await this.tabUtils.syncSessionWithFs(tabSession) : null
      if (newTabSession) await this.tabRepository.writeTabSession(newTabSession)

      const tabDto = newTabSession ? await this.tabUtils.toTabEditorsDto(newTabSession) : null

      if (updates.length > this.partialThreshold) {
        // Fallback to full sync
        const treeSession = await this.treeRepository.readTreeSession()
        const newTreeSession = treeSession ? await this.treeUtils.syncWithFs(treeSession) : null
        if (newTreeSession) await this.treeRepository.writeTreeSession(newTreeSession)

        const treeDto = newTreeSession ? (newTreeSession as TreeDto) : null
        this.mainWindow.webContents.send(electronAPI.events.mainToRenderer.syncFromWatch, tabDto, treeDto)
      } else {
        // Send partial updates. No need to sync the entire tree session on Main side here,
        // the Renderer will sync back its updated state if needed, or Main will sync later.
        // However, to keep Main's session file consistent, we should still sync if it exists.
        const treeSession = await this.treeRepository.readTreeSession()
        if (treeSession) {
          const newTreeSession = await this.treeUtils.syncWithFs(treeSession)
          if (newTreeSession) await this.treeRepository.writeTreeSession(newTreeSession)
        }

        this.mainWindow.webContents.send(electronAPI.events.mainToRenderer.syncFromWatch, tabDto, null, updates)
      }
    }, this.debounceTime)
  }
}
