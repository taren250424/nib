import { describe, expect, it } from "vitest"

import {
  blockTouchesSearchRange,
  buildSearchRegex,
  isWithinSearchRange,
  paintedMatchRange,
  preserveCaseOf,
  wordAt,
  INLINE_NODE_PLACEHOLDER,
} from "@renderer/modules/tab_editor/search"
import type { SearchOptions } from "@renderer/modules/tab_editor/search"

const DEFAULT_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false }

function options(overrides: Partial<SearchOptions> = {}): SearchOptions {
  return { ...DEFAULT_OPTIONS, ...overrides }
}

function matches(text: string, query: string, overrides: Partial<SearchOptions> = {}): string[] {
  const regex = buildSearchRegex(query, options(overrides))
  return [...text.matchAll(regex)].map((match) => match[0])
}

describe("buildSearchRegex", () => {
  it("matches case-insensitively by default and exactly under matchCase", () => {
    expect(matches("Cat cat CAT", "cat")).toEqual(["Cat", "cat", "CAT"])
    expect(matches("Cat cat CAT", "cat", { matchCase: true })).toEqual(["cat"])
  })

  it("treats the query as literal text", () => {
    expect(matches("a.b axb", "a.b")).toEqual(["a.b"])
  })

  it("escapes every regex metacharacter in literal mode", () => {
    const metacharacters = ".*+?^${}()|[]\\"
    for (const char of metacharacters) {
      const text = `left${char}right`
      expect(matches(text, char), `failed to match a literal ${char}`).toEqual([char])
    }
  })

  it("anchors to word boundaries under wholeWord", () => {
    expect(matches("cat category", "cat")).toEqual(["cat", "cat"])
    expect(matches("cat category", "cat", { wholeWord: true })).toEqual(["cat"])
  })

  // The query is escaped before it becomes a pattern, so there is nothing a
  // user can type that fails to compile.
  it("compiles anything the user can type", () => {
    expect(() => buildSearchRegex("(unclosed", options())).not.toThrow()
    expect(matches("a{2,1} here", "a{2,1}")).toEqual(["a{2,1}"])
    expect(matches("what \\d+ means", "\\d+")).toEqual(["\\d+"])
  })

  it("is global so a single regex can collect every match", () => {
    expect(buildSearchRegex("x", options()).flags).toContain("g")
    expect(buildSearchRegex("x", options({ matchCase: true })).flags).toBe("g")
  })
})

describe("wordAt", () => {
  it("finds the word the offset is inside", () => {
    expect(wordAt("the quick brown", 6)).toBe("quick")
    expect(wordAt("the quick brown", 4)).toBe("quick")
  })

  // Where the caret sits after typing the thing you then want to search for.
  it("counts the position just past a word as inside it", () => {
    expect(wordAt("the quick brown", 9)).toBe("quick")
  })

  it("returns nothing when the offset is not in a word", () => {
    expect(wordAt("the  quick", 4)).toBe("")
    expect(wordAt("", 0)).toBe("")
  })

  it("takes letters, digits and underscore from any script", () => {
    expect(wordAt("call snake_case2 now", 8)).toBe("snake_case2")
    expect(wordAt("파일 트리를 연다", 4)).toBe("트리를")
  })

  it("stops at the inline-node placeholder", () => {
    expect(wordAt(`ab${INLINE_NODE_PLACEHOLDER}cd`, 4)).toBe("cd")
  })

  it("tolerates an offset outside the text", () => {
    expect(wordAt("word", 99)).toBe("word")
    expect(wordAt("word", -1)).toBe("word")
  })

  // An astral letter is two UTF-16 units; testing half of a surrogate pair
  // matches no character class, so walking by unit split the word there.
  it("keeps a word containing an astral letter whole", () => {
    expect(wordAt("a 𝕏axis b", 4)).toBe("𝕏axis")
    expect(wordAt("a 𝕏axis b", 2)).toBe("𝕏axis")
    expect(wordAt("ax𝕏", 2)).toBe("ax𝕏")
  })
})

describe("preserveCaseOf", () => {
  it("follows the three shapes a word is written in", () => {
    expect(preserveCaseOf("colour", "color")).toBe("color")
    expect(preserveCaseOf("COLOUR", "color")).toBe("COLOR")
    expect(preserveCaseOf("Colour", "color")).toBe("Color")
  })

  // What the option is for: one case-insensitive search, three spellings kept.
  it("recases each hit of a case-insensitive search on its own", () => {
    const hits = ["cat", "Cat", "CAT"]
    expect(hits.map((hit) => preserveCaseOf(hit, "dog"))).toEqual(["dog", "Dog", "DOG"])
  })

  // Someone who typed a capital in the middle of the replacement meant it.
  it("keeps the replacement's own capitals after the first letter", () => {
    expect(preserveCaseOf("Old", "myVar")).toBe("MyVar")
  })

  it("leaves a mixed-case match alone — there is no obvious answer", () => {
    expect(preserveCaseOf("myVar", "result")).toBe("result")
    expect(preserveCaseOf("aBC", "xyz")).toBe("xyz")
  })

  // Every character of 한글 reports as both upper and lower case, so a naive
  // "is it all upper case?" would shout every replacement next to one.
  it("says nothing about case for scripts that have none", () => {
    expect(preserveCaseOf("한글", "text")).toBe("text")
    expect(preserveCaseOf("漢字", "text")).toBe("text")
    expect(preserveCaseOf("123", "text")).toBe("text")
    expect(preserveCaseOf("...", "text")).toBe("text")
  })

  // Cased and uncased characters mixed: the cased ones are what answer.
  it("reads the casing through punctuation and digits", () => {
    expect(preserveCaseOf("API-2", "rest-2")).toBe("REST-2")
    expect(preserveCaseOf("v1-tag", "v2-name")).toBe("v2-name")
  })

  it("treats a lone capital as upper case, as VSCode does", () => {
    expect(preserveCaseOf("A", "beta")).toBe("BETA")
  })

  // Deseret is a cased astral script: its letters are two units each, and
  // upper-casing half of a surrogate pair changes nothing.
  it("capitalises a replacement that starts with a cased astral letter", () => {
    expect(preserveCaseOf("Word", "\u{10428}og")).toBe("\u{10400}og")
  })

  it("has nothing to recase when the replacement is empty", () => {
    expect(preserveCaseOf("WORD", "")).toBe("")
  })
})

describe("isWithinSearchRange", () => {
  const range = { from: 10, to: 20 }

  it("counts everything when there is no range", () => {
    expect(isWithinSearchRange(0, 5, null)).toBe(true)
  })

  it("counts a match the range contains, edges included", () => {
    expect(isWithinSearchRange(12, 15, range)).toBe(true)
    expect(isWithinSearchRange(10, 20, range)).toBe(true)
  })

  // Replacing one of these would edit text the user did not pick out.
  it("does not count a match hanging out of either end", () => {
    expect(isWithinSearchRange(8, 12, range)).toBe(false)
    expect(isWithinSearchRange(18, 22, range)).toBe(false)
  })

  it("does not count a match outside altogether", () => {
    expect(isWithinSearchRange(0, 5, range)).toBe(false)
    expect(isWithinSearchRange(30, 35, range)).toBe(false)
  })
})

describe("blockTouchesSearchRange", () => {
  const range = { from: 10, to: 20 }

  it("scans every block when there is no range", () => {
    expect(blockTouchesSearchRange(100, 5, null)).toBe(true)
  })

  it("scans a block the range reaches into", () => {
    expect(blockTouchesSearchRange(8, 6, range)).toBe(true)
    expect(blockTouchesSearchRange(12, 4, range)).toBe(true)
    expect(blockTouchesSearchRange(18, 8, range)).toBe(true)
  })

  it("skips blocks that end before it or start after it", () => {
    expect(blockTouchesSearchRange(0, 5, range)).toBe(false)
    expect(blockTouchesSearchRange(25, 5, range)).toBe(false)
  })
})

/**
 * Painting every match is what made a common word freeze the editor; the count
 * itself was never the expensive part. So the window moves, and the total does not.
 */
describe("paintedMatchRange", () => {
  const CAP = 10

  it("paints all of them when there are few enough", () => {
    expect(paintedMatchRange(4, 0, CAP)).toEqual({ start: 0, end: 4 })
    expect(paintedMatchRange(CAP, 3, CAP)).toEqual({ start: 0, end: CAP })
  })

  it("centres the window on the current match", () => {
    expect(paintedMatchRange(100, 50, CAP)).toEqual({ start: 45, end: 55 })
  })

  it("stops the window at either end rather than shrinking it", () => {
    expect(paintedMatchRange(100, 1, CAP)).toEqual({ start: 0, end: CAP })
    expect(paintedMatchRange(100, 99, CAP)).toEqual({ start: 90, end: 100 })
  })

  // The current match has its own colour, so it is the one that must never
  // fall outside what gets drawn.
  it("keeps the current match inside the window wherever it is", () => {
    for (const currentIndex of [0, 1, 4, 5, 6, 50, 94, 95, 99]) {
      const { start, end } = paintedMatchRange(100, currentIndex, CAP)
      expect(currentIndex).toBeGreaterThanOrEqual(start)
      expect(currentIndex).toBeLessThan(end)
    }
  })
})
