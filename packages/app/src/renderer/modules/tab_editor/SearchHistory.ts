/** How many past queries are kept. Enough for a session's worth of going back and forth. */
const MAX_ENTRIES = 20

/**
 * The queries searched for so far, and where ↑/↓ currently sits in them.
 *
 * Browsing is a mode: the first ↑ puts aside whatever was half-typed in the box
 * and starts walking back through the list, and coming forward past the newest
 * entry hands that draft back rather than leaving the box on someone else's
 * query. Typing anything ends the mode.
 *
 * Lives for the session only. Which queries someone searched for is not
 * something to write to disk without being asked.
 */
export class SearchHistory {
  // Newest last, so recording is a push and ↑ walks backwards.
  private entries: string[] = []
  private cursor = -1
  private draft = ""
  private lastRecalled: string | null = null

  get queries(): readonly string[] {
    return this.entries
  }

  /**
   * Remembers a query that was actually searched for.
   *
   * A repeat moves to the newest position instead of being added again — the
   * same handful of queries otherwise fill the list and push everything else out.
   */
  record(query: string) {
    this.stopBrowsing()
    if (!query) return

    const existing = this.entries.indexOf(query)
    if (existing !== -1) this.entries.splice(existing, 1)

    this.entries.push(query)
    if (this.entries.length > MAX_ENTRIES) this.entries.shift()
  }

  /** The next query back, or undefined if there is nothing older to show. */
  older(current: string): string | undefined {
    if (this.entries.length === 0) return undefined

    if (this.cursor === -1) {
      this.draft = current
      this.cursor = this.entries.length - 1
    } else {
      // Already at the oldest: stay there rather than falling out of the mode,
      // which would drop the draft on the next ↓.
      this.cursor = Math.max(0, this.cursor - 1)
    }

    return this._recall(this.entries[this.cursor])
  }

  /** The next query forward, the draft once past the newest, or undefined if not browsing. */
  newer(): string | undefined {
    if (this.cursor === -1) return undefined

    if (this.cursor < this.entries.length - 1) {
      this.cursor++
      return this._recall(this.entries[this.cursor])
    }

    const { draft } = this
    this.stopBrowsing()
    return draft
  }

  /**
   * Reacts to the box's text having changed. Typing ends the walk.
   *
   * Except when the text is the entry this just handed out: the box reports its
   * contents on a debounce, so putting an entry into it produces a change event
   * that arrives afterwards and would otherwise end the walk it just started.
   */
  queryChanged(query: string) {
    if (query === this.lastRecalled) return
    this.stopBrowsing()
  }

  stopBrowsing() {
    this.cursor = -1
    this.draft = ""
    this.lastRecalled = null
  }

  private _recall(query: string) {
    this.lastRecalled = query
    return query
  }
}
