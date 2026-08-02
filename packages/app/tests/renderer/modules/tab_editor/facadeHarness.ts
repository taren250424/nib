import { editorViewCtx } from "@milkdown/kit/core"
import { TextSelection } from "prosemirror-state"
import { vi } from "vitest"

import { CommandQueue, ContextKeyService } from "@renderer/core"
import { TabDragState } from "@renderer/modules/tab_editor/TabDragState"
import { TabEditorElements } from "@renderer/modules/tab_editor/TabEditorElements"
import { TabEditorFacade } from "@renderer/modules/tab_editor/TabEditorFacade"
import { TabEditorRenderer } from "@renderer/modules/tab_editor/TabEditorRenderer"
import { TabEditorStore } from "@renderer/modules/tab_editor/TabEditorStore"
import type { TabEditorView } from "@renderer/modules/tab_editor/TabEditorView"

import { installLayoutShim } from "./editorHarness"

/**
 * The find widget plus the two containers tabs and editors are appended to,
 * carrying the ids TabEditorElements looks for.
 *
 * The widget is here because it is where the facade writes what it knows:
 * `find-info` holds the counter and `find-option-selection` the per-document
 * toggle, and both were eye-only until this harness existed.
 *
 * Exported separately from the builder so a harness that needs the tree in the
 * same document can mount both.
 */
export const TAB_EDITOR_MARKUP = `
  <div id="tab-context-menu">
    <div id="tab-context-close"></div>
    <div id="tab-context-close-others"></div>
    <div id="tab-context-close-right"></div>
    <div id="tab-context-close-all"></div>
  </div>
  <div id="tab-container"></div>
  <div id="editor-container">
    <div id="find-replace-container">
      <div id="find">
        <button id="find-replace-toggle"></button>
        <input id="find-input" type="text" />
        <button id="find-option-case"></button>
        <button id="find-option-word"></button>
        <button id="find-option-selection"></button>
        <button id="find-up"></button>
        <button id="find-down"></button>
        <button id="close-find-replace"></button>
        <span id="find-info"></span>
      </div>
      <div id="replace">
        <input id="replace-input" type="text" />
        <button id="find-option-preserve-case"></button>
        <button id="replace-current"></button>
        <button id="replace-all"></button>
        <span id="replace-info"></span>
      </div>
    </div>
    <div id="word-count"></div>
  </div>
`

export type FacadeHarness = ReturnType<typeof buildFacadeHarness>

/**
 * A facade wired to real tabs holding real editors, minus the DI container.
 *
 * Everything the facade does across more than one tab — clearing the highlights
 * it left in the tab being left, holding the counter still, redrawing the Find
 * in Selection button for the document that has arrived under the widget —
 * needs two live views to be visible at all, which is what this builds.
 */
export function createFacadeHarness(): FacadeHarness {
  document.body.innerHTML = TAB_EDITOR_MARKUP
  return buildFacadeHarness()
}

/**
 * Wires the facade to markup that is already in the document.
 *
 * The context key service and the queue are parameters because both are
 * singletons in the app: a harness that also builds the tree or the command
 * manager has to hand every piece the same ones, or auto save stops sharing
 * the queue with the commands it is serialized against.
 */
export function buildFacadeHarness(
  contextKeyService: ContextKeyService = new ContextKeyService(),
  commandQueue: CommandQueue = new CommandQueue()
) {
  installLayoutShim()
  installIpcStub()

  const store = new TabEditorStore()
  const elements = new TabEditorElements()
  const renderer = new TabEditorRenderer(elements)
  const facade = new TabEditorFacade(store, renderer, new TabDragState(), contextKeyService, commandQueue)

  return { facade, store, renderer, elements, contextKeyService, commandQueue }
}

/**
 * The main-process calls a tab makes on its own: a throttled temp save while
 * editing, and a session sync after a rename.
 *
 * Added to whatever is already stubbed rather than replacing it, so a harness
 * that stubs the tree's calls too can build the two in either order.
 */
function installIpcStub() {
  window.rendererToMain = {
    ...window.rendererToMain,
    tempSave: vi.fn().mockResolvedValue({ result: true }),
    save: vi.fn().mockResolvedValue({ result: false }),
    syncTabSessionFromRenderer: vi.fn().mockResolvedValue(true),
  } as unknown as typeof window.rendererToMain
}

/**
 * Selects a stretch of the document, which the mouse is otherwise the only way
 * to do — and what the find widget reads on the way in to decide whether the
 * selection is what to look for or where to look.
 */
export function selectInEditor(view: TabEditorView, from: number, to: number) {
  view.editor!.action((ctx) => {
    const editorView = ctx.get(editorViewCtx)
    editorView.dispatch(editorView.state.tr.setSelection(TextSelection.create(editorView.state.doc, from, to)))
  })
}

/**
 * Types `text` at the caret, replacing the selection as typing does.
 *
 * The edit goes through the editor's own dispatchTransaction, which is what
 * tells the facade that whatever describes the document is now out of date.
 */
export function typeInEditor(view: TabEditorView, text: string) {
  view.editor!.action((ctx) => {
    const editorView = ctx.get(editorViewCtx)
    editorView.dispatch(editorView.state.tr.insertText(text))
  })
}

/**
 * Takes focus off the editor, which is one of the moments auto save listens for.
 *
 * Dispatched on the editor's own node because that is where ProseMirror puts the
 * handler `handleDOMEvents` asked for.
 */
export function blurEditor(view: TabEditorView) {
  view.editor!.action((ctx) => {
    ctx.get(editorViewCtx).dom.dispatchEvent(new FocusEvent("blur"))
  })
}

type TabSpec = { id: number; content?: string; path?: string; isBinary?: boolean }

/** Opens a tab the way the session and File > Open do; it becomes the active one. */
export async function openTab(
  harness: FacadeHarness,
  { id, content = "", path = `root/${id}.md`, isBinary = false }: TabSpec
) {
  const fileName = path.slice(path.lastIndexOf("/") + 1)
  await harness.facade.addTab(id, path, fileName, content, isBinary, true, false)

  return harness.facade.getActiveTabEditorView()
}
