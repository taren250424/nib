import type { MenuElements } from "../modules"
import type { CommandId } from "./ids"

export type MenuBinding = {
	/** Which element of MenuElements this row drives. */
	element: keyof MenuElements
	/**
	 * Candidates, in the order they are tried. Several exist where one label
	 * stands for different work depending on focus — Edit > Cut is the tree's cut
	 * or the editor's — and the item is enabled when any of them applies.
	 */
	commands: readonly CommandId[]
	args?: readonly unknown[]
}

/**
 * The menu bar, as bindings from an item to the commands behind it.
 *
 * Keeping the click and the enabled state on one row is the point: they used to
 * be expressed separately, and the only item that greyed itself out disagreed
 * with the command it invoked about when it should.
 */
export const MENU_BINDINGS: readonly MenuBinding[] = [
	// File
	{ element: "newTab", commands: ["file.newTab"] },
	{ element: "openFile", commands: ["file.open"] },
	{ element: "openDirectory", commands: ["file.openDirectory"] },
	{ element: "save", commands: ["file.save"] },
	{ element: "saveAs", commands: ["file.saveAs"] },
	{ element: "saveAll", commands: ["file.saveAll"] },
	{ element: "settings", commands: ["settings.open"] },
	{ element: "exit", commands: ["app.exit"] },

	// Edit
	{ element: "undo", commands: ["tree.undo", "editor.undo"] },
	{ element: "redo", commands: ["tree.redo", "editor.redo"] },
	{ element: "cut", commands: ["tree.cut", "editor.cut"] },
	{ element: "copy", commands: ["tree.copy", "editor.copy"] },
	{ element: "paste", commands: ["tree.pasteFromShortcut", "editor.paste"] },
	{ element: "find", commands: ["find.toggle"], args: [false] },
	{ element: "replace", commands: ["find.toggle"], args: [true] },

	// View
	{ element: "fileTree", commands: ["view.toggleSide"] },
	{ element: "zoomIn", commands: ["view.zoomIn"] },
	{ element: "zoomOut", commands: ["view.zoomOut"] },
	{ element: "zoomReset", commands: ["view.zoomReset"] },

	// Help
	{ element: "information", commands: ["help.showInformation"] },
]
