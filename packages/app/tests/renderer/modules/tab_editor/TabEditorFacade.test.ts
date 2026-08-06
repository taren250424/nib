// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { DOM } from "@renderer/constants"
import type { TabEditorView } from "@renderer/modules/tab_editor/TabEditorView"

import {
  blurEditor,
  createFacadeHarness,
  openTab,
  refuseSaves,
  typeInEditor,
  warningsShown,
  type FacadeHarness,
} from "./facadeHarness"

const FIRST = 1
const ROOT_DIR = "root"
const SECOND = 2

let harness: FacadeHarness

beforeEach(() => {
  harness = createFacadeHarness()
})

const findInfo = () => harness.facade.findInfo.textContent
const selectionButton = () => harness.facade.findOptionSelection

/** What the widget being open on a query amounts to, as far as the facade is concerned. */
function searchFor(query: string) {
  harness.facade.findReplaceOpen = true
  harness.facade.searchQuery = query
}

/**
 * What the facade does when the tab under the find widget changes.
 *
 * Both halves were eye-only: the highlights and the counter belong to the
 * search being shown, and the Find in Selection button belongs to one document,
 * so all three have to be told which one has arrived.
 */
describe("TabEditorFacade tab switching", () => {
  it("takes the highlights out of the tab being left", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat cat cat" })
    await openTab(harness, { id: SECOND, content: "dog" })

    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)
    expect(first.searchState?.matches).toHaveLength(3)

    harness.facade.activateTabEditorById(SECOND)

    expect(first.searchState).toBeNull()
  })

  // The counter used to alternate as tabs were switched back and forth, because
  // catching a tab up stepped to the next match instead of re-finding them.
  it("leaves the counter on the match it was left on", async () => {
    await openTab(harness, { id: FIRST, content: "cat cat cat" })
    await openTab(harness, { id: SECOND, content: "cat" })

    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)
    harness.facade.findNextMatch("down")
    expect(findInfo()).toBe("1 of 3")

    harness.facade.activateTabEditorById(SECOND)
    harness.facade.activateTabEditorById(FIRST)

    expect(findInfo()).toBe("1 of 3")
  })

  // The caret sits at the end of a document that was just loaded, so the match
  // it has not passed is the last one.
  it("counts the document of a tab opened while the widget is up", async () => {
    await openTab(harness, { id: FIRST, content: "cat" })
    searchFor("cat")

    await openTab(harness, { id: SECOND, content: "cat cat" })

    expect(findInfo()).toBe("2 of 2")
  })

  it("has nothing to count in a binary tab", async () => {
    await openTab(harness, { id: FIRST, content: "cat cat" })
    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)

    await openTab(harness, { id: SECOND, isBinary: true })

    expect(findInfo()).toBe("No results")
  })

  // Published from the same setter as hasActiveEditor: enablement has to know
  // not just that a tab is open but whether it is one a search can run in.
  it("announces whether the active tab is binary", async () => {
    await openTab(harness, { id: FIRST, content: "cat" })
    expect(harness.contextKeyService.get("editorIsBinary")).toBe(false)

    await openTab(harness, { id: SECOND, isBinary: true })
    expect(harness.contextKeyService.get("editorIsBinary")).toBe(true)

    harness.facade.activateTabEditorById(FIRST)
    expect(harness.contextKeyService.get("editorIsBinary")).toBe(false)
  })

  it("says so when the query finds nothing in the tab arrived at", async () => {
    await openTab(harness, { id: FIRST, content: "cat" })
    await openTab(harness, { id: SECOND, content: "dog" })

    searchFor("cat")
    harness.facade.activateTabEditorById(SECOND)

    expect(findInfo()).toBe("No results")
  })

  // Opening a file is the other way to leave a tab; it deactivated the old one
  // without giving up its highlights, unlike a plain switch.
  it("takes the highlights out of the tab a newly opened tab replaces", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat cat" })
    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)
    harness.facade.findNextMatch("down")
    expect(first.searchState?.matches).toHaveLength(2)

    await openTab(harness, { id: SECOND, content: "dog" })

    expect(first.searchState).toBeNull()
  })

  // Emptying the query can only clear the tab it was emptied in; a tab that
  // still wears the previous query's highlights gives them up on arrival.
  it("takes stale highlights out of a tab arriving under an emptied query", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat cat" })
    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)
    harness.facade.findNextMatch("down")
    expect(first.searchState?.matches).toHaveLength(2)

    // Reproduce an arrival with leftovers: the query empties while first still
    // holds its state (no departure path ran for it).
    searchFor("")
    harness.facade.activateTabEditorById(FIRST)

    expect(first.searchState).toBeNull()
    expect(findInfo()).toBe("No results")
  })
})

/**
 * Editing with the widget open used to leave the counter describing a document
 * that no longer existed.
 *
 * The catch-up is deferred, because it arrives from inside the editor's own
 * dispatchTransaction — so it has to be re-checked on the way out.
 */
describe("TabEditorFacade editing while the widget is open", () => {
  const flushDeferred = () => Promise.resolve()

  it("counts the document as it is being typed in", async () => {
    const view = await openTab(harness, { id: FIRST, content: "cat" })
    searchFor("cat")
    harness.facade.findNextMatch("down")
    expect(findInfo()).toBe("1 of 1")

    // The match is what is selected, so typing lands on top of it.
    typeInEditor(view, "cat cat")
    await flushDeferred()

    expect(findInfo()).toBe("2 of 2")
  })

  // F3 works with the box closed and paints highlights; with it closed nothing
  // refreshes them after an edit, so they are given up rather than left to
  // drift onto text that no longer matches.
  it("gives up closed-box highlights once the document is edited", async () => {
    const view = await openTab(harness, { id: FIRST, content: "cat cat" })
    harness.facade.searchQuery = "cat" // the query F3 was last given, box closed
    harness.facade.findNextMatch("down")
    expect(view.searchState?.matches).toHaveLength(2)

    typeInEditor(view, "x")
    await flushDeferred()

    expect(view.searchState).toBeNull()
  })

  it("drops a catch-up for a tab that was switched away from while it waited", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat" })
    await openTab(harness, { id: SECOND, content: "cat cat cat" })

    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)
    harness.facade.findNextMatch("down")

    typeInEditor(first, "cat cat")
    harness.facade.activateTabEditorById(SECOND)
    expect(findInfo()).toBe("3 of 3")

    await flushDeferred()

    expect(findInfo()).toBe("3 of 3")
  })
})

/**
 * Which tab is left active is index arithmetic, and it was only ever checked by
 * closing tabs and looking.
 */
describe("TabEditorFacade closing tabs", () => {
  const openThree = async () => {
    await openTab(harness, { id: 1 })
    await openTab(harness, { id: 2 })
    await openTab(harness, { id: 3 })
  }

  it("falls back to the tab before the active one that was closed", async () => {
    await openThree()
    harness.facade.activateTabEditorById(2)

    harness.facade.removeTab(2)

    expect(harness.facade.activeTabId).toBe(1)
    expect(harness.facade.activeTabIndex).toBe(0)
  })

  it("keeps the active tab active when one to its left closes", async () => {
    await openThree()

    harness.facade.removeTab(1)

    expect(harness.facade.activeTabId).toBe(3)
    expect(harness.facade.activeTabIndex).toBe(1)
  })

  it("says there is no editor once the last tab closes", async () => {
    await openTab(harness, { id: FIRST })

    harness.facade.removeTab(FIRST)

    expect(harness.facade.activeTabId).toBe(-1)
    expect(harness.contextKeyService.get("hasActiveEditor")).toBe(false)
  })

  it("keeps the surviving tab active when the others are closed around it", async () => {
    await openThree()
    harness.facade.activateTabEditorById(2)

    harness.facade.removeTabsExcept([true, false, true])

    expect(harness.facade.activeTabId).toBe(2)
    expect(harness.facade.activeTabIndex).toBe(0)
  })

  // The active tab was one of the closed ones, so there is nothing to keep.
  it("falls back to the last tab left when the active one closed with them", async () => {
    await openThree()

    harness.facade.removeTabsToRight([false, true, true])

    expect(harness.facade.activeTabId).toBe(1)
    expect(harness.facade.activeTabIndex).toBe(0)
  })
})

/**
 * The range is a stretch of one document, so unlike the other three options this
 * button has to be repainted when the tab under it changes.
 */
describe("TabEditorFacade find in selection button", () => {
  it("greys the button in a tab that was never offered a range", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat one\n\ncat two" })
    await openTab(harness, { id: SECOND, content: "cat" })

    first.offerSearchRange({ from: 1, to: 8 })
    first.toggleSearchInRange()

    searchFor("cat")
    harness.facade.activateTabEditorById(SECOND)

    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(false)
    expect(selectionButton().classList.contains(DOM.CLASS_DEACTIVE)).toBe(true)
  })

  it("lights it again in the tab whose range it is", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat one\n\ncat two" })
    await openTab(harness, { id: SECOND, content: "cat" })

    first.offerSearchRange({ from: 1, to: 8 })
    first.toggleSearchInRange()

    searchFor("cat")
    harness.facade.activateTabEditorById(SECOND)
    harness.facade.activateTabEditorById(FIRST)

    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(true)
    expect(selectionButton().classList.contains(DOM.CLASS_DEACTIVE)).toBe(false)
  })

  // Available to turn on, not on: a range was offered and declined.
  it("offers the button without lighting it when the range is not being honoured", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat one\n\ncat two" })
    first.offerSearchRange({ from: 1, to: 8 })

    searchFor("cat")
    harness.facade.syncFindInSelectionButton()

    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(false)
    expect(selectionButton().classList.contains(DOM.CLASS_DEACTIVE)).toBe(false)
  })

  it("greys it when the widget closes and gives up every range", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat one\n\ncat two" })
    first.offerSearchRange({ from: 1, to: 8 })
    first.toggleSearchInRange()

    searchFor("cat")
    harness.facade.syncFindInSelectionButton()
    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(true)

    harness.facade.clearAllSearchRanges()

    expect(first.searchInRange).toBe(false)
    expect(selectionButton().classList.contains(DOM.CLASS_DEACTIVE)).toBe(true)
  })

  // The matches, too, are confined to the range of the document being shown.
  it("counts only the matches inside the range of the tab arrived at", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat one\n\ncat two" })
    await openTab(harness, { id: SECOND, content: "cat" })

    first.offerSearchRange({ from: 1, to: 8 })
    first.toggleSearchInRange()

    searchFor("cat")
    harness.facade.activateTabEditorById(FIRST)

    expect(findInfo()).toBe("1 of 1")
  })
})

/**
 * Auto save, which nothing watched before: the three modes, and above all what
 * it must refuse to touch.
 */
describe("TabEditorFacade auto save", () => {
  const savedDtos = () => vi.mocked(window.rendererToMain.save).mock.calls.map(([dto]) => dto)

  afterEach(() => {
    vi.useRealTimers()
  })

  /** Opens a modified tab: auto save has nothing to do with a clean one. */
  async function openModifiedTab(path = `${ROOT_DIR}/note.md`) {
    const view = await openTab(harness, { id: FIRST, content: "cat", path })
    vi.useFakeTimers()
    typeInEditor(view, " dog")
    return view
  }

  it("saves after a pause in the delay mode", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    await openModifiedTab()

    expect(savedDtos()).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1000)

    expect(savedDtos().map((dto) => dto.filePath)).toEqual([`${ROOT_DIR}/note.md`])
  })

  it("puts the delay off again on the next keystroke", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    const view = await openModifiedTab()

    await vi.advanceTimersByTimeAsync(900)
    typeInEditor(view, "!")
    await vi.advanceTimersByTimeAsync(900)
    expect(savedDtos()).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(200)
    expect(savedDtos()).toHaveLength(1)
  })

  /**
   * The delay mode hides the modified dot, so a dropped save would leave the
   * tab looking clean over a stale file. The pending one lands instead, and
   * only once — the cleared timer must not fire on top of it.
   */
  it("lands a pending save when the mode changes under it", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    await openModifiedTab()

    harness.facade.setAutoSaveMode("off")
    await vi.advanceTimersByTimeAsync(5000)

    expect(savedDtos().map((dto) => dto.filePath)).toEqual([`${ROOT_DIR}/note.md`])
  })

  it("leaves the mode alone when no save is pending", async () => {
    vi.useFakeTimers()
    harness.facade.setAutoSaveMode("off")
    await vi.advanceTimersByTimeAsync(5000)

    expect(savedDtos()).toHaveLength(0)
  })

  it("saves when the editor loses focus in the focus-change mode", async () => {
    harness.facade.setAutoSaveMode("onFocusChange")
    const view = await openModifiedTab()

    blurEditor(view)
    // The save now waits its turn on the command queue.
    await vi.advanceTimersByTimeAsync(0)

    expect(savedDtos()).toHaveLength(1)
  })

  it("saves when the window goes away in the window-change mode", async () => {
    harness.facade.setAutoSaveMode("onWindowChange")
    await openModifiedTab()

    harness.facade.notifyWindowBlurForAutoSave()
    await vi.advanceTimersByTimeAsync(0)

    expect(savedDtos()).toHaveLength(1)
  })

  it("saves nothing while auto save is off", async () => {
    const view = await openModifiedTab()

    blurEditor(view)
    harness.facade.notifyWindowBlurForAutoSave()
    await vi.advanceTimersByTimeAsync(5000)

    expect(savedDtos()).toHaveLength(0)
  })

  // Saving an untitled tab opens a file dialog, which is the one thing auto
  // save must never do — it happens while the user is somewhere else.
  it("never saves a tab that has no file yet", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    await openModifiedTab("")

    await vi.advanceTimersByTimeAsync(1000)

    expect(savedDtos()).toHaveLength(0)
  })
})

/**
 * The modified dot, which is worth showing only where the user is the one who
 * has to act on it. Under the delay mode a tab with a file is dirty for a
 * second at a time and the dot would do nothing but blink.
 */
describe("TabEditorFacade modified badge", () => {
  const badge = (view: TabEditorView) => ({
    text: view.tabButton.textContent,
    marked: view.tabBox.classList.contains(DOM.CLASS_IS_MODIFIED),
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  async function openAndType(path = `${ROOT_DIR}/note.md`) {
    const view = await openTab(harness, { id: FIRST, content: "cat", path })
    vi.useFakeTimers()
    typeInEditor(view, " dog")
    return view
  }

  it("keeps the dot off while the delay mode is saving on the user's behalf", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    const view = await openAndType()

    expect(badge(view)).toEqual({ text: DOM.EXIT_TEXT, marked: false })
  })

  it("shows the dot on an untitled tab, which the delay mode leaves alone", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    const view = await openAndType("")

    expect(badge(view)).toEqual({ text: DOM.MODIFIED_TEXT, marked: true })
  })

  it("shows the dot while auto save is off", async () => {
    const view = await openAndType()

    expect(badge(view)).toEqual({ text: DOM.MODIFIED_TEXT, marked: true })
  })

  // Here the dirty stretch lasts until the editor is left, which is long enough
  // to be worth saying.
  it("shows the dot in the focus-change mode", async () => {
    harness.facade.setAutoSaveMode("onFocusChange")
    const view = await openAndType()

    expect(badge(view)).toEqual({ text: DOM.MODIFIED_TEXT, marked: true })
  })

  it("brings the dot back when the delay mode's save is refused", async () => {
    harness.facade.setAutoSaveMode("afterDelay")
    const view = await openAndType()
    refuseSaves()

    await vi.advanceTimersByTimeAsync(1000)

    expect(badge(view)).toEqual({ text: DOM.MODIFIED_TEXT, marked: true })
  })

  it("takes the dot off once the save lands", async () => {
    harness.facade.setAutoSaveMode("onFocusChange")
    const view = await openAndType()

    harness.facade.applySaveResult({
      id: FIRST,
      isModified: false,
      isBinary: false,
      filePath: `${ROOT_DIR}/note.md`,
      fileName: "note.md",
      content: "cat dog",
    })

    expect(badge(view)).toEqual({ text: DOM.EXIT_TEXT, marked: false })
  })
})

/**
 * A refused write, which nothing used to notice: the loop ended where it stood
 * and the rejection went out as an unhandled one, so the tabs behind it stayed
 * unsaved and the user was told none of it.
 */
describe("TabEditorFacade auto save refusals", () => {
  const refuseOnce = () =>
    vi
      .mocked(window.rendererToMain.save)
      .mockResolvedValueOnce({ result: false, data: null as never, error: "EACCES: permission denied" })

  const savedPaths = () => vi.mocked(window.rendererToMain.save).mock.calls.map(([dto]) => dto.filePath)

  afterEach(() => {
    vi.useRealTimers()
  })

  async function openModifiedTab(path = `${ROOT_DIR}/note.md`) {
    const view = await openTab(harness, { id: FIRST, content: "cat", path })
    harness.facade.setAutoSaveMode("afterDelay")
    vi.useFakeTimers()
    typeInEditor(view, " dog")
    return view
  }

  it("goes on to the tabs behind the one that was refused", async () => {
    const first = await openTab(harness, { id: FIRST, content: "cat", path: `${ROOT_DIR}/first.md` })
    const second = await openTab(harness, { id: SECOND, content: "dog", path: `${ROOT_DIR}/second.md` })
    harness.facade.setAutoSaveMode("afterDelay")
    vi.useFakeTimers()
    typeInEditor(first, "!")
    typeInEditor(second, "!")

    refuseOnce()
    await vi.advanceTimersByTimeAsync(1000)

    expect(savedPaths()).toEqual([`${ROOT_DIR}/first.md`, `${ROOT_DIR}/second.md`])
  })

  it("names the file, once, however long the refusals go on", async () => {
    const view = await openModifiedTab()
    refuseSaves()

    await vi.advanceTimersByTimeAsync(1000)
    typeInEditor(view, "!")
    await vi.advanceTimersByTimeAsync(1000)

    expect(savedPaths()).toHaveLength(2)
    expect(warningsShown()).toHaveLength(1)
    expect(warningsShown()[0]).toContain("note.md")
  })

  it("forgives the tab as soon as a save lands", async () => {
    const view = await openModifiedTab()

    refuseOnce()
    await vi.advanceTimersByTimeAsync(1000)
    expect(view.tabButton.textContent).toBe(DOM.MODIFIED_TEXT)

    typeInEditor(view, "!")
    await vi.advanceTimersByTimeAsync(1000)

    expect(view.tabButton.textContent).toBe(DOM.EXIT_TEXT)
  })
})
