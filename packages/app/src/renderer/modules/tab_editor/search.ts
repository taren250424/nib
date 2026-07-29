export type SearchOptions = {
  matchCase: boolean
  wholeWord: boolean
  useRegex: boolean
}

// Stands in for non-text inline nodes (images, hard breaks) so string
// offsets stay aligned with document positions; never matches user input.
export const INLINE_NODE_PLACEHOLDER = "￼"

export function buildSearchRegex(searchText: string, options: SearchOptions): RegExp | null {
  let source = options.useRegex ? searchText : searchText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

  if (options.wholeWord) source = `\\b(?:${source})\\b`

  try {
    return new RegExp(source, options.matchCase ? "g" : "gi")
  } catch {
    // A user-typed regex is transiently invalid while being edited.
    return null
  }
}
