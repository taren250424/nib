// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { DOM } from "@renderer/constants"

import { createFacadeHarness, openTab, typeInEditor, type FacadeHarness } from "./facadeHarness"

const FIRST = 1
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

  it("says so when the query finds nothing in the tab arrived at", async () => {
    await openTab(harness, { id: FIRST, content: "cat" })
    await openTab(harness, { id: SECOND, content: "dog" })

    searchFor("cat")
    harness.facade.activateTabEditorById(SECOND)

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
