import { MENU_BINDINGS } from "@renderer/commands/menuBindings"
import { DOM } from "@renderer/constants"
import type { CommandRegistry, ContextKeyService } from "@renderer/core"
import type { MenuElements } from "@renderer/modules"

/**
 * Drives the menu bar from the command registry: a click runs whichever
 * candidate applies, and the item greys itself out when none does.
 *
 * The enabled state is repainted from context changes rather than read when the
 * menu opens, because the same answer has to be available before anything is
 * clicked.
 */
export function handleCommandMenus(
  commandRegistry: CommandRegistry,
  contextKeyService: ContextKeyService,
  menuElements: MenuElements
) {
  for (const binding of MENU_BINDINGS) {
    const element = menuElements[binding.element] as HTMLElement

    element.addEventListener("click", () => {
      const command = commandRegistry.firstEnabled(binding.commands)
      if (!command) return

      void commandRegistry.execute(command, ...(binding.args ?? []))
    })
  }

  const render = () => {
    for (const binding of MENU_BINDINGS) {
      const element = menuElements[binding.element] as HTMLElement
      const enabled = commandRegistry.firstEnabled(binding.commands) !== undefined
      element.classList.toggle(DOM.CLASS_DEACTIVE, !enabled)
    }
  }

  contextKeyService.onDidChange(render)
  render()
}
