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
