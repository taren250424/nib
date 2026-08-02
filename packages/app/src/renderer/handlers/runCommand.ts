import type { CommandId } from "@renderer/commands/ids"
import type { CommandRegistry, FocusTracker } from "@renderer/core"

export type RunCommand = (id: CommandId, ...args: unknown[]) => Promise<void>

/**
 * How a UI element invokes a command.
 *
 * This is what is left of the dispatcher once the keyboard, the menus and the
 * context menus name commands through their own binding tables: the elements
 * that remain — buttons, the find widget, tree clicks, a drop — each stand for
 * exactly one command, so an [event][task][source] table had nothing left to
 * resolve. Naming the id at the call site is also checked, which a table of
 * event strings was not.
 *
 * The focus is settled first, as the dispatcher did. Clicking moves it as the
 * default action of the mousedown that published the current value, and a
 * command's `when` is answered from what was published.
 */
export function createCommandRunner(commandRegistry: CommandRegistry, focusTracker: FocusTracker): RunCommand {
  return (id, ...args) => {
    focusTracker.syncFocus()
    return commandRegistry.execute(id, ...args)
  }
}
