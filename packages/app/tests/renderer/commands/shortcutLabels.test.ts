import { describe, expect, it } from "vitest"

import { TAB_CONTEXT_MENU_BINDINGS, TREE_CONTEXT_MENU_BINDINGS } from "@renderer/commands/contextMenuBindings"
import { KEYBINDINGS } from "@renderer/commands/keybindings"
import { MENU_BINDINGS } from "@renderer/commands/menuBindings"
import { shortcutLabelFor } from "@renderer/commands/shortcutLabels"

function labelOf(element: string) {
  const binding =
    MENU_BINDINGS.find((b) => b.element === element) ??
    TREE_CONTEXT_MENU_BINDINGS.find((b) => b.element === element) ??
    TAB_CONTEXT_MENU_BINDINGS.find((b) => b.element === element)

  return shortcutLabelFor(binding!)
}

describe("shortcut labels", () => {
  // These were the strings hand-written into index.html. Deriving them has to
  // reproduce every one, or the change is not a de-duplication.
  it("reproduces the labels the markup used to carry", () => {
    const expected: Record<string, string> = {
      newTab: "Ctrl+T",
      openFile: "Ctrl+O",
      openDirectory: "Ctrl+Shift+O",
      save: "Ctrl+S",
      saveAs: "Ctrl+Shift+S",
      settings: "Ctrl+,",
      undo: "Ctrl+Z",
      redo: "Ctrl+Shift+Z",
      cut: "Ctrl+X",
      copy: "Ctrl+C",
      paste: "Ctrl+V",
      zoomIn: "Ctrl++",
      zoomOut: "Ctrl+-",
      zoomReset: "Ctrl+0",
      information: "F1",

      treeContextCut: "Ctrl+X",
      treeContextCopy: "Ctrl+C",
      treeContextPaste: "Ctrl+V",
      treeContextRename: "F2",
      treeContextDelete: "DELETE",

      tabContextClose: "Ctrl+W",
    }

    for (const [element, key] of Object.entries(expected)) {
      expect(labelOf(element), `${element} should be labelled ${key}`).toBe(key)
    }
  })

  it("leaves items without a key unlabelled", () => {
    for (const element of ["saveAll", "fileTree", "tabContextCloseOthers", "tabContextCloseAll"]) {
      expect(labelOf(element), `${element} should have no label`).toBe("")
    }
  })

  // Find and Replace are one command with different arguments, so a label
  // looked up by command alone would give both the same key.
  it("distinguishes menu items that differ only by argument", () => {
    expect(labelOf("find")).toBe("Ctrl+F")
    expect(labelOf("replace")).toBe("Ctrl+H")
  })

  // Alt+F4 belongs to the window manager; no binding of ours can describe it.
  it("keeps a key the app does not own", () => {
    expect(labelOf("exit")).toBe("Alt+F4")
    expect(KEYBINDINGS.some((binding) => binding.command === "app.exit")).toBe(false)
  })

  // The right-clicked target is its own command id, so these rows name a
  // command no key is bound to while a key does reach the same action.
  it("borrows the key from the sibling id where the channels are split", () => {
    const paste = TREE_CONTEXT_MENU_BINDINGS.find((b) => b.element === "treeContextPaste")!
    const close = TAB_CONTEXT_MENU_BINDINGS.find((b) => b.element === "tabContextClose")!

    expect(KEYBINDINGS.some((b) => b.command === paste.commands[0])).toBe(false)
    expect(KEYBINDINGS.some((b) => b.command === close.commands[0])).toBe(false)

    expect(shortcutLabelFor(paste)).toBe("Ctrl+V")
    expect(shortcutLabelFor(close)).toBe("Ctrl+W")
  })
})
