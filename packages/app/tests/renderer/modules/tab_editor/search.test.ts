import { describe, expect, it } from "vitest"

import { buildSearchRegex } from "@renderer/modules/tab_editor/search"
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
