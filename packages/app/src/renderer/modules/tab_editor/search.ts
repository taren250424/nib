export type SearchOptions = {
  matchCase: boolean
  wholeWord: boolean
  useRegex: boolean
}

// Stands in for non-text inline nodes (images, hard breaks) so string
// offsets stay aligned with document positions; never matches user input.
export const INLINE_NODE_PLACEHOLDER = "￼"

/**
 * Substitutes `$1`–`$99`, `$&` and `$$` in a replacement, the way
 * String.replace does — including leaving a reference past the last group as
 * literal text, since that is what a user comparing the two would expect.
 *
 * Only regex searches capture anything, so a plain search passes no groups and
 * every `$n` stays literal.
 */
export function expandReplacement(
  template: string,
  matchText: string,
  groups: readonly (string | undefined)[]
): string {
  return template.replace(/\$(\$|&|\d{1,2})/g, (whole, token: string) => {
    if (token === "$") return "$"
    if (token === "&") return matchText

    let index = Number(token)
    let trailing = ""

    // "$12" with three groups means group 1 followed by "2", not group 12.
    if (index > groups.length && token.length === 2) {
      index = Number(token[0])
      trailing = token[1]
    }

    if (index < 1 || index > groups.length) return whole
    return (groups[index - 1] ?? "") + trailing
  })
}

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

export type SearchCompileResult = { regex: RegExp; error: null } | { regex: null; error: string }

/**
 * Compiles the query, keeping the reason it failed.
 *
 * Only a regex search can fail, and a half-typed one usually is failing — which
 * is why the failure has to be tellable apart from a search that simply found
 * nothing, instead of both reading "No results".
 */
export function compileSearchRegex(searchText: string, options: SearchOptions): SearchCompileResult {
  let source = options.useRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  if (options.wholeWord) source = `\\b(?:${source})\\b`

  try {
    return { regex: new RegExp(source, options.matchCase ? "g" : "gi"), error: null }
  } catch (err) {
    return { regex: null, error: err instanceof Error ? err.message : String(err) }
  }
}

export function buildSearchRegex(searchText: string, options: SearchOptions): RegExp | null {
  return compileSearchRegex(searchText, options).regex
}
