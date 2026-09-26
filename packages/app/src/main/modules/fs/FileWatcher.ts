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

/**
 * Names the watcher never reports, whatever directory they sit in.
 *
 * The tree scan shows every entry it finds, dotfiles included, so the watcher
 * has to report them too or the tree only catches up on the next open. Only
 * VCS internals and OS clutter are left out: they churn constantly and nobody
 * opens them in an editor. This is the same short list VS Code and Zed use.
 */
const WATCH_IGNORED_NAMES = new Set([".git", ".svn", ".hg", ".DS_Store", "desktop.ini", "Thumbs.db"])

export function isWatchIgnored(filePath: string) {
  return WATCH_IGNORED_NAMES.has(path.basename(filePath))
}

@injectable()
export default class FileWatcher {
  private watcher: FSWatcher | null = null

  // Counter, not a boolean: commands acquire (true) / release (false) the skip,
  // so one command's delayed release cannot re-enable the watcher while another
  // command is still running.
  private skipCount = 0

  private timer: NodeJS.Timeout | null = null
  private pendingUpdates: TreePartialUpdate[] = []

  /**
   * What arrived while a skip hold was on.
   *
   * A hold is there to keep the app's own edits from echoing back as external
   * changes, but the watcher cannot tell an echo from a file Explorer dropped
   * in during the same half second. Dropping everything lost the latter until
   * the next restart. So the hold only postpones: once it lifts, these are
   * replayed as a partial batch, and the renderer's apply steps already treat
   * an echo as a no-op — a node that is present, or a path that is gone.
   */
  private heldUpdates: TreePartialUpdate[] = []

  /**
   * Whether the pending batch carries replayed events. Such a batch never falls
   * back to a full resync: an app move of a big folder echoes as hundreds of
   * events, and a full resync would throw away the selection and the undo
   * history of the very edit that caused them.
   */
  private pendingHasHeld = false

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
    if (state) {
      this.skipCount++
      return
    }

    this.skipCount = Math.max(0, this.skipCount - 1)

    if (this.skipCount === 0 && this.heldUpdates.length > 0) {
      this.pendingUpdates.push(...this.heldUpdates)
      this.heldUpdates = []
      this.pendingHasHeld = true
      this._schedule()
    }
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
      ignored: isWatchIgnored,
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
    const update: TreePartialUpdate = { type, path: changedPath, isDirectory }

    if (this.skipCount > 0) {
      this.heldUpdates.push(update)
      return
    }

    this.pendingUpdates.push(update)
    this._schedule()
  }

  private _schedule() {
    if (this.timer) clearTimeout(this.timer)

    this.timer = setTimeout(() => {
      const updates = this.pendingUpdates
      const hasHeld = this.pendingHasHeld
      this.pendingUpdates = []
      this.pendingHasHeld = false
      this.timer = null

      this._flush(updates, hasHeld).catch((err) => {
        console.error("[FileWatcher] sync failed:", err)
      })
    }, this.debounceTime)
  }

  private async _flush(updates: TreePartialUpdate[], hasHeld: boolean) {
    const tabSession = await this.tabRepository.readTabSession()
    const newTabSession = tabSession ? await this.tabUtils.syncSessionWithFs(tabSession) : null
    if (newTabSession) await this.tabRepository.writeTabSession(newTabSession)

    // The renderer only closes tabs whose files went away and renames the rest;
    // it never looks at their content, so none is read or sent.
    const tabDto = newTabSession ? await this.tabUtils.toTabEditorsDto(newTabSession, { readContent: false }) : null

    const treeSession = await this.treeRepository.readTreeSession()
    const newTreeSession = treeSession ? await this.treeUtils.syncWithFs(treeSession) : null
    if (newTreeSession) await this.treeRepository.writeTreeSession(newTreeSession)

    if (updates.length > this.partialThreshold && !hasHeld) {
      // Too much changed to patch: the renderer rebuilds from the synced tree.
      const treeDto = newTreeSession ? (newTreeSession as TreeDto) : null
      this.mainWindow.webContents.send(electronAPI.events.mainToRenderer.syncFromWatch, tabDto, treeDto)
    } else {
      // Partial updates. The renderer applies them and syncs its tree back, so
      // the session written above is only a stopgap until that arrives.
      this.mainWindow.webContents.send(electronAPI.events.mainToRenderer.syncFromWatch, tabDto, null, updates)
    }
  }
}
