import type { ContextKeyService, FocusManager } from "@renderer/core"

/**
 * Feeds state the context keys describe into the service from whoever owns it.
 *
 * Only the focused zone is wired here; the tree, editor and side keys arrive
 * with the commands whose `when` conditions read them, so a key never exists
 * without a producer.
 */
export function handleContextKeys(focusManager: FocusManager, contextKeyService: ContextKeyService) {
	contextKeyService.set("focusedTask", focusManager.getFocusedTask())

	focusManager.onDidChangeFocus((task) => {
		contextKeyService.set("focusedTask", task)
	})
}
