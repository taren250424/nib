/**
 * Canonical name for a key combination, as keybindings are written.
 *
 * Modifiers come first in Ctrl, Shift, Alt order and the key itself is
 * upper-cased, so a binding reads "Ctrl+Shift+O" and a plain key reads "DELETE".
 */
export function getKeyString(e: KeyboardEvent): string {
  let key = e.key
  let shift = e.shiftKey

  // "+" is typed as Shift+"=" on most layouts, so Ctrl+= and Ctrl+Shift+= have to
  // collapse onto the same binding. Shift is dropped for this key because it only
  // produces the character, it does not select a different command.
  if (key === "=" || key === "+") {
    key = "+"
    shift = false
  }
  if (key === "Escape") key = "Esc"
  if (key === " ") key = "Space"

  const parts = []
  if (e.ctrlKey) parts.push("Ctrl")
  if (shift) parts.push("Shift")
  if (e.altKey) parts.push("Alt")

  parts.push(key.toUpperCase())
  return parts.join("+")
}

/**
 * Keys that may fire while held. Every other binding ignores auto-repeat so a
 * held key cannot burst commands — a held Delete must not empty a directory.
 */
export const REPEATABLE_KEYS: ReadonlySet<string> = new Set([
  "ARROWUP",
  "ARROWDOWN",
  "Shift+ARROWUP",
  "Shift+ARROWDOWN",
])
