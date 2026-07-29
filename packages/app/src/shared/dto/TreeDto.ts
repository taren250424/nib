export interface TreeDto {
  path: string
  name: string
  indent: number
  directory: boolean
  expanded: boolean
  children: TreeDto[] | null
}

export interface TreePartialUpdate {
  type: "add" | "remove"
  path: string
  isDirectory: boolean
}
