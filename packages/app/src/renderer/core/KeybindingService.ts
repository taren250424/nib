import { inject, injectable } from "inversify"

import { DI } from "../constants"
import type { Keybinding } from "../commands/keybindings"
import { CommandRegistry } from "./CommandRegistry"
import { getKeyString, REPEATABLE_KEYS } from "./keys"

/**
 * Turns key presses into commands.
 *
 * Several bindings may share a key; the first whose command applies in the
 * current context wins. When none applies the key is left untouched, which is
 * how the editor keeps its native handling of keys the rest of the app also
 * uses. Suppressing the default is therefore a consequence of having matched
 * something, not a decision made up front from which zone has focus.
 */
@injectable()
export class KeybindingService {
  private readonly bindings = new Map<string, Keybinding[]>()

  constructor(@inject(DI.CommandRegistry) private readonly commandRegistry: CommandRegistry) {}

  register(binding: Keybinding) {
    const existing = this.bindings.get(binding.key)
    if (existing) existing.push(binding)
    else this.bindings.set(binding.key, [binding])
  }

  registerAll(bindings: readonly Keybinding[]) {
    for (const binding of bindings) this.register(binding)
  }

  /** The bindings on a key, in the order they are tried. */
  bindingsFor(key: string): readonly Keybinding[] {
    return this.bindings.get(key) ?? []
  }

  /** The binding a key press resolves to right now, or undefined if none applies. */
  resolve(key: string): Keybinding | undefined {
    const candidates = this.bindings.get(key)
    if (!candidates) return undefined

    const command = this.commandRegistry.firstEnabled(candidates.map((binding) => binding.command))
    return candidates.find((binding) => binding.command === command)
  }

  handleKeyEvent(e: KeyboardEvent): void {
    // A key the editor's own keymap consumed still bubbles up here — Milkdown's
    // history handles Mod-Z at the target and prevents the default, but not the
    // propagation. Running the bound command on top would do the action twice.
    if (e.defaultPrevented) return

    const key = getKeyString(e)

    const binding = this.resolve(key)
    if (!binding) return

    if (!binding.passThrough) e.preventDefault()

    if (e.repeat && !REPEATABLE_KEYS.has(key)) return

    void this.commandRegistry.execute(binding.command, ...(binding.args ?? []))
  }
}
