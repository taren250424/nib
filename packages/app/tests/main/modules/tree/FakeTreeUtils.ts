import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type { TreeDto } from "@shared/dto/TreeDto"
import type TreeSessionModel from "@main/models/TreeSessionModel"

export default class FakeTreeUtils implements ITreeUtils {
  private tree: TreeDto | null = null

  setTree(tree: TreeDto) {
    this.tree = tree
  }

  async getDirectoryTree(dirPath: string, indent = 0): Promise<TreeDto | null> {
    if (!this.tree) return null

    const findNode = (node: TreeDto): TreeDto | null => {
      if (node.path === dirPath) return node
      if (!node.children) return null

      for (const child of node.children) {
        const result = findNode(child)
        if (result) return result
      }

      return null
    }

    const node = findNode(this.tree)
    return node ? { ...node, indent } : null
  }

  async syncWithFs(node: TreeSessionModel): Promise<TreeSessionModel | null> {
    if (!node.directory) return node

    const realNode = await this.getDirectoryTree(node.path, node.indent)
    if (!realNode) return null

    if (!node.expanded) {
      return {
        ...node,
        children: null,
      }
    }

    const sessionChildren = node.children ?? []
    const sessionMap = new Map(sessionChildren.map((c) => [c.path, c]))

    const updatedChildren: TreeSessionModel[] = []
    for (const child of realNode.children ?? []) {
      const sessionChild = sessionMap.get(child.path) ?? child
      const syncedChild = await this.syncWithFs(sessionChild)
      if (syncedChild) updatedChildren.push(syncedChild)
    }

    return {
      ...node,
      expanded: node.expanded,
      children: updatedChildren.length > 0 ? updatedChildren : null,
    }
  }
}
