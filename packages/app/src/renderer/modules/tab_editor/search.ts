export type SearchOptions = {
  matchCase: boolean
  wholeWord: boolean
}

/** A stretch of document, in the editor's own positions. */
export type SearchRange = {
  from: number
  to: number
}

/**
 * Whether a match at [from, to) counts, given the range searching is confined to.
 *
 * A match hanging half out of the range does not: replacing it would edit text
 * the user did not pick out. Null means the whole document, where everything counts.
 */
export function isWithinSearchRange(from: number, to: number, range: SearchRange | null): boolean {
  if (!range) return true
  return from >= range.from && to <= range.to
}

/**
 * Whether a block starting at `pos` holds any of the range, and so is worth scanning.
 *
 * `pos` is the block's own position and its content starts one further in, so a
 * block ending exactly where the range begins has nothing inside it.
 */
export function blockTouchesSearchRange(pos: number, nodeSize: number, range: SearchRange | null): boolean {
  if (!range) return true
  return pos + nodeSize >= range.from && pos <= range.to
}

// Stands in for non-text inline nodes (images, hard breaks) so string
// offsets stay aligned with document positions; never matches user input.
export const INLINE_NODE_PLACEHOLDER = "￼"

/**
 * How many matches get a highlight.
 *
 * Measured, because the guess was wrong: scanning a 680KB document for a word
 * occurring 16000 times costs 4.5ms, and painting those 16000 highlights costs
 * 440ms — so a single letter typed into the find box froze the editor for the
 * better part of a second. The number below is where the paint stops being the
 * dominant cost; past a few hundred highlights nobody is reading them anyway.
 */
export const MAX_PAINTED_MATCHES = 500

/**
 * Which slice of `matches` to paint: at most {@link MAX_PAINTED_MATCHES} of them,
 * centred on the current one.
 *
 * Centred rather than the first N, so the highlights are always around where the
 * user is — including the current match itself, which has its own colour and
 * would be the one thing that must never be dropped.
 *
 * Only the painting is capped. The count in the widget and every match the arrows
 * step through stay exact: it is the drawing that got expensive, not the knowing.
 */
export function paintedMatchRange(count: number, currentIndex: number, cap = MAX_PAINTED_MATCHES) {
  if (count <= cap) return { start: 0, end: count }

  const start = Math.min(Math.max(currentIndex - Math.floor(cap / 2), 0), count - cap)
  return { start, end: start + cap }
}

// Letters, digits and underscore in any script — a markdown editor is not an
// ASCII-only place, and the placeholder above is deliberately none of these.
const WORD_CHARACTER = /[\p{L}\p{N}_]/u

/**
 * The full character ending at unit index `index`, one or two units long.
 * Strings index by UTF-16 unit, and half of a surrogate pair matches no
 * character class — so walking by unit split words at exactly the astral
 * letters WORD_CHARACTER was widened to include.
 */
function charEndingAt(text: string, index: number): string {
  const pair = text.codePointAt(index - 2)
  if (index >= 2 && pair !== undefined && pair > 0xffff) return text.slice(index - 2, index)
  return text[index - 1]
}

/** The full character starting at unit index `index`. */
function charStartingAt(text: string, index: number): string {
  return String.fromCodePoint(text.codePointAt(index)!)
}

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

  while (start > 0) {
    const ch = charEndingAt(text, start)
    if (!WORD_CHARACTER.test(ch)) break
    start -= ch.length
  }
  while (end < text.length) {
    const ch = charStartingAt(text, end)
    if (!WORD_CHARACTER.test(ch)) break
    end += ch.length
  }

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
  // someone who wrote `myVar` there meant the capital in the middle. The first
  // character is taken as a code point — a cased astral letter (Deseret and
  // friends) is two units, and upper-casing half of it changes nothing.
  if (isUpper(cased[0])) {
    const first = charStartingAt(replacement, 0)
    return first.toUpperCase() + replacement.slice(first.length)
  }

  return replacement
}
