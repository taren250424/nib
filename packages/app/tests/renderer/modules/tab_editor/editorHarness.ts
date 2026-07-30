import { Editor, editorViewCtx, parserCtx, rootCtx } from "@milkdown/kit/core"
import { commonmark } from "@milkdown/kit/preset/commonmark"
import { history } from "@milkdown/kit/plugin/history"

import { TabEditorView } from "@renderer/modules/tab_editor/TabEditorView"

/**
 * jsdom has no layout engine, and ProseMirror measures the document whenever a
 * transaction scrolls a match into view. Without these it throws
 * "getClientRects is not a function" and nothing that steps to a match can run.
 *
 * Returning nothing to measure is the honest answer: the geometry is fake, so
 * anything that depends on where things are on screen (drag, resize) still
 * cannot be tested here — only what the document says.
 */
export function installLayoutShim() {
  if (!Range.prototype.getClientRects) {
    Range.prototype.getClientRects = () => [] as unknown as DOMRectList
  }
  if (!Range.prototype.getBoundingClientRect) {
    Range.prototype.getBoundingClientRect = () => new DOMRect()
  }
  if (!Element.prototype.getClientRects) {
    Element.prototype.getClientRects = () => [] as unknown as DOMRectList
  }
}

/** The view reports edits and blurs; nothing here is listening. */
const ignore = () => undefined

/**
 * A real Milkdown editor holding `markdown`, wrapped in a real TabEditorView.
 *
 * The same preset and plugins the app builds with, minus the theme, so search
 * and replace run against the document structure they run against in the app.
 * Tabs are bare elements: nothing here reads them.
 */
export async function createEditorView(markdown: string): Promise<TabEditorView> {
  installLayoutShim()

  const editorBox = document.createElement("div")
  document.body.appendChild(editorBox)

  const editor = await Editor.make()
    .config((ctx) => ctx.set(rootCtx, editorBox))
    .use(commonmark)
    .use(history)
    .create()

  editor.action((ctx) => {
    const parser = ctx.get(parserCtx)
    const view = ctx.get(editorViewCtx)
    const doc = parser(markdown)!

    view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, doc.content))
  })

  return new TabEditorView(
    document.createElement("div"),
    document.createElement("span"),
    document.createElement("button"),
    editorBox,
    editor,
    false,
    ignore,
    ignore
  )
}
