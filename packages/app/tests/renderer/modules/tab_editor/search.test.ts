import { describe, expect, it } from "vitest"

import { buildSearchRegex, preserveCaseOf, wordAt, INLINE_NODE_PLACEHOLDER } from "@renderer/modules/tab_editor/search"
import type { SearchOptions } from "@renderer/modules/tab_editor/search"

const DEFAULT_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false }

function options(overrides: Partial<SearchOptions> = {}): SearchOptions {
  return { ...DEFAULT_OPTIONS, ...overrides }
}

function matches(text: string, query: string, overrides: Partial<SearchOptions> = {}): string[] {
  const regex = buildSearchRegex(query, options(overrides))
  if (!regex) return []
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
    expect(buildSearchRegex("x", options())?.flags).toContain("g")
    expect(buildSearchRegex("x", options({ matchCase: true }))?.flags).toBe("g")
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

  it("has nothing to recase when the replacement is empty", () => {
    expect(preserveCaseOf("WORD", "")).toBe("")
  })
})
