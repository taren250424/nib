export default interface TreeSessionModel {
  path: string
  name: string
  indent: number
  directory: boolean
  expanded: boolean
  children: TreeSessionModel[] | null
}
