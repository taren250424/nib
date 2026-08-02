// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { DOM } from "@renderer/constants"

import { createCommandHarness, type CommandHarness } from "../modules/commandHarness"
import { buildDto, loadTree, wrapperOf } from "../modules/tree/treeHarness"

/**
 * root
 *  ├ docs/
 *  │   └ a.md
 *  └ readme.md
 */
const SAMPLE = buildDto({
  name: "root",
  children: [{ name: "docs", children: [{ name: "a.md" }] }, { name: "readme.md" }],
})

const DOCS = "root/docs"
const A = "root/docs/a.md"
const README = "root/readme.md"

let harness: CommandHarness

beforeEach(() => {
  harness = createCommandHarness()
  loadTree(harness.tree, SAMPLE)
})

const indexOf = (path: string) => harness.tree.facade.getFlattenIndexByPath(path)

/**
 * A file appearing or disappearing outside the app.
 *
 * The watcher is the only thing besides a command that touches the tree and the
 * tabs, and it shares their queue for exactly that reason — which nothing
 * checked until this file.
 */
describe("watcher sync", () => {
  it("puts a file that appeared into the tree", async () => {
    await harness.fireWatchSync(null, null, [{ type: "add", path: `${DOCS}/new.md`, isDirectory: false }])

    expect(indexOf(`${DOCS}/new.md`)).toBeDefined()
    expect(harness.ipc.syncTreeSessionFromRenderer).toHaveBeenCalled()
  })

  it("takes a file that disappeared out of it", async () => {
    await harness.fireWatchSync(null, null, [{ type: "remove", path: A, isDirectory: false }])

    expect(indexOf(A)).toBeUndefined()
  })

  it("ignores a removal of something already gone", async () => {
    await harness.fireWatchSync(null, null, [{ type: "remove", path: "root/never.md", isDirectory: false }])

    expect(indexOf(README)).toBeDefined()
  })

  it("closes the tab of a file that is no longer listed", async () => {
    await harness.tabController.performOpenFile(README)
    const view = harness.tabEditor.facade.getTabEditorViewByPath(README)!

    await harness.fireWatchSync({ activatedId: -1, data: [] }, null, undefined)

    expect(harness.tabEditor.facade.getTabEditorViewIndexById(view.getId())).toBe(-1)
  })

  // A whole new tree: the marks are painted from paths, and the outgoing tree's
  // paths would land on same-named nodes of the incoming one.
  it("drops the selection and the clipboard before rendering a new tree", async () => {
    harness.tree.facade.setSelection([indexOf(README)!])
    harness.treeController.performCutTree()
    expect(wrapperOf(harness.tree, README)!.classList.contains(DOM.CLASS_CUT)).toBe(true)

    await harness.fireWatchSync(null, buildDto({ name: "root", children: [{ name: "readme.md" }] }), undefined)

    expect(harness.tree.facade.getSelectedPaths()).toEqual([])
    expect(harness.tree.facade.getClipboardPaths()).toEqual([])
    expect(wrapperOf(harness.tree, README)!.classList.contains(DOM.CLASS_CUT)).toBe(false)
  })

  // The history stacks name the outgoing tree the same way the clipboard does:
  // an undo surviving the resync would revert a delete against paths the new
  // tree may have recreated under the same names.
  it("drops the tree history with them", async () => {
    harness.tree.facade.setSelection([indexOf(A)!])
    await harness.treeController.performDelete()
    expect(harness.contextKeyService.get("canUndoTree")).toBe(true)

    await harness.fireWatchSync(null, buildDto({ name: "root", children: [{ name: "readme.md" }] }), undefined)

    expect(harness.contextKeyService.get("canUndoTree")).toBe(false)
    expect(harness.contextKeyService.get("canRedoTree")).toBe(false)
  })

  /**
   * The guarantee the shared queue exists for.
   *
   * A command spends most of its life waiting on Main, and the watcher fires
   * whenever it likes. If the sync ran in that gap it would mutate the tree
   * between a command's capture and its apply.
   */
  it("waits for a command in flight instead of cutting in", async () => {
    let releasePaste: (value: { result: boolean; data: string[] }) => void = () => undefined
    harness.ipc.pasteTree.mockImplementationOnce(
      () => new Promise((resolve) => (releasePaste = resolve)) as ReturnType<typeof harness.ipc.pasteTree>
    )

    harness.tree.facade.setSelection([indexOf(A)!])
    harness.treeController.performCutTree()
    harness.tree.facade.setSelection([indexOf("root")!])
    const paste = harness.treeController.performPasteTreeWithShortcut()

    // Run the paste up to the point where it is waiting on Main. Firing before
    // this proves nothing: the command would not be on the queue yet.
    for (let tick = 0; tick < 20 && !harness.ipc.pasteTree.mock.calls.length; tick++) await Promise.resolve()
    expect(harness.ipc.pasteTree).toHaveBeenCalled()

    const sync = harness.fireWatchSync(null, null, [{ type: "add", path: "root/outside.md", isDirectory: false }])
    for (let tick = 0; tick < 10; tick++) await Promise.resolve()

    expect(indexOf("root/outside.md")).toBeUndefined()

    releasePaste({ result: true, data: ["root/a.md"] })
    await Promise.all([paste, sync])

    expect(indexOf("root/outside.md")).toBeDefined()
  })

  it("keeps the queue alive when a sync throws", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    harness.ipc.syncTreeSessionFromRenderer.mockRejectedValueOnce(new Error("session write failed"))

    await harness.fireWatchSync(null, null, [{ type: "add", path: "root/one.md", isDirectory: false }])
    await harness.fireWatchSync(null, null, [{ type: "add", path: "root/two.md", isDirectory: false }])

    expect(indexOf("root/two.md")).toBeDefined()
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})
