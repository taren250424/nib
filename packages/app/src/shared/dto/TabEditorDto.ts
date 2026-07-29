export interface TabEditorsDto {
  activatedId: number
  data: TabEditorDto[]
}

export interface TabEditorDto {
  id: number
  isModified: boolean
  filePath: string
  fileName: string
  content: string
  isBinary: boolean
}
