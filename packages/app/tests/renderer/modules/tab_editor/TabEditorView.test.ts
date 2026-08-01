// @vitest-environment jsdom
import { describe, expect, it } from "vitest"

import { MAX_PAINTED_MATCHES } from "@renderer/modules/tab_editor/search"

import { createEditorView } from "./editorHarness"

const OPTIONS = { matchCase: false, wholeWord: false }

/**
 * Search and replace against a live editor.
 *
 * These were eye-only until now: the pure parts (buildSearchRegex, wordAt,
 * preserveCaseOf, the range predicates) had tests, but nothing checked that they
 * were wired into ProseMirror correctly, and that is where the wiring lives.
 */
describe("TabEditorView search", () => {
  it("finds every occurrence, whatever its case", async () => {
    const view = await createEditorView("cat Cat CAT")

    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(3)
    expect(view.findAllMatches("cat", { ...OPTIONS, matchCase: true })).toHaveLength(1)
  })

  it("steps to a match and says which one it landed on", async () => {
    const view = await createEditorView("cat cat cat")

    expect(view.searchNextMatch("cat", "down", OPTIONS)).toBe(0)
    expect(view.searchNextMatch("cat", "down", OPTIONS)).toBe(1)
  })

  it("reports nothing to find when there is nothing", async () => {
    const view = await createEditorView("cat")

    expect(view.searchNextMatch("dog", "down", OPTIONS)).toBe(-1)
    expect(view.searchState).toBeNull()
  })

  // The anchor is a document position like the range in plugin state; an edit
  // earlier in the document shifts every position after it, and an unmapped
  // anchor would measure the next refinement from different text.
  it("keeps the anchor on its occurrence through an edit before it", async () => {
    const view = await createEditorView("dog cat cat")

    view.searchNextMatch("cat", "down", OPTIONS)
    expect(view.searchNextMatch("cat", "down", OPTIONS)).toBe(1) // anchor on the second cat

    view.replaceAllMatches("dog", "crocodile", OPTIONS, false) // lengthen the text before it

    expect(view.searchFromAnchor("cat", OPTIONS)).toBe(1)
  })
})

describe("TabEditorView replace", () => {
  it("replaces the match it is standing on", async () => {
    const view = await createEditorView("cat dog")
    view.searchNextMatch("cat", "down", OPTIONS)

    expect(view.replaceCurrentMatch("bird", false)).toBe(true)
    expect(view.getContent()).toContain("bird dog")
  })

  // The marks are the part a naive schema.text() replacement loses.
  it("keeps the formatting the replaced text was wearing", async () => {
    const view = await createEditorView("a **cat** b")

    view.replaceAllMatches("cat", "dog", OPTIONS, false)

    expect(view.getContent()).toContain("**dog**")
  })

  it("writes the replacement as typed while preserve case is off", async () => {
    const view = await createEditorView("cat Cat CAT")

    expect(view.replaceAllMatches("cat", "dog", OPTIONS, false)).toBe(3)
    expect(view.getContent()).toContain("dog dog dog")
  })

  // One case-insensitive search, three spellings kept apart.
  it("recases each hit from its own text while preserve case is on", async () => {
    const view = await createEditorView("cat Cat CAT")

    expect(view.replaceAllMatches("cat", "dog", OPTIONS, true)).toBe(3)
    expect(view.getContent()).toContain("dog Dog DOG")
  })

  it("recases a single replacement too", async () => {
    const view = await createEditorView("CAT dog")
    view.searchNextMatch("cat", "down", OPTIONS)

    view.replaceCurrentMatch("bird", true)

    expect(view.getContent()).toContain("BIRD dog")
  })
})

describe("TabEditorView find in selection", () => {
  it("ignores matches outside the range", async () => {
    const view = await createEditorView("cat one\n\ncat two")
    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)

    // The first paragraph only: its content starts at 1 and runs seven characters.
    view.offerSearchRange({ from: 1, to: 8 })
    view.toggleSearchInRange()

    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(1)
    expect(view.findAllMatches("two", OPTIONS)).toHaveLength(0)
  })

  // The range is a pair of document positions, so an edit inside it has to carry
  // its end along or the rest of the paragraph drops out of a range it is
  // plainly still in.
  it("grows with a longer replacement made inside it", async () => {
    const view = await createEditorView("cat one\n\ncat two")
    view.offerSearchRange({ from: 1, to: 8 })
    view.toggleSearchInRange()

    view.searchNextMatch("cat", "down", OPTIONS)
    view.replaceCurrentMatch("caterpillar", false)

    expect(view.findAllMatches("one", OPTIONS)).toHaveLength(1)
    expect(view.findAllMatches("two", OPTIONS)).toHaveLength(0)
  })

  it("searches all of it again once turned off", async () => {
    const view = await createEditorView("cat one\n\ncat two")
    view.offerSearchRange({ from: 1, to: 8 })

    view.toggleSearchInRange()
    expect(view.searchInRange).toBe(true)
    view.toggleSearchInRange()

    expect(view.searchInRange).toBe(false)
    expect(view.findAllMatches("cat", OPTIONS)).toHaveLength(2)
  })

  it("cannot be turned on without a range to turn on", async () => {
    const view = await createEditorView("cat")

    expect(view.hasSearchRange()).toBe(false)
    expect(view.toggleSearchInRange()).toBe(false)
  })
})

/**
 * Scanning a large document was never the expensive part — painting a highlight
 * onto every hit was. A common word in a 680KB document froze the editor for
 * 440ms per keystroke; capping what gets drawn brought that to 22ms.
 */
describe("TabEditorView highlight cap", () => {
  const painted = (view: Awaited<ReturnType<typeof createEditorView>>) =>
    view.editorBox.querySelectorAll(".search-highlight, .search-highlight-current").length

  const manyMatches = (count: number) => "cat ".repeat(count)

  it("paints every match while there are few of them", async () => {
    const view = await createEditorView(manyMatches(20))

    expect(view.refreshMatches("cat", OPTIONS)).toBe(20)
    expect(painted(view)).toBe(20)
  })

  it("counts them all but stops painting past the cap", async () => {
    const total = MAX_PAINTED_MATCHES * 2
    const view = await createEditorView(manyMatches(total))

    // The count in the widget is the exact one; only the drawing is bounded.
    expect(view.refreshMatches("cat", OPTIONS)).toBe(total)
    expect(painted(view)).toBe(MAX_PAINTED_MATCHES)
  })

  // The current match is the one with its own colour, so it is the one that
  // must never be left out of the window.
  it("still paints the current match when it is past the cap", async () => {
    const total = MAX_PAINTED_MATCHES * 2
    const view = await createEditorView(manyMatches(total))

    // Searching up from a freshly loaded document lands on the last match,
    // which is well past where a window anchored at the start would end.
    expect(view.searchNextMatch("cat", "up", OPTIONS)).toBe(total - 1)

    expect(view.editorBox.querySelectorAll(".search-highlight-current")).toHaveLength(1)
    expect(painted(view)).toBe(MAX_PAINTED_MATCHES)
  })
})

describe("TabEditorView search state", () => {
  // Editing with the widget open used to leave the counter describing a document
  // that no longer existed.
  it("re-finds matches after an edit", async () => {
    const view = await createEditorView("cat cat")
    view.searchNextMatch("cat", "down", OPTIONS)

    expect(view.refreshMatches("cat", OPTIONS)).toBe(2)
    expect(view.searchState?.matches).toHaveLength(2)
  })

  it("knows its match positions went stale", async () => {
    const view = await createEditorView("cat cat")
    view.searchNextMatch("cat", "down", OPTIONS)
    expect(view.isSearchStateStale()).toBe(false)

    view.replaceCurrentMatch("dog", false)

    expect(view.isSearchStateStale()).toBe(true)
  })

  it("gives up its matches when the search is cleared, as a tab switch does", async () => {
    const view = await createEditorView("cat cat")
    view.searchNextMatch("cat", "down", OPTIONS)

    view.clearSearch()

    expect(view.searchState).toBeNull()
  })

  it("gives up the range too when the widget closes", async () => {
    const view = await createEditorView("cat cat")
    view.offerSearchRange({ from: 1, to: 4 })
    view.toggleSearchInRange()

    view.clearSearchRange()

    expect(view.hasSearchRange()).toBe(false)
    expect(view.searchInRange).toBe(false)
  })
})
