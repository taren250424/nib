import type { ContextKeyService, FocusTracker } from "@renderer/core"

/**
 * Feeds state the context keys describe into the service from whoever owns it.
 *
 * Only the focused zone is wired here; the tree, editor and side keys arrive
 * with the commands whose `when` conditions read them, so a key never exists
 * without a producer.
 */
export function handleContextKeys(focusTracker: FocusTracker, contextKeyService: ContextKeyService) {
  contextKeyService.set("focusedTask", focusTracker.getFocusedTask())

  focusTracker.onDidChangeFocus((task) => {
    contextKeyService.set("focusedTask", task)
  })
}
