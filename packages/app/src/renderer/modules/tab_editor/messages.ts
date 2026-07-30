/**
 * What a tab shows in place of content it cannot render.
 *
 * Kept out of the facade because the renderer paints it and the facade reports
 * it, and having one import the other for a string made the two depend on each
 * other in a circle.
 */
export const BINARY_FILE_WARNING = `Can't read this file`
