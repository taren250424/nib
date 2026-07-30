export type SearchOptions = {
  matchCase: boolean
  wholeWord: boolean
}

// Stands in for non-text inline nodes (images, hard breaks) so string
// offsets stay aligned with document positions; never matches user input.
export const INLINE_NODE_PLACEHOLDER = "￼"

// Letters, digits and underscore in any script — a markdown editor is not an
// ASCII-only place, and the placeholder above is deliberately none of these.
const WORD_CHARACTER = /[\p{L}\p{N}_]/u

/**
 * The word `offset` sits in or immediately after, or "" if it sits in neither.
 *
 * What Ctrl+F seeds the query with when nothing is selected. Sitting just past
 * the end of a word counts as being in it, which is where the caret usually is
 * when someone has just finished typing the thing they want to search for.
 */
export function wordAt(text: string, offset: number): string {
  let start = Math.max(0, Math.min(offset, text.length))
  let end = start

  while (start > 0 && WORD_CHARACTER.test(text[start - 1])) start--
  while (end < text.length && WORD_CHARACTER.test(text[end])) end++

  return text.slice(start, end)
}

/**
 * The query as a regex.
 *
 * A regex is only ever the implementation here — the query itself is literal
 * text, escaped before it gets anywhere near a pattern. That is what makes this
 * total: there is no query a user can type that fails to compile, so no search
 * can fail for a reason that needs explaining.
 */
export function buildSearchRegex(searchText: string, options: SearchOptions): RegExp {
  let source = searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  if (options.wholeWord) source = `\\b(?:${source})\\b`

  return new RegExp(source, options.matchCase ? "g" : "gi")
}

/**
 * `replacement` recased to read the way `matched` did.
 *
 * What "Preserve Case" is for: a case-insensitive search finds `Foo`, `FOO` and
 * `foo` alike, and replacing all three with one literal would otherwise flatten
 * the prose to whatever was typed in the box.
 *
 * Only the three shapes a word is actually written in are recognised — all
 * lower, all upper, and capitalised. Anything else (camelCase, an acronym in
 * the middle) has no obvious answer, so the replacement is left as typed.
 */
export function preserveCaseOf(matched: string, replacement: string): string {
  if (!replacement) return replacement

  // Only characters that have two cases say anything about casing. Hangul, CJK
  // and digits have none, and would otherwise all read as "already upper case".
  const cased = [...matched].filter((ch) => ch.toLowerCase() !== ch.toUpperCase())
  if (cased.length === 0) return replacement

  const isUpper = (ch: string) => ch === ch.toUpperCase()

  if (cased.every(isUpper)) return replacement.toUpperCase()
  if (!cased.some(isUpper)) return replacement.toLowerCase()

  // Capitalised. The rest of the replacement keeps the case it was typed in:
  // someone who wrote `myVar` there meant the capital in the middle.
  if (isUpper(cased[0])) return replacement[0].toUpperCase() + replacement.slice(1)

  return replacement
}
