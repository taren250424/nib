export interface TabSessionModel {
  activatedId: number
  data: TabSessionData[]
}

export interface TabSessionData {
  id: number
  filePath: string
  isModified: boolean
}
