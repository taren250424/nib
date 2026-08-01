import type { CommandId } from "./ids"

export type Keybinding = {
  /** As produced by getKeyString: modifiers in Ctrl, Shift, Alt order, key upper-cased. */
  key: string
  command: CommandId
  args?: readonly unknown[]

  /**
   * Run the command but let the browser handle the key too.
   *
   * Used where the editor performs the edit itself and the command only records
   * that it happened — cutting and pasting inside the editor go through the
   * browser's clipboard, and suppressing the default would leave nothing to do.
   */
  passThrough?: boolean
}

/**
 * Every keyboard shortcut, as a binding from a key to a command.
 *
 * Bindings for one key are tried in order and the first whose command applies
 * wins. If none applies the key is left alone — no preventDefault — so the
 * editor's own handling still sees it. That is what makes Ctrl+C in the editor
 * a plain browser copy while the same key cuts a selection in the tree, without
 * either side knowing about the other.
 */
export const KEYBINDINGS: readonly Keybinding[] = [
  // History. In the editor this runs the same prosemirror-history command the
  // editor's own keymap would, and it also reaches the editor from the find
  // widget, where focus sits in an input after a replace.
  { key: "Ctrl+Z", command: "tree.undo" },
  { key: "Ctrl+Z", command: "editor.undo" },
  { key: "Ctrl+Shift+Z", command: "tree.redo" },
  { key: "Ctrl+Shift+Z", command: "editor.redo" },

  // Files
  { key: "Ctrl+T", command: "file.newTab" },
  { key: "Ctrl+O", command: "file.open" },
  { key: "Ctrl+Shift+O", command: "file.openDirectory" },
  { key: "Ctrl+S", command: "file.save" },
  { key: "Ctrl+Shift+S", command: "file.saveAs" },
  { key: "Ctrl+W", command: "tab.closeActive" },
  { key: "Ctrl+,", command: "settings.open" },

  // Tree
  { key: "ARROWUP", command: "tree.focusUp", args: [false] },
  { key: "ARROWDOWN", command: "tree.focusDown", args: [false] },
  { key: "Shift+ARROWUP", command: "tree.focusUp", args: [true] },
  { key: "Shift+ARROWDOWN", command: "tree.focusDown", args: [true] },
  { key: "F2", command: "tree.rename" },
  { key: "DELETE", command: "tree.delete" },

  // Clipboard. The tree bindings come first because they are the ones that need
  // the key suppressed; inside the editor the browser does the work.
  { key: "Ctrl+X", command: "tree.cut" },
  { key: "Ctrl+X", command: "editor.cut.native", passThrough: true },
  { key: "Ctrl+C", command: "tree.copy" },
  { key: "Ctrl+V", command: "tree.pasteFromShortcut" },
  { key: "Ctrl+V", command: "editor.paste.native", passThrough: true },

  // Find and replace
  { key: "Ctrl+F", command: "find.toggle", args: [false] },
  { key: "Ctrl+H", command: "find.toggle", args: [true] },
  // Step through matches without the widget, on the query it was last given.
  { key: "F3", command: "find.next", args: ["down"] },
  { key: "Shift+F3", command: "find.next", args: ["up"] },
  { key: "Ctrl+Alt+ENTER", command: "find.replaceAll" },
  // Esc closes the find box from the editor or the box itself, and calls off
  // a pending cut from the tree — the zone scopes keep the two from racing.
  // When neither applies the key falls through to the editor.
  { key: "ESC", command: "find.close" },
  { key: "ESC", command: "tree.clearClipboard" },
  { key: "ENTER", command: "find.submit" },
  { key: "ENTER", command: "tree.open" },
  { key: "Shift+ENTER", command: "find.submitBackward" },

  // View
  { key: "Ctrl++", command: "view.zoomIn" },
  { key: "Ctrl+-", command: "view.zoomOut" },
  { key: "Ctrl+0", command: "view.zoomReset" },

  // Help
  { key: "F1", command: "help.showInformation" },
]
