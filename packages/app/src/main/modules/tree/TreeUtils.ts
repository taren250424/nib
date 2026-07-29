import type IFileManager from "../contracts/IFileManager"
import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type { TreeDto } from "@shared/dto/TreeDto"
import fs from "fs"
import path from "path"
import { inject, injectable } from "inversify"
import DI_KEYS from "../../constants/di_keys"

@injectable()
export default class TreeUtils implements ITreeUtils {
  constructor(@inject(DI_KEYS.FileManager) private readonly fileManager: IFileManager) {}

  /**
   * Gets the directory tree at the given path, scanning only one level deep.
   *
   * @param dirPath - Directory path to scan
   * @returns TreeNode with immediate children, or null if not a directory.
   *
   * Note:
   * - children: null means children are not loaded yet (lazy).
   * - children: [] means no children exist or directory can't be read.
   */
  async getDirectoryTree(dirPath: string, indent = 0) {
    const stats = fs.statSync(dirPath)
    if (!stats.isDirectory()) return null

    let children: TreeDto[] | null = null

    try {
      const dirents = fs.readdirSync(dirPath, { withFileTypes: true })

      dirents.sort((a, b) => {
        if (a.isDirectory() && !b.isDirectory()) return -1
        if (!a.isDirectory() && b.isDirectory()) return 1
        return a.name.localeCompare(b.name)
      })

      children = dirents.map(
        (dirent: fs.Dirent): TreeDto => ({
          path: path.join(dirPath, dirent.name),
          name: dirent.name,
          indent: indent + 1,
          directory: dirent.isDirectory(),
          expanded: false,
          children: null,
        })
      )
    } catch {
      children = null
    }

    return {
      path: dirPath,
      name: path.basename(dirPath),
      indent: indent,
      directory: true,
      expanded: true,
      children,
    }
  }

  async syncWithFs(node: TreeDto): Promise<TreeDto | null> {
    const exists = await this.fileManager.exists(node.path)
    if (!exists) return null

    if (!node.directory) return node

    if (!node.expanded) {
      return {
        ...node,
        children: null,
      }
    }

    const current = await this.getDirectoryTree(node.path, node.indent)
    const sessionChildren = node.children ?? []
    const sessionMap = new Map(sessionChildren.map((c) => [c.path, c]))

    const updatedChildren: TreeDto[] = []

    for (const child of current?.children ?? []) {
      const sessionChild = sessionMap.get(child.path)
      const merged = await this.syncWithFs(sessionChild ?? child)
      if (merged) updatedChildren.push(merged)
    }

    return {
      ...node,
      expanded: node.expanded,
      children: updatedChildren.length > 0 ? updatedChildren : null,
    }
  }
}
