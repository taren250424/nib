export interface TabEditorViewModel {
  id: number
  isModified: boolean
  isBinary: boolean
  filePath: string
  fileName: string
  initialContent: string
  /**
   * Set when a save came back refused, cleared by the next one that lands.
   *
   * Renderer-only and deliberately not carried in the session: the reason a
   * write failed — a lock, a permission, a full disk — is rarely still true at
   * the next start, and restoring the mark without retesting it would be a
   * claim the app cannot stand behind.
   */
  saveFailed: boolean
}
