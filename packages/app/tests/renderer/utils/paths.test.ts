import { describe, expect, it } from "vitest"

import { isPathInside } from "@renderer/utils/paths"

describe("isPathInside", () => {
  it("sees a child, however deep", () => {
    expect(isPathInside("C:\\docs\\notes", "C:\\docs")).toBe(true)
    expect(isPathInside("C:\\docs\\a\\b\\c.md", "C:\\docs")).toBe(true)
  })

  it("does not count a path as inside itself", () => {
    expect(isPathInside("C:\\docs", "C:\\docs")).toBe(false)
  })

  it("sees neither a parent nor a stranger as inside", () => {
    expect(isPathInside("C:\\docs", "C:\\docs\\notes")).toBe(false)
    expect(isPathInside("C:\\other", "C:\\docs")).toBe(false)
  })

  // The bug a plain startsWith would have: a sibling whose name merely begins
  // with the other's is not inside it.
  it("compares whole segments, not a prefix of the text", () => {
    expect(isPathInside("C:\\docs\\notes-old", "C:\\docs\\notes")).toBe(false)
    expect(isPathInside("C:\\documents", "C:\\docs")).toBe(false)
  })

  it("reads both separators", () => {
    expect(isPathInside("/home/me/docs/a.md", "/home/me/docs")).toBe(true)
    expect(isPathInside("/home/me/docs-old", "/home/me/docs")).toBe(false)
  })
})
