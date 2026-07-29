import type { CommandId } from "./ids"
import { KEYBINDINGS } from "./keybindings"

/** The rows both menu tables share, as far as labelling is concerned. */
type LabelledBinding = {
  commands: readonly CommandId[]
  args?: readonly unknown[]
  keyFrom?: CommandId
  keyLabel?: string
}

/**
 * A command and its arguments together, because one command with two arguments
 * is two menu items: Find and Replace are both find.toggle.
 */
function signature(command: CommandId, args?: readonly unknown[]) {
  return `${command}|${JSON.stringify(args ?? [])}`
}

// First binding wins, matching how the keyboard resolves a key: several
// bindings share one key and the first that applies is the one that runs, so
// the first is also the one worth showing.
const KEY_BY_SIGNATURE = new Map<string, string>()
for (const binding of KEYBINDINGS) {
  const key = signature(binding.command, binding.args)
  if (!KEY_BY_SIGNATURE.has(key)) KEY_BY_SIGNATURE.set(key, binding.key)
}

/**
 * The shortcut a menu row should advertise, or "" when no key reaches it.
 *
 * These labels used to be written into index.html by hand, one copy per menu,
 * with nothing tying them to the bindings they described — Replace was still
 * labelled Ctrl+R for a while after the key became Ctrl+H.
 */
export function shortcutLabelFor(binding: LabelledBinding): string {
  if (binding.keyLabel) return binding.keyLabel

  if (binding.keyFrom) return KEY_BY_SIGNATURE.get(signature(binding.keyFrom, binding.args)) ?? ""

  for (const command of binding.commands) {
    const key = KEY_BY_SIGNATURE.get(signature(command, binding.args))
    if (key) return key
  }

  return ""
}
