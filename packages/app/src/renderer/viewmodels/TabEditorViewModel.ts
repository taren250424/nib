export interface TabEditorViewModel {
  id: number
  isModified: boolean
  isBinary: boolean
  filePath: string
  fileName: string
  initialContent: string
}
