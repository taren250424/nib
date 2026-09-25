import "../../mocks/screen"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import FileWatcher from "@main/modules/fs/FileWatcher"
import FakeFileManager from "./FakeFileManager"
import FakeTabRepository from "../tab/FakeTabRepository"
import FakeTabUtils from "../tab/FakeTabUtils"
import FakeTreeRepository from "../tree/FakeTreeRepository"
import FakeTreeUtils from "../tree/FakeTreeUtils"
import FakeMainWindow from "../../mocks/FakeMainWindow"
import { buildDto } from "../../../renderer/modules/tree/treeHarness"
import { electronAPI } from "@shared/constants/electronAPI/electronAPI"

const DEBOUNCE = 300

let fileManager: FakeFileManager
let tabRepository: FakeTabRepository
let mainWindow: FakeMainWindow
let watcher: FileWatcher

/** Feeds the watcher what chokidar would, without a file system. */
function arrive(type: "add" | "remove", path: string, isDirectory = false) {
  const exposed = watcher as unknown as { _process: FileWatcher["_process"] }
  exposed._process(path, type, isDirectory)
}

const sent = () => mainWindow.webContents.send.mock.calls

beforeEach(async () => {
  vi.useFakeTimers()

  fileManager = new FakeFileManager()
  tabRepository = new FakeTabRepository("tab.json", fileManager)
  const treeRepository = new FakeTreeRepository("tree.json", fileManager)
  const treeUtils = new FakeTreeUtils()
  const tree = buildDto({ name: "root", children: [{ name: "readme.md" }] })
  treeUtils.setTree(tree)
  await treeRepository.setTreeSession(tree)
  fileManager.setPathExistence("tree.json", true)

  mainWindow = new FakeMainWindow()
  watcher = new FileWatcher(
    mainWindow as never,
    new FakeTabUtils(fileManager, tabRepository),
    treeUtils,
    tabRepository,
    treeRepository
  )
})

afterEach(() => {
  vi.useRealTimers()
})

describe("FileWatcher skip hold", () => {
  it("sends a change as a partial update once the debounce settles", async () => {
    arrive("add", "root/new.md")
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    expect(sent()).toHaveLength(1)
    const [event, , tree, updates] = sent()[0]
    expect(event).toBe(electronAPI.events.mainToRenderer.syncFromWatch)
    expect(tree).toBeNull()
    expect(updates).toEqual([{ type: "add", path: "root/new.md", isDirectory: false }])
  })

  // The hold is there to mute the app's own echoes, not to lose what someone
  // else did in the same half second.
  it("replays what arrived during a hold once the hold lifts", async () => {
    watcher.setSkipState(true)
    arrive("add", "root/from-explorer.md")
    await vi.advanceTimersByTimeAsync(DEBOUNCE * 2)
    expect(sent()).toHaveLength(0)

    watcher.setSkipState(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    expect(sent()).toHaveLength(1)
    expect(sent()[0][3]).toEqual([{ type: "add", path: "root/from-explorer.md", isDirectory: false }])
  })

  it("keeps holding while any hold is still on", async () => {
    watcher.setSkipState(true)
    watcher.setSkipState(true)
    arrive("add", "root/a.md")

    watcher.setSkipState(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(sent()).toHaveLength(0)

    watcher.setSkipState(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)
    expect(sent()).toHaveLength(1)
  })

  it("never turns a replayed batch into a full resync, however large", async () => {
    watcher.setSkipState(true)
    for (let i = 0; i < 40; i++) arrive("add", `root/moved/${i}.md`)
    watcher.setSkipState(false)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    const [, , tree, updates] = sent()[0]
    expect(tree).toBeNull()
    expect(updates).toHaveLength(40)
  })

  it("still falls back to a full resync for a large batch that was not held", async () => {
    for (let i = 0; i < 40; i++) arrive("add", `root/${i}.md`)
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    const [, , tree, updates] = sent()[0]
    expect(tree).not.toBeNull()
    expect(updates).toBeUndefined()
  })

  it("sends the open tabs without their content", async () => {
    fileManager.setFilecontent("root/readme.md", "# a very long document")
    fileManager.setPathExistence("root/readme.md", true)
    await tabRepository.setTabSession({
      activatedId: 0,
      data: [{ id: 0, filePath: "root/readme.md", isModified: false }],
    })
    fileManager.setPathExistence("tab.json", true)

    arrive("add", "root/new.md")
    await vi.advanceTimersByTimeAsync(DEBOUNCE)

    const tabs = sent()[0][1]
    expect(tabs.data).toHaveLength(1)
    expect(tabs.data[0].filePath).toBe("root/readme.md")
    expect(tabs.data[0].fileName).toBe("readme.md")
    expect(tabs.data[0].content).toBe("")
  })
})
