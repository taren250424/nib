/**
 * What a tab shows in place of content it cannot render.
 *
 * Kept out of the facade because the renderer paints it and the facade reports
 * it, and having one import the other for a string made the two depend on each
 * other in a circle.
 */
export const BINARY_FILE_WARNING = `Can't read this file`

/**
 * What the user is told when a save came back refused.
 *
 * The reason arrives in the words the OS used — "EACCES: permission denied",
 * "EBUSY: resource busy" — which names the thing they have to go fix far better
 * than any wording of ours could.
 */
export function saveFailedMessage(fileName: string, error?: string) {
  const named = fileName || "the file"
  return error ? `Could not save ${named}.\n\n${error}` : `Could not save ${named}.`
}
