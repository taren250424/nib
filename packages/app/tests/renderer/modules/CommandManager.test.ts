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

/**
 * Clicks a row: selects it and takes DOM focus with it.
 *
 * Commands that ask where the user is (rename does) read the focus from the
 * document, so selecting alone leaves them looking at the editor.
 */
function clickRow(path: string) {
  select(path)
  harness.tree.facade.focusIndex(indexOf(path))
}

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
 * Create, delete and rename through the command rather than the edit.
 *
 * `tests/renderer/edits/` builds the edits by hand; going in through the command
 * brings the name prompt, the queue and the undo stack along, which is where the
 * bookkeeping between the tree and the tabs actually happens.
 */
describe("CommandManager create, delete and rename", () => {
  /** Types a name into whichever prompt is open and presses Enter. */
  async function answerPrompt(name: string) {
    let input: HTMLInputElement | null = null

    // The prompt is put up after an await, so it is not there on the way in.
    for (let attempt = 0; attempt < 20 && !input; attempt++) {
      await Promise.resolve()
      input = document.querySelector<HTMLInputElement>(DOM.SELECTOR_TREE_NODE_INPUT)
    }
    if (!input) throw new Error("no name prompt appeared")

    input.value = name
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" }))
  }

  const pathsInTree = () => harness.tree.facade.getSelectedPaths()

  it("creates a file, selects it and opens it in a tab", async () => {
    select(DOCS)
    const done = harness.commandManager.performCreate(false)
    await answerPrompt("new.md")
    await done

    const created = `${DOCS}/new.md`
    expect(harness.tree.facade.getFlattenIndexByPath(created)).toBeDefined()
    expect(pathsInTree()).toEqual([created])
    expect(harness.tabEditor.facade.getTabEditorViewByPath(created)).toBeTruthy()
  })

  // The tab used to be found by an id handed back after the open, so undoing
  // after closing that tab by hand looked the id up and got nothing.
  it("undoes a create whose tab was already closed by hand", async () => {
    select(DOCS)
    const done = harness.commandManager.performCreate(false)
    await answerPrompt("new.md")
    await done

    const created = `${DOCS}/new.md`
    const view = harness.tabEditor.facade.getTabEditorViewByPath(created)!
    harness.tabEditor.facade.removeTab(view.getId())

    await harness.commandManager.performUndoTree()

    expect(harness.tree.facade.getFlattenIndexByPath(created)).toBeUndefined()
    // The undo ran to the end rather than throwing on the way: a revert that
    // throws is caught and never reaches the redo stack.
    expect(canRedo()).toBe(true)
  })

  it("closes the tab of a file it deletes", async () => {
    await harness.commandManager.performOpenFile(README)
    const view = harness.tabEditor.facade.getTabEditorViewByPath(README)!

    select(README)
    await harness.commandManager.performDelete()

    expect(harness.tree.facade.getFlattenIndexByPath(README)).toBeUndefined()
    expect(harness.tabEditor.facade.getTabEditorViewIndexById(view.getId())).toBe(-1)
  })

  it("brings a deleted node back with its parent", async () => {
    select(A)
    await harness.commandManager.performDelete()
    expect(harness.tree.facade.getFlattenIndexByPath(A)).toBeUndefined()

    await harness.commandManager.performUndoTree()

    expect(harness.tree.facade.getFlattenIndexByPath(A)).toBeDefined()
  })

  // Main can refuse without throwing. Same rule as a paste that moved nothing:
  // an edit that did nothing earns no undo step and must not wipe the redo
  // branch — undoing it would "restore" a file that was never removed.
  it("takes no undo step for a delete Main refused", async () => {
    select(A)
    await harness.commandManager.performDelete()
    await harness.commandManager.performUndoTree()
    expect(canRedo()).toBe(true)

    harness.ipc.delete.mockResolvedValueOnce({ result: false, data: [] })
    select(README)
    await harness.commandManager.performDelete()

    expect(harness.tree.facade.getFlattenIndexByPath(README)).toBeDefined()
    expect(canUndo()).toBe(false)
    expect(canRedo()).toBe(true)
  })

  it("rewrites the path of an open tab when its file is renamed", async () => {
    await harness.commandManager.performOpenFile(README)
    const view = harness.tabEditor.facade.getTabEditorViewByPath(README)!

    clickRow(README)
    const done = harness.commandManager.performRename()
    await answerPrompt("readme.txt")
    await done

    const renamed = `${ROOT}/readme.txt`
    expect(harness.tabEditor.facade.getTabEditorViewByPath(renamed)).toBe(view)
    expect(view.tabSpan.title).toBe(renamed)
    expect(view.tabSpan.textContent).toBe("readme.txt")
  })

  // A directory rename moves every tab underneath it, not just one.
  it("rewrites the paths of tabs under a renamed directory", async () => {
    await harness.commandManager.performOpenFile(A)
    await harness.commandManager.performOpenFile(README)
    const inside = harness.tabEditor.facade.getTabEditorViewByPath(A)!
    const outside = harness.tabEditor.facade.getTabEditorViewByPath(README)!

    clickRow(DOCS)
    const done = harness.commandManager.performRename()
    await answerPrompt("papers")
    await done

    expect(harness.tabEditor.facade.getTabEditorViewByPath(`${ROOT}/papers/a.md`)).toBe(inside)
    expect(harness.tabEditor.facade.getTabEditorViewByPath(README)).toBe(outside)
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

    harness.findReplaceManager.toggleFindReplaceBox(false)

    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(true)
    expect(view.searchInRange).toBe(true)
  })

  it("takes a selection within one line as the query instead", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 4)

    harness.findReplaceManager.toggleFindReplaceBox(false)

    expect(harness.tabEditor.facade.searchQuery).toBe("cat")
    expect(harness.tabEditor.facade.findInput.value).toBe("cat")
    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })

  // Stepping to a match selects it, so re-reading the selection here would
  // shrink the range to whatever the user is standing on.
  it("does not narrow the range when the box is already open", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 17)
    harness.findReplaceManager.toggleFindReplaceBox(false)

    // Typing a query and stepping to a match is what leaves a match selected.
    harness.findReplaceManager.performSearchQueryChanged("cat")
    harness.findReplaceManager.performFind("down")
    expect(view.getSelectedText()).toBe("cat")

    harness.findReplaceManager.toggleFindReplaceBox(false)

    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)
  })

  // The input debounces its change event, so a submit can arrive while the
  // store still holds the previous query. Replace All is the destructive way
  // to hit that window: the document would be rewritten with the old query
  // while the box shows the corrected one.
  it("replaces with the query the box shows, not the one the debounce delivered", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    harness.findReplaceManager.toggleFindReplaceBox(true)

    harness.findReplaceManager.performSearchQueryChanged("cat") // what the debounce delivered
    harness.tabEditor.facade.findInput.value = "one" // what was typed since
    harness.findReplaceManager.performReplaceQueryChanged("three")

    harness.findReplaceManager.performReplaceAll()

    expect(harness.tabEditor.facade.searchQuery).toBe("one")
    expect(view.findAllMatches("one", OPTIONS)).toHaveLength(0)
    expect(view.findAllMatches("three", OPTIONS)).toHaveLength(1)
    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)
  })
})
