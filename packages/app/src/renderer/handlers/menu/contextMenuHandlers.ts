import type { ContextMenuBinding } from "@renderer/commands/contextMenuBindings"
import { DOM } from "@renderer/constants"
import type { CommandRegistry, FocusManager } from "@renderer/core"

/**
 * Drives a context menu from the command registry, the way the menu bar is.
 *
 * The two halves are split because a context menu is only worth an answer while
 * it is open: clicks are wired once, and the greying is repainted by the caller
 * when the menu opens — after it has moved the selection to whatever was
 * right-clicked, which is part of what the answer depends on.
 */
export function bindContextMenu<E extends object>(
  commandRegistry: CommandRegistry,
  bindings: readonly ContextMenuBinding<E>[],
  elements: E,
  hide: () => void
) {
  for (const binding of bindings) {
    const element = elements[binding.element] as HTMLElement

    // The menu closes after the command, not before: paste and close-one read
    // the right-clicked target, and closing forgets it. A failed command still
    // closes, and so does a click on a greyed-out item.
    element.addEventListener("click", async () => {
      try {
        const command = commandRegistry.firstEnabled(binding.commands)
        if (command) await commandRegistry.execute(command, ...(binding.args ?? []))
      } catch (err) {
        console.error(`[contextMenuHandlers] ${binding.commands.join("/")} failed:`, err)
      } finally {
        hide()
      }
    })
  }
}

/**
 * Greys out the items whose commands do not apply right now.
 *
 * The focus is re-read first. Right-clicking moves it as the default action of
 * the mousedown that precedes this, so the value published from that mousedown
 * was read a moment too early; by now activeElement has settled. Costs nothing
 * when it has not moved.
 */
export function renderContextMenuState<E extends object>(
  commandRegistry: CommandRegistry,
  focusManager: FocusManager,
  bindings: readonly ContextMenuBinding<E>[],
  elements: E
) {
  focusManager.syncFocus()

  for (const binding of bindings) {
    const element = elements[binding.element] as HTMLElement
    const enabled = commandRegistry.firstEnabled(binding.commands) !== undefined
    element.classList.toggle(DOM.CLASS_DEACTIVE, !enabled)
  }
}
