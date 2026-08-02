// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { DOM } from "@renderer/constants"

import { createCommandHarness, type CommandHarness } from "./commandHarness"
import { openTab, selectInEditor } from "./tab_editor/facadeHarness"

const OPTIONS = { matchCase: false, wholeWord: false }

let harness: CommandHarness

beforeEach(() => {
  harness = createCommandHarness()
})

/**
 * What the selection is for depends on its shape: one line is what to look for,
 * several are where to look.
 */
describe("FindReplaceController find widget", () => {
  const selectionButton = () => harness.tabEditor.facade.findOptionSelection

  it("confines the search to a selection spanning lines", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 17)

    harness.findReplaceController.toggleFindReplaceBox(false)

    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(true)
    expect(view.searchInRange).toBe(true)
  })

  it("takes a selection within one line as the query instead", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 4)

    harness.findReplaceController.toggleFindReplaceBox(false)

    expect(harness.tabEditor.facade.searchQuery).toBe("cat")
    expect(harness.tabEditor.facade.findInput.value).toBe("cat")
    expect(selectionButton().classList.contains(DOM.CLASS_SELECTED)).toBe(false)
  })

  // Stepping to a match selects it, so re-reading the selection here would
  // shrink the range to whatever the user is standing on.
  it("does not narrow the range when the box is already open", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    selectInEditor(view, 1, 17)
    harness.findReplaceController.toggleFindReplaceBox(false)

    // Typing a query and stepping to a match is what leaves a match selected.
    harness.findReplaceController.performSearchQueryChanged("cat")
    harness.findReplaceController.performFind("down")
    expect(view.getSelectedText()).toBe("cat")

    harness.findReplaceController.toggleFindReplaceBox(false)

    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)
  })

  // The input debounces its change event, so a submit can arrive while the
  // store still holds the previous query. Replace All is the destructive way
  // to hit that window: the document would be rewritten with the old query
  // while the box shows the corrected one.
  it("replaces with the query the box shows, not the one the debounce delivered", async () => {
    const view = await openTab(harness.tabEditor, { id: 1, content: "cat one\n\ncat two" })
    harness.findReplaceController.toggleFindReplaceBox(true)

    harness.findReplaceController.performSearchQueryChanged("cat") // what the debounce delivered
    harness.tabEditor.facade.findInput.value = "one" // what was typed since
    harness.findReplaceController.performReplaceQueryChanged("three")

    harness.findReplaceController.performReplaceAll()

    expect(harness.tabEditor.facade.searchQuery).toBe("one")
    expect(view.findAllMatches("one", OPTIONS)).toHaveLength(0)
    expect(view.findAllMatches("three", OPTIONS)).toHaveLength(1)
    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)
  })
})
