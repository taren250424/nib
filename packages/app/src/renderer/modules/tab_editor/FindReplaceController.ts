import { inject, injectable } from "inversify"

import { DI, DOM } from "../../constants"
import { TabEditorFacade } from "./TabEditorFacade"

/**
 * The find and replace feature: what each control of the widget does, and the
 * shortcuts that reach searching with the widget closed.
 *
 * Split out of CommandManager, which had grown into the implementation of
 * every command at once; everything here drives one facade, so it is the one
 * service these commands name. State stays where it was — the query and
 * options in the tab editor store, per-document match state on each view —
 * this class is the verbs over that state.
 */
@injectable()
export class FindReplaceController {
  constructor(@inject(DI.TabEditorFacade) private readonly tabEditorFacade: TabEditorFacade) {}

  toggleFindReplaceBox(showReplace: boolean) {
    const activeView = this.tabEditorFacade.getActiveTabEditorView()
    if (!activeView || activeView.isBinary) return

    // What the selection is for depends on its shape. A phrase on one line is
    // what to look for; several lines are where to look, which is the same call
    // VSCode makes. Either way the last query is left alone if there is neither.
    const selectedText = activeView.getSelectedText()
    const spansLines = selectedText.includes("\n")

    const seed = selectedText && !spansLines ? selectedText : activeView.getWordAtCursor()
    if (seed) {
      this.tabEditorFacade.searchQuery = seed
      this.tabEditorFacade.findInput.value = seed
    }

    // Offered on the way in and not later: stepping to a match selects it, so by
    // the time anyone presses the button the editor has forgotten what was
    // picked out. Only on the way in, too — Ctrl+F on an open box would
    // otherwise narrow the range to the match currently selected.
    if (!this.tabEditorFacade.findReplaceOpen) {
      activeView.offerSearchRange(activeView.selectionRangeAtOpen())
      if (spansLines) activeView.toggleSearchInRange()
    }
    this.tabEditorFacade.syncFindInSelectionButton()

    this.tabEditorFacade.findAndReplaceContainer.style.display = "flex"
    this.tabEditorFacade.setReplaceRowVisible(showReplace)
    this.tabEditorFacade.findReplaceOpen = true
    this.tabEditorFacade.replaceInfo.textContent = ""

    if (showReplace) this.tabEditorFacade.replaceInput.select()
    else this.tabEditorFacade.findInput.select()

    // Anchor the session where the caret is, so typing the query searches
    // outwards from the reading position rather than from the last match.
    activeView.captureSearchAnchor()
    this._refreshFind()
  }

  performToggleReplaceRow() {
    this.tabEditorFacade.setReplaceRowVisible(!this.tabEditorFacade.isReplaceRowVisible())
  }

  /**
   * The find input debounces its change event, so a submit can arrive while
   * the store still holds the previous query. Every path that acts on the
   * query commits what the box shows first — rewriting the document with a
   * query the user has already corrected is the bug this prevents.
   */
  private _commitPendingQuery() {
    const value = this.tabEditorFacade.findInput.value
    if (value !== this.tabEditorFacade.searchQuery) this.performSearchQueryChanged(value)
  }

  performSearchQueryChanged(query: string) {
    // The debounced event also echoes a query a submit already committed;
    // treating the echo as typing would clear the "N replaced" message it
    // just earned and re-run the same search.
    if (query === this.tabEditorFacade.searchQuery) return

    this.tabEditorFacade.searchQuery = query
    // Typing ends a walk through the history: the next ↑ starts from the newest
    // entry again, and the draft it would have restored is this text.
    this.tabEditorFacade.searchHistory.queryChanged(query)
    this.tabEditorFacade.replaceInfo.textContent = ""
    // The input event is debounced, so it can arrive after the box was
    // closed (e.g. Esc committing an IME composition); searching then
    // would repaint highlights that close just cleared.
    if (!this.tabEditorFacade.findReplaceOpen) return
    this._refreshFind()
  }

  /** Re-runs a query that is still being edited, without stepping to the next match. */
  private _refreshFind() {
    this.tabEditorFacade.findNextMatch(this.tabEditorFacade.findDirection, "refine")
  }

  performReplaceQueryChanged(query: string) {
    this.tabEditorFacade.replaceQuery = query
    this.tabEditorFacade.replaceInfo.textContent = ""
  }

  performToggleSearchOption(option: "matchCase" | "wholeWord") {
    const enabled = this.tabEditorFacade.toggleSearchOption(option)

    const buttons = {
      matchCase: this.tabEditorFacade.findOptionCase,
      wholeWord: this.tabEditorFacade.findOptionWord,
    }
    buttons[option].classList.toggle(DOM.CLASS_SELECTED, enabled)

    // Match lists computed with the previous options are meaningless now.
    this.tabEditorFacade.clearAllSearches()
    this._refreshFind()
  }

  /** No re-search: what counts as a match has not changed, only how it is written back. */
  performTogglePreserveCase() {
    const enabled = this.tabEditorFacade.togglePreserveCase()
    this.tabEditorFacade.findOptionPreserveCase.classList.toggle(DOM.CLASS_SELECTED, enabled)
  }

  performToggleFindInSelection() {
    const view = this.tabEditorFacade.getActiveTabEditorView()
    if (!view || view.isBinary || !view.hasSearchRange()) return

    view.toggleSearchInRange()
    this.tabEditorFacade.syncFindInSelectionButton()

    // Unlike Preserve Case this does change what counts as a match. Only this
    // view's list is affected — the range is a stretch of its own document.
    this._refreshFind()
  }

  performFind(direction: "up" | "down") {
    this._commitPendingQuery()

    // Asking for a match is the moment a query stops being something half-typed
    // and becomes one worth offering back. Live search as you type is not.
    this.tabEditorFacade.searchHistory.record(this.tabEditorFacade.searchQuery)
    this.tabEditorFacade.findNextMatch(direction)
  }

  /** Walks ↑/↓ through the queries searched for so far. */
  performSearchHistory(direction: "older" | "newer") {
    const history = this.tabEditorFacade.searchHistory
    const input = this.tabEditorFacade.findInput

    const query = direction === "older" ? history.older(input.value) : history.newer()
    if (query === undefined) return

    input.value = query
    // The caret goes to the end, as it does in a shell: what someone wants next
    // is usually to add to the recalled query rather than edit its middle.
    input.setSelectionRange(query.length, query.length)

    this.tabEditorFacade.searchQuery = query
    this._refreshFind()
  }

  performReplace() {
    const view = this.tabEditorFacade.getActiveTabEditorView()
    if (!view || view.isBinary) return

    // The staleness check below only watches the document; a corrected query
    // the debounce has not delivered yet would leave the old query's match
    // selected — and replaced.
    this._commitPendingQuery()

    // Edits since the last search invalidate match positions;
    // re-locate instead of replacing a stale range.
    if (view.isSearchStateStale()) {
      this.tabEditorFacade.findNextMatch()
      return
    }

    const replaceInput = this.tabEditorFacade.replaceQuery

    const replaced = view.replaceCurrentMatch(replaceInput, this.tabEditorFacade.preserveCase)
    if (!replaced) return

    this.tabEditorFacade.findNextMatch()
  }

  performReplaceAll() {
    // Reachable via a global shortcut, so a closed box or a searchless
    // tab must not silently rewrite the document with a stale query.
    if (!this.tabEditorFacade.findReplaceOpen) return

    const view = this.tabEditorFacade.getActiveTabEditorView()
    if (!view || view.isBinary) return

    this._commitPendingQuery()

    const findInput = this.tabEditorFacade.searchQuery
    const replaceInput = this.tabEditorFacade.replaceQuery

    const replacedCount = view.replaceAllMatches(
      findInput,
      replaceInput,
      this.tabEditorFacade.searchOptions,
      this.tabEditorFacade.preserveCase
    )

    // Match positions and the count label are invalid after the rewrite.
    this.tabEditorFacade.findNextMatch()

    this.tabEditorFacade.replaceInfo.textContent = replacedCount > 0 ? `${replacedCount} replaced` : ""
  }

  performCloseFindReplaceBox() {
    if (!this.tabEditorFacade.findReplaceOpen) return

    this.tabEditorFacade.findAndReplaceContainer.style.display = "none"

    // Whatever the box was closed on is worth remembering too — searching as you
    // type means a query often finds what it was after without ever being
    // submitted. Committed first, so closing within the debounce window
    // remembers what the box showed and F3 keeps searching for it.
    this._commitPendingQuery()
    this.tabEditorFacade.searchHistory.record(this.tabEditorFacade.searchQuery)

    this.tabEditorFacade.clearAllSearches()
    this.tabEditorFacade.clearAllSearchRanges()
    this.tabEditorFacade.replaceInfo.textContent = ""

    this.tabEditorFacade.findReplaceOpen = false

    // Hand focus back so typing continues in the document instead of the input
    // that was just hidden. Closing the last tab also closes the box, and then
    // there is no view left to focus.
    this.tabEditorFacade.getActiveTabEditorView()?.focus()
  }

  performFindOrReplaceByActiveElement(direction: "up" | "down" = "down") {
    const activateElement = document.activeElement

    if (activateElement === this.tabEditorFacade.findInput) {
      this.performFind(direction)
    } else if (activateElement === this.tabEditorFacade.replaceInput) {
      this.performReplace()
    }
  }
}
