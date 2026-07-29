import type { Task } from "./ui_zones"

/**
 * State a command's `when` condition may ask about.
 *
 * These already exist scattered across the facades; naming them here gives the
 * command layer one vocabulary to express enablement in, instead of the mix of
 * inline guards, handler-level focus checks and hardcoded menu greying that
 * currently disagree with each other.
 */
export type ContextKeyMap = {
	focusedTask: Task

	treeHasSelection: boolean
	treeSelectionIsDirectory: boolean
	treeHasClipboard: boolean
	canUndoTree: boolean
	canRedoTree: boolean

	hasActiveEditor: boolean
	editorIsBinary: boolean
	editorIsDirty: boolean
	findReplaceOpen: boolean

	sideOpen: boolean
}

export type ContextKey = keyof ContextKeyMap

export const DEFAULT_CONTEXT_KEYS: ContextKeyMap = {
	focusedTask: "none",

	treeHasSelection: false,
	treeSelectionIsDirectory: false,
	treeHasClipboard: false,
	canUndoTree: false,
	canRedoTree: false,

	hasActiveEditor: false,
	editorIsBinary: false,
	editorIsDirty: false,
	findReplaceOpen: false,

	sideOpen: false,
}
