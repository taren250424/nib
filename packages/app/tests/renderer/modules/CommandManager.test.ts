// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { DOM } from "@renderer/constants"

import { createCommandHarness, type CommandHarness } from "./commandHarness"
import { openTab, selectInEditor } from "./tab_editor/facadeHarness"
import { buildDto, loadTree, wrapperOf } from "./tree/treeHarness"

/**
 * root
 *  ├ docs/
 *  │   ├ sub/
 *  │   └ a.md
 *  └ readme.md
 */
const SAMPLE = buildDto({
  name: "root",
  children: [{ name: "docs", children: [{ name: "sub", children: [] }, { name: "a.md" }] }, { name: "readme.md" }],
})

const ROOT = "root"
const DOCS = "root/docs"
const SUB = "root/docs/sub"
const A = "root/docs/a.md"
const README = "root/readme.md"

const OPTIONS = { matchCase: false, wholeWord: false }

let harness: CommandHarness

beforeEach(() => {
  harness = createCommandHarness()
  loadTree(harness.tree, SAMPLE)
})

const indexOf = (path: string) => harness.tree.facade.getFlattenIndexByPath(path)!

/** Selects nodes and leaves the focus on the last of them, as clicking does. */
const select = (...paths: string[]) => harness.tree.facade.setSelection(paths.map(indexOf))

const canUndo = () => harness.contextKeyService.get("canUndoTree")
const canRedo = () => harness.contextKeyService.get("canRedoTree")

/** Cuts `sources`, then pastes onto `target` — the two-step the user performs. */
async function cutAndPaste(sources: string[], target: string) {
  select(...sources)
  harness.commandManager.performCutTree()

  select(target)
  await harness.commandManager.performPasteTreeWithShortcut()
}

/**
 * The rules a transfer follows, which live between the two facades and the queue
 * rather than in either of them, and so were eye-only until this harness.
 */
describe("CommandManager tree transfer", () => {
  it("refuses to move a folder into a folder inside it", async () => {
    await cutAndPaste([DOCS], SUB)

    expect(harness.ipc.pasteTree).not.toHaveBeenCalled()
    expect(harness.ipc.showWarning).toHaveBeenCalledOnce()
    expect(harness.ipc.showWarning.mock.calls[0][0]).toContain("cannot go inside itself")
  })

  // Filtered out before the edit exists, so there is nothing to undo and no
  // undo step spent on a move that never happened.
  it("takes no undo step for the folder it refused", async () => {
    await cutAndPaste([DOCS], SUB)

    expect(canUndo()).toBe(false)
  })

  it("leaves the cut in place when it could not be carried out", async () => {
    await cutAndPaste([DOCS], SUB)

    expect(harness.tree.facade.getClipboardPaths()).toEqual([DOCS])
    expect(harness.tree.facade.clipboardMode).toBe("cut")
  })

  it("moves the sources that can go and keeps back only the one that cannot", async () => {
    await cutAndPaste([DOCS, README], SUB)

    expect(harness.ipc.showWarning).toHaveBeenCalledOnce()
    expect(harness.ipc.pasteTree).toHaveBeenCalledOnce()

    const [, selected] = harness.ipc.pasteTree.mock.calls[0]
    expect(selected.map((dto) => dto.path)).toEqual([README])
    expect(canUndo()).toBe(true)
  })

  // Main drops sources that already live in the target, so this paste succeeds
  // having moved nothing.
  it("takes no undo step for a paste into the directory the source is already in", async () => {
    await cutAndPaste([README], ROOT)

    expect(harness.ipc.pasteTree).toHaveBeenCalledOnce()
    expect(canUndo()).toBe(false)
  })

  it("does not throw away the redo stack over a paste that moved nothing", async () => {
    await cutAndPaste([A], ROOT)
    await harness.commandManager.performUndoTree()
    expect(canRedo()).toBe(true)

    await cutAndPaste([README], ROOT)

    expect(canRedo()).toBe(true)
  })
})

/**
 * A drop is a move in its own right. Routing it through the clipboard used to
 * overwrite whatever had been cut or copied before, which is the half of the fix
 * only the screen could show.
 */
describe("CommandManager drag drop", () => {
  /** Picks nodes up and drops them on `target`, as the drag handlers do. */
  async function dropOn(sources: string[], target: string) {
    select(...sources)
    harness.tree.facade.setSelectedDragIndexByPath(target)
    await harness.commandManager.performMoveTreeFromDrag()
  }

  it("moves what was dragged", async () => {
    await dropOn([A], SUB)

    const [target, selected, mode] = harness.ipc.pasteTree.mock.calls[0]
    expect(target.path).toBe(SUB)
    expect(selected.map((dto) => dto.path)).toEqual([A])
    expect(mode).toBe("cut")
  })

  it("leaves a clipboard cut before it untouched", async () => {
    select(README)
    harness.commandManager.performCutTree()

    await dropOn([A], SUB)

    expect(harness.tree.facade.getClipboardPaths()).toEqual([README])
    expect(harness.tree.facade.clipboardMode).toBe("cut")
  })

  it("leaves the greying on the node that was cut, not on the one dropped", async () => {
    select(README)
    harness.commandManager.performCutTree()

    await dropOn([A], SUB)

    expect(wrapperOf(harness.tree, README)!.classList.contains(DOM.CLASS_CUT)).toBe(true)
    expect(wrapperOf(harness.tree, `${SUB}/a.md`)!.classList.contains(DOM.CLASS_CUT)).toBe(false)
  })
})

/**
 * What the selection is for depends on its shape: one line is what to look for,
 * several are where to look.
 */
describe("CommandManager find widget", () => {
  const selectionButton = () => harness.tabEditor.facade.findOptionSelection

  it("confines the search to a selection spanning lines", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 17)

    harness.commandManager.toggleFindReplaceBox(false)

    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(true)
    expect(view.searchInRange).toBe(true)
  })

  it("takes a selection within one line as the query instead", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 4)

    harness.commandManager.toggleFindReplaceBox(false)

    expect(harness.tabEditor.facade.searchQuery).toBe("cat")
    expect(harness.tabEditor.facade.findInput.value).toBe("cat")
    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })

  // Stepping to a match selects it, so re-reading the selection here would
  // shrink the range to whatever the user is standing on.
  it("does not narrow the range when the box is already open", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 17)
    harness.commandManager.toggleFindReplaceBox(false)

    // Typing a query and stepping to a match is what leaves a match selected.
    harness.commandManager.performSearchQueryChanged("cat")
    harness.commandManager.performFind("down")
    expect(view.getSelectedText()).toBe("cat")

    harness.commandManager.toggleFindReplaceBox(false)

    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)
  })
})
