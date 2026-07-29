import { describe, expect, it } from "vitest"

import { buildSearchRegex, expandReplacement } from "@renderer/modules/tab_editor/search"
import type { SearchOptions } from "@renderer/modules/tab_editor/search"

const DEFAULT_OPTIONS: SearchOptions = { matchCase: false, wholeWord: false, useRegex: false }

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

  it("treats the query as literal text unless useRegex is on", () => {
    expect(matches("a.b axb", "a.b")).toEqual(["a.b"])
    expect(matches("a.b axb", "a.b", { useRegex: true })).toEqual(["a.b", "axb"])
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

  // The alternation is wrapped so a whole-word regex search anchors the whole
  // query rather than only its last branch.
  it("keeps wholeWord correct for an alternation", () => {
    expect(matches("cat dog category", "cat|dog", { wholeWord: true, useRegex: true })).toEqual(["cat", "dog"])
  })

  it("returns null for a regex that is still being typed", () => {
    expect(buildSearchRegex("(unclosed", options({ useRegex: true }))).toBeNull()
    expect(buildSearchRegex("a{2,1}", options({ useRegex: true }))).toBeNull()
  })

  it("is global so a single regex can collect every match", () => {
    expect(buildSearchRegex("x", options())?.flags).toContain("g")
    expect(buildSearchRegex("x", options({ matchCase: true }))?.flags).toBe("g")
  })
})

describe("expandReplacement", () => {
  /** Runs the query for real, so the groups are the ones a search would hand over. */
  function replaceWith(text: string, pattern: string, template: string) {
    const match = new RegExp(pattern).exec(text)!
    return expandReplacement(template, match[0], match.slice(1))
  }

  it("substitutes numbered groups", () => {
    expect(replaceWith("2026-07-29", "(\\d+)-(\\d+)-(\\d+)", "$3/$2/$1")).toBe("29/07/2026")
  })

  it("substitutes the whole match and an escaped dollar", () => {
    expect(replaceWith("total", "tot(al)", "<$&>")).toBe("<total>")
    expect(replaceWith("total", "tot(al)", "$$$1")).toBe("$al")
  })

  it("leaves a reference past the last group as literal text, like String.replace", () => {
    expect(replaceWith("ab", "(a)(b)", "$3")).toBe("$3")
    expect(replaceWith("ab", "(a)(b)", "$2$1")).toBe("ba")
  })

  // "$12" with two groups means group 1 followed by "2".
  it("falls back to the single-digit reference", () => {
    expect(replaceWith("ab", "(a)(b)", "$12")).toBe("a2")
    expect(replaceWith("ab", "(a)(b)", "$0")).toBe("$0")
  })

  it("keeps an optional group that did not participate empty", () => {
    expect(replaceWith("a", "(a)(x)?", "[$2]")).toBe("[]")
  })

  // A plain-text search captures nothing, so a replacement full of dollars is
  // inserted exactly as typed.
  it("leaves everything alone when there are no groups", () => {
    expect(expandReplacement("$1 costs $5", "anything", [])).toBe("$1 costs $5")
  })
})
