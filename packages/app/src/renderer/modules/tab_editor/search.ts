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
