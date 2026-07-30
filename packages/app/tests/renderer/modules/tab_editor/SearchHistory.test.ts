import { describe, expect, it } from "vitest"

import { SearchHistory } from "@renderer/modules/tab_editor/SearchHistory"

function historyOf(...queries: string[]) {
  const history = new SearchHistory()
  for (const query of queries) history.record(query)
  return history
}

describe("SearchHistory", () => {
  it("walks back through what was searched for, newest first", () => {
    const history = historyOf("one", "two", "three")

    expect(history.older("")).toBe("three")
    expect(history.older("")).toBe("two")
    expect(history.older("")).toBe("one")
  })

  it("stays on the oldest rather than running off the end", () => {
    const history = historyOf("one", "two")

    history.older("")
    history.older("")
    expect(history.older("")).toBe("one")
  })

  it("comes back forward the way it went", () => {
    const history = historyOf("one", "two", "three")

    history.older("")
    history.older("")
    expect(history.newer()).toBe("three")
  })

  // The half-typed query is the one thing ↑ must not cost you.
  it("hands back what was being typed once past the newest entry", () => {
    const history = historyOf("one", "two")

    expect(history.older("half-typ")).toBe("two")
    expect(history.newer()).toBe("half-typ")
  })

  it("has nothing to show going forward when it was not browsing", () => {
    const history = historyOf("one")

    expect(history.newer()).toBeUndefined()
  })

  it("has nothing to show at all when nothing was searched for", () => {
    const history = new SearchHistory()

    expect(history.older("draft")).toBeUndefined()
    expect(history.newer()).toBeUndefined()
  })

  // Otherwise the same few queries fill the list and push everything else out.
  it("moves a repeated query to the front instead of listing it twice", () => {
    const history = historyOf("one", "two", "one")

    expect(history.queries).toEqual(["two", "one"])
  })

  it("ignores an empty query", () => {
    const history = historyOf("one", "")

    expect(history.queries).toEqual(["one"])
  })

  it("keeps the most recent 20", () => {
    const history = new SearchHistory()
    for (let i = 0; i < 25; i++) history.record(`q${i}`)

    expect(history.queries).toHaveLength(20)
    expect(history.queries[0]).toBe("q5")
    expect(history.queries.at(-1)).toBe("q24")
  })

  // Typing ends the mode, so the next ↑ starts from the newest again rather
  // than from wherever the last browse left off.
  it("starts over after something new is searched for", () => {
    const history = historyOf("one", "two")
    history.older("")

    history.record("three")

    expect(history.newer()).toBeUndefined()
    expect(history.older("")).toBe("three")
  })

  // The box reports its contents on a debounce, so recalling an entry produces a
  // change event carrying that same entry a moment later. Treating it as typing
  // would end the walk the arrow key had just started.
  it("does not mistake its own recalled entry for typing", () => {
    const history = historyOf("one", "two")

    expect(history.older("draft")).toBe("two")
    history.queryChanged("two")

    expect(history.older("")).toBe("one")
    expect(history.newer()).toBe("two")
    expect(history.newer()).toBe("draft")
  })

  it("ends the walk when the text is something else", () => {
    const history = historyOf("one", "two")

    history.older("draft")
    history.queryChanged("t")

    expect(history.newer()).toBeUndefined()
    expect(history.older("t")).toBe("two")
  })

  it("gives up the draft when browsing stops", () => {
    const history = historyOf("one")

    history.older("draft")
    history.stopBrowsing()

    expect(history.newer()).toBeUndefined()
  })
})
