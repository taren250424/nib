import { serializerCtx } from "@milkdown/core"
import { Editor, editorViewCtx, parserCtx } from "@milkdown/kit/core"

import { TextSelection, Selection, Plugin, PluginKey } from "prosemirror-state"
import { Decoration, DecorationSet, EditorView } from "prosemirror-view"
import { redo, undo } from "prosemirror-history"
import type { Node } from "prosemirror-model"
import type { Mapping } from "prosemirror-transform"

import { CLASS_SELECTED, DATASET_ATTR_TAB_ID } from "../../constants/dom"
import {
  blockTouchesSearchRange,
  buildSearchRegex,
  isWithinSearchRange,
  paintedMatchRange,
  preserveCaseOf,
  wordAt,
  INLINE_NODE_PLACEHOLDER,
} from "./search"
import type { SearchOptions, SearchRange } from "./search"

type SearchMatch = {
  from: number
  to: number
}

type SearchState = {
  query: string
  matches: SearchMatch[]
  currentIndex: number
  // Doc the matches were computed against; edits make them stale.
  doc: Node
}

type SearchHighlightMeta = { matches: SearchMatch[]; currentIndex: number } | { range: SearchRange | null } | null

type SearchPluginState = {
  decorations: DecorationSet
  /**
   * The stretch of document searching is confined to, or null for all of it.
   *
   * Kept here rather than on the view because it has to survive editing: the
   * plugin sees every transaction, so the range can be mapped through each one
   * and still cover the same text after a replacement inside it changed its
   * length. Both ends bias toward keeping a boundary insertion inside — text
   * typed at either edge of the stretch being searched is plainly part of it.
   */
  range: SearchRange | null
}

function mapSearchRange(range: SearchRange, mapping: Mapping): SearchRange {
  return { from: mapping.map(range.from, -1), to: mapping.map(range.to, 1) }
}

export class TabEditorView {
  private _tabBox: HTMLElement
  private _tabSpan: HTMLElement
  private _tabButton: HTMLElement

  private _editorBox: HTMLElement
  private _editor: Editor | null
  private _isBinary: boolean

  private _onInput?: (view: TabEditorView) => void

  private _suppressInputEvent = false

  private _searchState: SearchState | null = null
  private _searchHighlightKey = new PluginKey<SearchPluginState>("searchHighlight")

  // Where an incremental search measures "next match" from. Kept separate from the
  // caret because focusing a match moves the caret onto it, and searching forward
  // from there would walk one occurrence further on every keystroke in the query.
  private _searchAnchor: number | null = null

  // Whether the offered range is being honoured. Per view: the range is a
  // stretch of this document, so it means nothing in the tab next door.
  private _searchInRange = false

  constructor(
    tabBox: HTMLElement,
    tabSpan: HTMLElement,
    tabButton: HTMLElement,
    editorBox: HTMLElement,
    editor: Editor | null,
    isBinary: boolean,
    onInput: (view: TabEditorView) => void,
    onBlur: (view: TabEditorView) => void
  ) {
    this._tabBox = tabBox
    this._tabSpan = tabSpan
    this._tabButton = tabButton
    this._editorBox = editorBox
    this._editor = editor
    this._isBinary = isBinary
    this._onInput = onInput

    if (!isBinary) this._initEditorObserver(onInput, onBlur)
  }

  //

  _initEditorObserver(onInput: (view: TabEditorView) => void, onBlur: (view: TabEditorView) => void) {
    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)

      view.setProps({
        dispatchTransaction: (tr) => {
          const newState = view.state.apply(tr)
          view.updateState(newState)

          if (tr.scrolledIntoView) {
            const { from } = newState.selection
            const coords = view.coordsAtPos(from)

            let scrollEl: Element | null = view.dom.parentElement
            while (scrollEl) {
              const { overflowY } = window.getComputedStyle(scrollEl)
              if (overflowY === "auto" || overflowY === "scroll") break
              scrollEl = scrollEl.parentElement
            }

            const target = scrollEl ?? document.documentElement
            const box = target.getBoundingClientRect()
            target.scrollTop = coords.top - box.top + target.scrollTop - target.clientHeight / 2
          }

          if (tr.docChanged) {
            // The anchor is a document position like the range in plugin
            // state, and this is the one place the view sees every edit — an
            // unmapped anchor silently comes to point at different text, and
            // the next query refinement measures from the wrong place.
            if (this._searchAnchor !== null) this._searchAnchor = tr.mapping.map(this._searchAnchor)

            if (this._suppressInputEvent) return
            onInput(this)
          }
        },
        handleDOMEvents: {
          blur: () => {
            onBlur(this)
            return false
          },
        },
      })
    })
  }

  //

  getId(): number {
    return parseInt(this._tabBox.dataset[DATASET_ATTR_TAB_ID]!)
  }

  //

  getEditorFirstLine() {
    const editorView = this._editor!.ctx.get(editorViewCtx)
    const firstLine = editorView.state.doc.textBetween(0, editorView.state.doc.content.size).split("\n")[0].trim()
    return firstLine || "Untitled"
  }

  getContent(): string {
    return this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const serializer = ctx.get(serializerCtx)
      return serializer(view.state.doc)
    })
  }

  setContent(content: string): void {
    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const parser = ctx.get(parserCtx)
      const doc = parser(content)

      if (doc) {
        const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content)
        view.dispatch(tr)
      }
    })
  }

  //

  undoEditor() {
    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state, dispatch } = view
      undo(state, dispatch)
    })
  }

  redoEditor() {
    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state, dispatch } = view
      redo(state, dispatch)
    })
  }

  pasteInEditor(text: string) {
    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state, dispatch } = view
      view.focus()
      dispatch(state.tr.insertText(text))
    })
  }

  //

  getSelection() {
    return this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const sel = view.state.selection

      return {
        anchor: sel.anchor,
        head: sel.head,
      }
    })
  }

  getSelectedText(): string {
    return this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { from, to } = view.state.selection
      return view.state.doc.textBetween(from, to, "\n")
    })
  }

  /**
   * The word the caret is in, for seeding the query when nothing is selected.
   *
   * The block's text is assembled the way a search assembles it, placeholders
   * and all, so the caret's offset into it means the same thing in both.
   */
  getWordAtCursor(): string {
    return this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const selection = view.state.selection
      if (!selection.empty) return ""

      const parent = selection.$from.parent
      if (!parent.isTextblock) return ""

      let text = ""
      parent.forEach((child) => {
        if (child.isText) text += child.text
        else text += INLINE_NODE_PLACEHOLDER.repeat(child.nodeSize)
      })

      return wordAt(text, selection.$from.parentOffset)
    })
  }

  setSelection(sel: { anchor: number; head: number }) {
    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state

      const maxPos = state.doc.content.size
      const safeAnchor = Math.max(0, Math.min(sel.anchor, maxPos))

      try {
        const resolvedPos = state.doc.resolve(safeAnchor)
        const newSel = Selection.near(resolvedPos)

        const tr = state.tr.setSelection(newSel)
        view.dispatch(tr)
      } catch (e) {
        console.warn("Selection placement failed:", e)
      }
    })
  }

  //

  /**
   * A binary tab has no editor to put the caret in. Every other `_editor!` here
   * is reached through a caller that checked `isBinary` first, but activating a
   * tab does not get to choose which kind it is.
   */
  focus() {
    if (!this._editor) return

    this._editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      view.focus()
    })
  }

  destroy() {
    this._editor?.destroy()
    this._editorBox.remove()
    this._tabBox.remove()
  }

  //

  setActive() {
    this._editorBox.classList.add(CLASS_SELECTED)
    this._tabBox.classList.add(CLASS_SELECTED)
    this.focus()
  }

  setDeactive() {
    this._editorBox.classList.remove(CLASS_SELECTED)
    this._tabBox.classList.remove(CLASS_SELECTED)
  }

  //

  setTabSpanTextContent(text: string) {
    this._tabSpan.textContent = text
  }

  setTabButtonTextContent(text: string) {
    this._tabButton.textContent = text
  }

  //

  findAllMatches(searchText: string, options: SearchOptions): SearchMatch[] {
    const view = this._editor!.ctx.get(editorViewCtx)
    const { doc } = view.state

    const matches: SearchMatch[] = []

    if (!searchText) return matches

    const regex = buildSearchRegex(searchText, options)
    const range = this._activeSearchRange()

    doc.descendants((node, pos) => {
      if (!node.isTextblock) return true

      // Whole blocks outside the range have nothing to offer.
      if (!blockTouchesSearchRange(pos, node.nodeSize, range)) return false

      // Concatenate the block's inline content so matches can cross
      // mark boundaries (e.g. a word partially bolded).
      let text = ""
      node.forEach((child) => {
        if (child.isText) text += child.text
        else text += INLINE_NODE_PLACEHOLDER.repeat(child.nodeSize)
      })

      const contentStart = pos + 1
      regex.lastIndex = 0

      // The query is escaped literal text and never empty, so every match
      // consumes at least one character — the loop cannot stall.
      let m: RegExpExecArray | null
      while ((m = regex.exec(text)) !== null) {
        // Matches spanning a non-text inline node are not real text.
        if (m[0].includes(INLINE_NODE_PLACEHOLDER)) continue

        const from = contentStart + m.index
        const to = from + m[0].length

        if (!isWithinSearchRange(from, to, range)) continue

        matches.push({ from, to })
      }

      return false
    })

    return matches
  }

  updateSearchState(state: SearchState | null) {
    this._searchState = state
  }

  /** Pins the incremental search to the caret, e.g. when the find widget opens. */
  captureSearchAnchor() {
    const view = this._editor!.ctx.get(editorViewCtx)
    this._searchAnchor = view.state.selection.from
  }

  /**
   * The text that was selected when the find widget opened, or null if none was.
   *
   * Read here and not later because the first search takes the selection over:
   * stepping to a match selects it, so by the time anyone presses the button the
   * editor no longer remembers what the user had picked out.
   */
  selectionRangeAtOpen(): SearchRange | null {
    const { selection } = this._editor!.ctx.get(editorViewCtx).state
    if (selection.empty) return null
    return { from: selection.from, to: selection.to }
  }

  /**
   * Offers `range` as the stretch searching may be confined to.
   *
   * Kept whether or not the option is on, so it goes on being mapped through
   * edits and turning the option back on later still means the same text.
   */
  offerSearchRange(range: SearchRange | null) {
    const view = this._editor!.ctx.get(editorViewCtx)
    this._ensureSearchHighlightPlugin(view)
    view.dispatch(view.state.tr.setMeta(this._searchHighlightKey, { range } satisfies SearchHighlightMeta))
  }

  /** Whether there is a range to confine searching to. */
  hasSearchRange(): boolean {
    return this._offeredRange() !== null
  }

  get searchInRange(): boolean {
    return this._searchInRange
  }

  /** Turns confinement on or off. Returns where it ended up; without a range, off. */
  toggleSearchInRange(): boolean {
    this._searchInRange = !this._searchInRange && this.hasSearchRange()
    return this._searchInRange
  }

  /** The range searching is confined to right now, or null for the whole document. */
  private _activeSearchRange(): SearchRange | null {
    return this._searchInRange ? this._offeredRange() : null
  }

  private _offeredRange(): SearchRange | null {
    const view = this._editor!.ctx.get(editorViewCtx)
    return this._searchHighlightKey.getState(view.state)?.range ?? null
  }

  searchNextMatch(query: string, direction: "up" | "down", options: SearchOptions): number {
    const matches = this.findAllMatches(query, options)
    if (!matches.length) {
      this.clearSearch()
      return -1
    }

    const view = this._editor!.ctx.get(editorViewCtx)
    const state = view.state
    const currentPos = state.selection.from

    let targetIndex = -1

    if (direction === "down") {
      targetIndex = matches.findIndex((match) => match.from > currentPos)
      if (targetIndex === -1) targetIndex = 0
    } else {
      for (let i = matches.length - 1; i >= 0; i--) {
        if (matches[i].to <= currentPos) {
          targetIndex = i
          break
        }
      }
      if (targetIndex === -1) targetIndex = matches.length - 1
    }

    // Deliberate navigation takes the anchor with it, so refining the query
    // afterwards continues from where the user actually is.
    this._searchAnchor = matches[targetIndex].from

    this.updateSearchState({
      query,
      matches,
      currentIndex: targetIndex,
      doc: state.doc,
    })

    this.focusCurrentMatch()
    return targetIndex
  }

  /**
   * Search for a query that is still being edited: the first match at or after the
   * anchor, which keeps the selection on one occurrence while the query grows and
   * returns to it when characters are deleted again.
   */
  searchFromAnchor(query: string, options: SearchOptions): number {
    const matches = this.findAllMatches(query, options)
    if (!matches.length) {
      this.clearSearch()
      return -1
    }

    const view = this._editor!.ctx.get(editorViewCtx)
    const state = view.state
    const anchor = this._searchAnchor ?? state.selection.from

    let targetIndex = matches.findIndex((match) => match.from >= anchor)
    if (targetIndex === -1) targetIndex = 0

    this.updateSearchState({
      query,
      matches,
      currentIndex: targetIndex,
      doc: state.doc,
    })

    this.focusCurrentMatch()
    return targetIndex
  }

  /**
   * Re-finds matches after the document changed, leaving the caret where the
   * user is typing.
   *
   * Editing with the widget open used to leave the counter describing a
   * document that no longer exists, and Replace stepping to the next match
   * instead of replacing, because the positions it held had gone stale.
   *
   * The current match becomes the first one the caret has not passed, so Enter
   * carries on from where the typing stopped.
   */
  refreshMatches(query: string, options: SearchOptions): number {
    const view = this._editor!.ctx.get(editorViewCtx)
    const matches = this.findAllMatches(query, options)

    if (!matches.length) {
      this.clearSearch()
      return 0
    }

    const caret = view.state.selection.from
    let currentIndex = matches.findIndex((match) => match.to >= caret)
    if (currentIndex === -1) currentIndex = matches.length - 1

    this.updateSearchState({ query, matches, currentIndex, doc: view.state.doc })

    this._ensureSearchHighlightPlugin(view)
    // Meta only: no selection, no scroll. Repainting the highlights must not
    // pull the view away from what is being typed.
    view.dispatch(
      view.state.tr.setMeta(this._searchHighlightKey, { matches, currentIndex } satisfies SearchHighlightMeta)
    )

    return matches.length
  }

  isSearchStateStale(): boolean {
    if (!this._searchState) return true
    const view = this._editor!.ctx.get(editorViewCtx)
    return this._searchState.doc !== view.state.doc
  }

  focusCurrentMatch() {
    if (!this._searchState) return

    const { matches, currentIndex } = this._searchState
    const match = matches[currentIndex]

    const view = this._editor!.ctx.get(editorViewCtx)
    this._ensureSearchHighlightPlugin(view)

    const state = view.state
    const tr = state.tr
      .setSelection(TextSelection.create(state.doc, match.from, match.to))
      .setMeta(this._searchHighlightKey, { matches, currentIndex } satisfies SearchHighlightMeta)
      .scrollIntoView()

    view.dispatch(tr)
  }

  // Registered once per editor; afterwards highlights are driven purely by
  // meta transactions, and doc edits remap them via DecorationSet.map.
  private _ensureSearchHighlightPlugin(view: EditorView) {
    const key = this._searchHighlightKey
    if (key.get(view.state)) return

    const searchHighlightPlugin = new Plugin<SearchPluginState>({
      key,
      state: {
        init: () => ({ decorations: DecorationSet.empty, range: null }),
        apply: (tr, old) => {
          const range = old.range && tr.docChanged ? mapSearchRange(old.range, tr.mapping) : old.range
          const mapped = () => old.decorations.map(tr.mapping, tr.doc)
          const meta = tr.getMeta(key) as SearchHighlightMeta | undefined

          if (meta === undefined) return { decorations: mapped(), range }
          if (meta !== null && "range" in meta) return { decorations: mapped(), range: meta.range }
          // The range outlives the highlights: a query that found nothing has
          // said nothing about where the user wanted to look.
          if (meta === null || !meta.matches.length) return { decorations: DecorationSet.empty, range }

          // Only the matches worth drawing; see paintedMatchRange.
          const { start, end } = paintedMatchRange(meta.matches.length, meta.currentIndex)

          const decorations = []
          for (let idx = start; idx < end; idx++) {
            const match = meta.matches[idx]
            decorations.push(
              Decoration.inline(match.from, match.to, {
                class: idx === meta.currentIndex ? "search-highlight-current" : "search-highlight",
              })
            )
          }

          return { decorations: DecorationSet.create(tr.doc, decorations), range }
        },
      },
      props: {
        decorations: (state) => key.getState(state)?.decorations,
      },
    })

    const newState = view.state.reconfigure({
      plugins: [...view.state.plugins, searchHighlightPlugin],
    })
    view.updateState(newState)
  }

  replaceCurrentMatch(replaceText: string, preserveCase = false): boolean {
    if (!this._searchState) return false
    // Matches computed against an older doc must not rewrite arbitrary ranges.
    if (this.isSearchStateStale()) return false

    const { matches, currentIndex } = this._searchState
    if (currentIndex < 0 || currentIndex >= matches.length) return false

    let replaced = false

    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state
      const { from, to } = matches[currentIndex]

      // Carry the match's own marks over, or replacing a word inside bold,
      // a link or code would silently flatten it to plain text.
      const marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to))

      const text = preserveCase ? preserveCaseOf(state.doc.textBetween(from, to), replaceText) : replaceText

      // schema.text("") throws; an empty replacement means deletion.
      let tr = text ? state.tr.replaceWith(from, to, state.schema.text(text, marks)) : state.tr.delete(from, to)

      const cursorPos = tr.mapping.map(from) + text.length
      tr = tr.setSelection(TextSelection.create(tr.doc, cursorPos))

      view.dispatch(tr)
      replaced = true
    })

    if (replaced) this.markAsModified()
    return replaced
  }

  replaceAllMatches(searchText: string, replaceText: string, options: SearchOptions, preserveCase = false): number {
    if (!searchText) return 0

    let replacedCount = 0

    this._editor!.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const state = view.state

      const matches = this.findAllMatches(searchText, options)
      if (!matches.length) return

      let tr = state.tr

      // Replace backwards to avoid shifting positional indices for upcoming matches
      for (let i = matches.length - 1; i >= 0; i--) {
        const { from, to } = matches[i]

        // Marks resolve against the pre-edit doc the matches were found in;
        // going backwards keeps those positions valid.
        const marks = state.doc.resolve(from).marksAcross(state.doc.resolve(to))

        // Each hit is recased from its own text, so one Replace All over a
        // case-insensitive search keeps `Foo`, `FOO` and `foo` spelled apart.
        const text = preserveCase ? preserveCaseOf(state.doc.textBetween(from, to), replaceText) : replaceText

        // schema.text("") throws; an empty replacement means deletion.
        tr = text ? tr.replaceWith(from, to, state.schema.text(text, marks)) : tr.delete(from, to)
        replacedCount++
      }

      if (replacedCount > 0) {
        view.dispatch(tr)
        this.markAsModified()
      }
    })

    return replacedCount
  }

  markAsModified() {
    if (this._onInput) {
      this._onInput(this)
    }
  }

  /** Drops the highlights and the match list. The range survives; see the plugin. */
  clearSearch() {
    this._searchState = null

    const view = this._editor!.ctx.get(editorViewCtx)
    const pluginState = this._searchHighlightKey.getState(view.state)
    if (!pluginState || pluginState.decorations === DecorationSet.empty) return

    view.dispatch(view.state.tr.setMeta(this._searchHighlightKey, null))
  }

  /** Forgets the range as well — what closing the find widget means. */
  clearSearchRange() {
    this._searchInRange = false
    if (this._offeredRange()) this.offerSearchRange(null)
  }

  get searchState() {
    return this._searchState
  }

  //

  setSuppressInputEvent(value: boolean) {
    this._suppressInputEvent = value
  }

  shouldSuppressInputEvent(): boolean {
    return this._suppressInputEvent
  }

  //

  get isBinary(): boolean {
    return this._isBinary
  }

  get editor(): Editor | null {
    return this._editor
  }

  get tabBox(): HTMLElement {
    return this._tabBox
  }

  get tabSpan() {
    return this._tabSpan
  }

  get tabButton() {
    return this._tabButton
  }

  get editorBox() {
    return this._editorBox
  }
}
