/**
 * Every command the app can run.
 *
 * Named `<area>.<action>`. A `.native` suffix marks the variant that lets the
 * browser perform the edit itself — the shortcut path for clipboard and history
 * operations inside the editor, where preventDefault is deliberately not called.
 * Splitting those into their own ids is what lets the invocation channel
 * (keyboard, menu, context menu, drag) become a binding rather than a runtime
 * branch, once keybindings and menus address commands directly.
 */
export type CommandId =
	| "editor.undo"
	| "editor.undo.native"
	| "editor.redo"
	| "editor.redo.native"
	| "tree.undo"
	| "tree.redo"
	//
	| "file.newTab"
	| "file.open"
	| "file.openDirectory"
	| "file.save"
	| "file.saveAs"
	| "file.saveAll"
	//
	| "tab.close"
	| "tab.closeOthers"
	| "tab.closeToRight"
	| "tab.closeAll"
	//
	| "tree.create"
	| "tree.rename"
	| "tree.delete"
	| "tree.open"
	| "tree.expandDirectory"
	//
	| "tree.cut"
	| "tree.copy"
	| "tree.pasteFromContextMenu"
	| "tree.pasteFromShortcut"
	| "tree.pasteFromDrag"
	//
	| "editor.cut"
	| "editor.cut.native"
	| "editor.copy"
	| "editor.paste"
	| "editor.paste.native"
	//
	| "find.toggle"
	| "find.queryChanged"
	| "find.replaceQueryChanged"
	| "find.toggleOption"
	| "find.next"
	| "find.replace"
	| "find.replaceAll"
	| "find.close"
	| "find.submit"
	| "find.submitBackward"
	//
	| "settings.apply"
	| "settings.applyAndSave"
