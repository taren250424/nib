// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { createCommandDescriptors } from "@renderer/commands"
import { TREE_CONTEXT_MENU_BINDINGS } from "@renderer/commands/contextMenuBindings"
import type { CommandDeps } from "@renderer/commands/definitions"
import { DOM } from "@renderer/constants"
import { CommandRegistry, FocusManager } from "@renderer/core"
import { bindContextMenu, renderContextMenuState } from "@renderer/handlers/menu"

import { buildDto, createTreeHarness, installWindowUtils, loadTree, rowOf, wrapperOf } from "./treeHarness"

/**
 * root
 *  ├ docs/            (expanded)
 *  │   ├ a.md
 *  │   └ b.md
 *  ├ notes/           (expanded, empty)
 *  └ readme.md
 */
const SAMPLE = buildDto({
  name: "root",
  children: [
    { name: "docs", children: [{ name: "a.md" }, { name: "b.md" }] },
    { name: "notes", children: [] },
    { name: "readme.md" },
  ],
})

const DOCS = "root/docs"
const A = "root/docs/a.md"
const B = "root/docs/b.md"
const NOTES = "root/notes"
const README = "root/readme.md"

function setup() {
  installWindowUtils()
  const harness = createTreeHarness()
  loadTree(harness, SAMPLE)
  return harness
}

/** Index of a path in the flat list, which is what the facade's API speaks. */
function indexOf(harness: ReturnType<typeof setup>, path: string) {
  return harness.facade.getFlattenIndexByPath(path)
}

/** Lets an async click listener run to its finally block. */
function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

describe("tree selection", () => {
  let harness: ReturnType<typeof setup>

  beforeEach(() => {
    harness = setup()
  })

  it("marks exactly the selected rows and publishes that there is a selection", () => {
    harness.facade.setSelection([indexOf(harness, A)])

    expect(rowOf(harness, A).classList.contains(DOM.CLASS_SELECTED)).toBe(true)
    expect(rowOf(harness, B).classList.contains(DOM.CLASS_SELECTED)).toBe(false)
    expect(harness.contextKeyService.get("treeHasSelection")).toBe(true)

    harness.facade.setSelection([indexOf(harness, B)])

    expect(rowOf(harness, A).classList.contains(DOM.CLASS_SELECTED)).toBe(false)
    expect(rowOf(harness, B).classList.contains(DOM.CLASS_SELECTED)).toBe(true)

    harness.facade.clearSelection()
    expect(harness.contextKeyService.get("treeHasSelection")).toBe(false)
  })

  // The regression this file exists for: the marks used to live only as classes
  // the renderer did not write, so anything that rebuilt the rows dropped them.
  it("keeps the selection and the cut marks across a full re-render", () => {
    harness.facade.setSelection([indexOf(harness, A)])
    harness.facade.setClipboard([A], "cut")

    loadTree(harness, SAMPLE)

    expect(rowOf(harness, A).classList.contains(DOM.CLASS_SELECTED)).toBe(true)
    expect(rowOf(harness, A).classList.contains(DOM.CLASS_FOCUSED)).toBe(true)
    expect(wrapperOf(harness, A).classList.contains(DOM.CLASS_CUT)).toBe(true)
  })

  it("follows the nodes, not their positions, when rows are inserted above", () => {
    harness.facade.setSelection([indexOf(harness, README)])
    const before = indexOf(harness, README)

    harness.facade.applyCreate(DOCS, "root/docs/aa.md", false)

    expect(indexOf(harness, README)).toBe(before + 1)
    expect(harness.facade.getSelectedIndices()).toEqual([indexOf(harness, README)])
    expect(rowOf(harness, README).classList.contains(DOM.CLASS_SELECTED)).toBe(true)
  })

  it("grows a Shift range from a fixed anchor instead of moving it", () => {
    harness.facade.setSelection([indexOf(harness, A)])

    harness.facade.extendSelectionTo(indexOf(harness, README))
    expect(harness.facade.getSelectedPaths()).toEqual([A, B, NOTES, README])

    // Coming back towards the anchor shrinks the range; a moving anchor would
    // have left everything it passed over selected.
    harness.facade.extendSelectionTo(indexOf(harness, B))
    expect(harness.facade.getSelectedPaths()).toEqual([A, B])
    expect(rowOf(harness, README).classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })

  it("adds and removes one node on Ctrl-click", () => {
    harness.facade.setSelection([indexOf(harness, A)])

    harness.facade.toggleSelection(indexOf(harness, README))
    expect(harness.facade.getSelectedPaths()).toEqual([A, README])

    harness.facade.toggleSelection(indexOf(harness, A))
    expect(harness.facade.getSelectedPaths()).toEqual([README])
    expect(rowOf(harness, A).classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })

  it("keeps one current item when the focus moves", () => {
    harness.facade.setSelection([indexOf(harness, A), indexOf(harness, B)], indexOf(harness, A))
    expect(rowOf(harness, A).classList.contains(DOM.CLASS_FOCUSED)).toBe(true)

    harness.facade.focusIndex(indexOf(harness, B))

    expect(rowOf(harness, A).classList.contains(DOM.CLASS_FOCUSED)).toBe(false)
    expect(rowOf(harness, B).classList.contains(DOM.CLASS_FOCUSED)).toBe(true)
    expect(harness.facade.focusedIndex).toBe(indexOf(harness, B))
  })

  it("drops hidden children from the selection when their directory collapses", () => {
    harness.facade.setSelection([indexOf(harness, A), indexOf(harness, B)])

    const docs = harness.facade.getTreeViewModelByPath(DOCS)
    docs.expanded = false
    harness.facade.removeChildNodes(docs)

    expect(harness.facade.getSelectedPaths()).toEqual([])
    // The selection retreats to the directory that swallowed them, so the next
    // create or paste still has somewhere to go.
    expect(harness.facade.focusedIndex).toBe(indexOf(harness, DOCS))
    expect(harness.contextKeyService.get("treeHasSelection")).toBe(false)
  })

  it("keeps the selection through a rename", () => {
    harness.facade.setSelection([indexOf(harness, A)])

    harness.facade.applyRename(A, "root/docs/renamed.md")

    expect(harness.facade.getSelectedPaths()).toEqual(["root/docs/renamed.md"])
    expect(rowOf(harness, "root/docs/renamed.md").classList.contains(DOM.CLASS_SELECTED)).toBe(true)
  })
})

describe("tree deletion", () => {
  let harness: ReturnType<typeof setup>

  beforeEach(() => {
    harness = setup()
  })

  it("leaves the surviving selection alone", () => {
    harness.facade.setSelection([indexOf(harness, A), indexOf(harness, README)])

    harness.facade.applyDelete([indexOf(harness, A)])

    expect(harness.facade.getSelectedPaths()).toEqual([README])
    expect(rowOf(harness, README).classList.contains(DOM.CLASS_SELECTED)).toBe(true)
  })

  it("takes deleted paths off the clipboard", () => {
    harness.facade.setClipboard([A, README], "cut")
    expect(harness.contextKeyService.get("treeHasClipboard")).toBe(true)

    harness.facade.applyDelete([indexOf(harness, A), indexOf(harness, README)])

    expect(harness.facade.getClipboardPaths()).toEqual([])
    expect(harness.contextKeyService.get("treeHasClipboard")).toBe(false)
  })
})

describe("tree clipboard marks", () => {
  let harness: ReturnType<typeof setup>

  beforeEach(() => {
    harness = setup()
  })

  it("greys out a cut but not a copy", () => {
    harness.facade.setClipboard([A], "copy")
    expect(wrapperOf(harness, A).classList.contains(DOM.CLASS_CUT)).toBe(false)

    harness.facade.setClipboard([A], "cut")
    expect(wrapperOf(harness, A).classList.contains(DOM.CLASS_CUT)).toBe(true)
  })

  it("clears the mark when the clipboard is dropped", () => {
    harness.facade.setClipboard([A], "cut")
    harness.facade.clearClipboard()

    expect(wrapperOf(harness, A).classList.contains(DOM.CLASS_CUT)).toBe(false)
    expect(harness.facade.clipboardMode).toBe("none")
    expect(harness.contextKeyService.get("treeHasClipboard")).toBe(false)
  })

  it("moves the mark to the new sources when a second cut replaces the first", () => {
    harness.facade.setClipboard([A], "cut")
    harness.facade.setClipboard([README], "cut")

    expect(wrapperOf(harness, A).classList.contains(DOM.CLASS_CUT)).toBe(false)
    expect(wrapperOf(harness, README).classList.contains(DOM.CLASS_CUT)).toBe(true)
  })
})

describe("tree context menu", () => {
  let harness: ReturnType<typeof setup>

  beforeEach(() => {
    harness = setup()
  })

  function rightClick(path: string) {
    const event = new MouseEvent("contextmenu", { clientX: 10, clientY: 10, bubbles: true })
    rowOf(harness, path).dispatchEvent(event)
    harness.facade.handleShowContextmenu(event)
  }

  // What made a right-click delete a directory: the menu acts on the selection,
  // and opening it outside the selection did not bring the selection along.
  it("moves the selection to a node right-clicked outside it", () => {
    harness.facade.setSelection([indexOf(harness, DOCS)])

    rightClick(README)

    expect(harness.facade.getSelectedPaths()).toEqual([README])
    expect(harness.facade.contextTreeIndex).toBe(indexOf(harness, README))
  })

  it("keeps a multi-selection when the right-click lands inside it", () => {
    harness.facade.setSelection([indexOf(harness, A), indexOf(harness, B)])

    rightClick(B)

    expect(harness.facade.getSelectedPaths()).toEqual([A, B])
    expect(harness.facade.focusedIndex).toBe(indexOf(harness, B))
  })

  // A right-click does not move focus the way a left-click does. Without the
  // tree being the focused zone, every item in the menu greys itself out — and
  // so does every tree shortcut pressed afterwards.
  it("focuses the right-clicked row whether or not it was already selected", () => {
    rightClick(README)
    expect(document.activeElement).toBe(rowOf(harness, README))

    harness.facade.setSelection([indexOf(harness, A)])
    rightClick(A)
    expect(document.activeElement).toBe(rowOf(harness, A))
  })

  // Closing is only about the menu. The node it was opened on outlives it,
  // because the command runs after the close and paste still needs to know
  // where it was pointed; the next right-click overwrites it.
  it("hides the menu without forgetting the node it was opened on", () => {
    rightClick(A)
    harness.facade.handleHideContextmenu()

    expect(harness.elements.treeContextMenu.classList.contains(DOM.CLASS_SELECTED)).toBe(false)
    expect(harness.facade.contextTreeIndex).toBe(indexOf(harness, A))

    rightClick(README)
    expect(harness.facade.contextTreeIndex).toBe(indexOf(harness, README))
  })
})

describe("tree context menu enablement", () => {
  let harness: ReturnType<typeof setup>
  let registry: CommandRegistry
  let focusManager: FocusManager
  let ran: string[]
  let menuOpenWhileRunning: boolean

  beforeEach(() => {
    harness = setup()
    ran = []
    menuOpenWhileRunning = true

    focusManager = new FocusManager()
    // What contextKeyHandlers wires in the app: focus is pushed into the keys
    // the `when` conditions read.
    focusManager.onDidChangeFocus((task) => harness.contextKeyService.set("focusedTask", task))

    const record = () =>
      new Proxy(
        {},
        {
          get: (_t, property: string) => () => {
            ran.push(property)
            menuOpenWhileRunning = harness.elements.treeContextMenu.classList.contains(DOM.CLASS_SELECTED)
          },
        }
      ) as unknown as CommandDeps["treeFacade"]

    registry = new CommandRegistry(harness.contextKeyService)
    registry.registerAll(
      createCommandDescriptors({
        commandManager: record(),
        zoomManager: record(),
        sideFacade: record(),
        infoFacade: record(),
        menuElements: record(),
        tabEditorFacade: record(),
        treeFacade: record(),
      } as unknown as CommandDeps)
    )

    bindContextMenu(registry, TREE_CONTEXT_MENU_BINDINGS, harness.elements, () =>
      harness.facade.handleHideContextmenu()
    )
  })

  function openMenuOn(path: string) {
    const event = new MouseEvent("contextmenu", { clientX: 10, clientY: 10, bubbles: true })
    rowOf(harness, path).dispatchEvent(event)
    harness.facade.handleShowContextmenu(event)
    renderContextMenuState(registry, focusManager, TREE_CONTEXT_MENU_BINDINGS, harness.elements)
  }

  function greyed(element: "treeContextCut" | "treeContextPaste" | "treeContextDelete") {
    return harness.elements[element].classList.contains(DOM.CLASS_DEACTIVE)
  }

  // The greying has to be computed after the right-click has moved the
  // selection, since that is what most of these commands apply to.
  it("enables the selection commands once the right-click has selected something", () => {
    focusManager.setFocusedTask("tree")

    openMenuOn(README)

    expect(greyed("treeContextCut")).toBe(false)
    expect(greyed("treeContextDelete")).toBe(false)
    // Nothing on the clipboard yet.
    expect(greyed("treeContextPaste")).toBe(true)

    harness.facade.setClipboard([A], "cut")
    openMenuOn(README)
    expect(greyed("treeContextPaste")).toBe(false)
  })

  // Rename opens a prompt and does not resolve until the user has finished with
  // it, so a menu closed after the command sat on top of the input it opened.
  it("closes the menu before running the command, not after", async () => {
    focusManager.setFocusedTask("tree")
    openMenuOn(README)

    harness.elements.treeContextRename.click()
    await flush()

    expect(ran).toEqual(["performRename"])
    expect(menuOpenWhileRunning).toBe(false)
    expect(harness.elements.treeContextMenu.classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })

  // Paste reads the node the menu was opened on, which is why closing first
  // must not forget it.
  it("still knows the right-clicked node while the command runs", async () => {
    focusManager.setFocusedTask("tree")
    harness.facade.setClipboard([A], "cut")
    openMenuOn(README)

    harness.elements.treeContextPaste.click()
    await flush()

    expect(ran).toEqual(["performPasteTreeWithContextmenu"])
    expect(harness.facade.contextTreeIndex).toBe(indexOf(harness, README))
  })

  it("does nothing but close when a greyed-out item is clicked", async () => {
    focusManager.setFocusedTask("tree")
    openMenuOn(README)

    harness.elements.treeContextPaste.click()
    await flush()

    expect(ran).toEqual([])
    expect(harness.elements.treeContextMenu.classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })
})

describe("tree insertion into a collapsed directory", () => {
  let harness: ReturnType<typeof setup>

  beforeEach(() => {
    harness = setup()
  })

  // What hid files pasted into a closed directory: the DOM node was skipped
  // while collapsed, and expanding only renders into an empty container.
  it("puts the row in the DOM even while the parent is collapsed", () => {
    const docs = harness.facade.getTreeViewModelByPath(DOCS)
    docs.expanded = false
    harness.facade.removeChildNodes(docs)

    harness.facade.applyCreate(DOCS, "root/docs/c.md", false)

    const container = wrapperOf(harness, DOCS).querySelector(DOM.SELECTOR_TREE_NODE_CHILDREN) as HTMLElement
    const paths = [...container.children].map(
      (child) => (child.querySelector(DOM.SELECTOR_TREE_NODE) as HTMLElement).dataset[DOM.DATASET_ATTR_TREE_PATH]
    )
    expect(paths).toContain("root/docs/c.md")
  })

  // A directory that was never read stays unread: recording a lone child would
  // make it look loaded, and expanding would then show only that child.
  it("leaves a never-opened directory alone", () => {
    const notes = harness.facade.getTreeViewModelByPath(NOTES)
    notes.expanded = false

    harness.facade.applyCreate(NOTES, "root/notes/new.md", false)

    expect(notes.children).toEqual([])
  })

  it("keeps children sorted with directories first", () => {
    harness.facade.applyCreate(DOCS, "root/docs/aaa.md", false)
    harness.facade.applyCreate(DOCS, "root/docs/sub", true)

    const docs = harness.facade.getTreeViewModelByPath(DOCS)
    expect(docs.children!.map((child) => child.name)).toEqual(["sub", "a.md", "aaa.md", "b.md"])
  })
})
