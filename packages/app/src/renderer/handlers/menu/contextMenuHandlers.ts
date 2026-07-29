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

    // The menu closes before the command runs, not after. Rename opens a prompt
    // and does not resolve until the user is done with it, so closing afterwards
    // left the menu sitting on top of the input it had just opened.
    //
    // Which item was right-clicked survives the close for the same reason —
    // paste and close-one read it — and is overwritten by the next right-click.
    element.addEventListener("click", async () => {
      const command = commandRegistry.firstEnabled(binding.commands)
      hide()
      if (!command) return

      try {
        await commandRegistry.execute(command, ...(binding.args ?? []))
      } catch (err) {
        console.error(`[contextMenuHandlers] ${binding.commands.join("/")} failed:`, err)
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
