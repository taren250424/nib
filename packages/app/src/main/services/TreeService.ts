import type TreeSessionModel from "../models/TreeSessionModel"
import type ITreeRepository from "../modules/contracts/ITreeRepository"
import type IFileManager from "../modules/contracts/IFileManager"
import type { TreeDto } from "@shared/dto/TreeDto"
import type TrashMap from "@shared/types/TrashMap"
import type ClipboardMode from "@shared/types/ClipboardMode"
import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type Response from "@shared/types/Response"
import type IFileWatcher from "@main/modules/contracts/IFileWatcher"

import { inject } from "inversify"
import path from "path"
import DI_KEYS from "../constants/di_keys"

export default class TreeService {
  constructor(
    @inject(DI_KEYS.FileManager) private readonly fileManager: IFileManager,
    @inject(DI_KEYS.TreeUtils) private readonly treeUtils: ITreeUtils,
    @inject(DI_KEYS.TreeRepository) private readonly treeRepository: ITreeRepository,
    @inject(DI_KEYS.FileWatcher) private readonly fileWatcher: IFileWatcher
  ) {}

  async rename(prePath: string, newPath: string): Promise<Response<string>> {
    try {
      const targetDir = path.dirname(newPath)
      const existingNames = new Set(await this.fileManager.readDir(targetDir))
      const requestedFileName = path.basename(newPath)
      const uniqueFileName = this.fileManager.getUniqueFileNames(existingNames, [requestedFileName])
      const finalNewPath = path.join(targetDir, uniqueFileName[0])

      const session = await this.treeRepository.readTreeSession()
      if (!session) {
        return { result: false, data: "" }
      }

      const nodeToUpdate = this._findNodeByPath(session, prePath)

      if (nodeToUpdate) {
        await this.fileWatcher.close()
        try {
          await this.fileManager.rename(prePath, finalNewPath)
        } finally {
          await this.fileWatcher.watch(session.path)
        }

        nodeToUpdate.path = finalNewPath
        nodeToUpdate.name = path.basename(finalNewPath)

        this._recursivelyUpdateChildrenPaths(nodeToUpdate)

        await this.treeRepository.writeTreeSession(session)

        return { result: true, data: finalNewPath }
      }

      return { result: false, data: "" }
    } catch (error) {
      return { result: false, data: prePath }
    }
  }

  private _findNodeByPath(node: TreeSessionModel | TreeDto, targetPath: string): TreeSessionModel | TreeDto | null {
    if (path.normalize(node.path) === path.normalize(targetPath)) {
      return node
    }
    if (node.children) {
      for (const child of node.children) {
        const found = this._findNodeByPath(child, targetPath)
        if (found) return found
      }
    }
    return null
  }

  private _recursivelyUpdateChildrenPaths(parentNode: TreeSessionModel | TreeDto): void {
    if (!parentNode.children) return

    for (const child of parentNode.children) {
      const oldChildPath = child.path
      const childBaseName = path.basename(oldChildPath)
      child.path = path.join(parentNode.path, childBaseName)
      child.name = childBaseName

      if (child.children && child.children.length > 0) {
        this._recursivelyUpdateChildrenPaths(child)
      }
    }
  }

  async copy(src: string, dest: string) {
    await this.fileManager.copy(src, dest)
  }

  async paste(targetDto: TreeDto, selectedDtos: TreeDto[], clipboardMode: ClipboardMode): Promise<Response<string[]>> {
    const copiedPaths: string[] = []
    const cutPaths: string[] = []
    const targetDir = targetDto.path

    const targetsToProcess =
      clipboardMode === "cut" ? selectedDtos.filter((dto) => path.dirname(dto.path) !== targetDir) : selectedDtos

    if (targetsToProcess.length === 0) {
      return { result: true, data: [] }
    }

    const originalNames = targetsToProcess.map((dto) => dto.name)
    const existingNames = new Set(await this.fileManager.readDir(targetDir))
    const uniqueNames = this.fileManager.getUniqueFileNames(existingNames, originalNames)

    try {
      for (const [index, dto] of targetsToProcess.entries()) {
        const oldPath = dto.path
        const uniqueName = uniqueNames[index]
        const newPath = path.join(targetDir, uniqueName)

        await this.fileManager.copy(oldPath, newPath)

        dto.name = uniqueName
        dto.path = newPath
        dto.indent = targetDto.indent + 1

        copiedPaths.push(newPath)
        if (clipboardMode === "cut") cutPaths.push(oldPath)

        if (Array.isArray(dto.children)) {
          for (const child of dto.children) {
            this._updateTreeDto(dto, child)
          }
        }
      }

      if (clipboardMode === "cut") {
        await Promise.all(cutPaths.map((p) => this.fileManager.deletePermanently(p)))
      }

      return {
        result: true,
        data: copiedPaths,
      }
    } catch (err) {
      if (copiedPaths.length > 0) {
        await Promise.allSettled(copiedPaths.map((p) => this.fileManager.deletePermanently(p)))
      }

      return {
        result: false,
        data: [],
      }
    }
  }

  private _updateTreeDto(parent: TreeDto, child: TreeDto) {
    child.path = path.join(parent.path, child.name)
    child.indent = parent.indent + 1

    if (Array.isArray(child.children)) {
      for (const grandChild of child.children) {
        this._updateTreeDto(child, grandChild)
      }
    }
  }

  async delete(arr: string[]): Promise<TrashMap[] | null> {
    try {
      return await this.fileManager.moveToTrash(arr)
    } catch {
      return null
    }
  }

  async undo_delete(trashMap: TrashMap[] | null): Promise<boolean> {
    try {
      return await this.fileManager.restoreFromTrash(trashMap)
    } catch {
      return false
    }
  }

  async deletePermanently(path: string): Promise<void> {
    await this.fileManager.deletePermanently(path)
  }

  async create(targetPath: string, directory: boolean): Promise<Response<string>> {
    const dir = path.dirname(targetPath)
    const base = path.basename(targetPath)
    const existingNames = new Set(await this.fileManager.readDir(dir))
    const res = this.fileManager.getUniqueFileNames(existingNames, [base])
    const uniqueName = res[0]
    const uniquePath = path.join(dir, uniqueName)

    const result = await this.fileManager.create(uniquePath, directory)
    return {
      result: result,
      data: uniquePath,
    }
  }

  async syncTreeSessionFromRenderer(dto: TreeDto): Promise<boolean> {
    try {
      await this.treeRepository.writeTreeSession(dto)
      return true
    } catch (e) {
      return false
    }
  }

  async getSyncedTreeSession(): Promise<TreeDto | null> {
    const session = await this.treeRepository.readTreeSession()

    if (session) {
      const newSession = await this.treeUtils.syncWithFs(session)
      if (newSession) await this.treeRepository.writeTreeSession(newSession)
      return newSession
    } else {
      return null
    }
  }
}
