import type IFileManager from "../modules/contracts/IFileManager"
import type IFileWatcher from "@main/modules/contracts/IFileWatcher"
import type ITreeUtils from "@main/modules/contracts/ITreeUtils"
import type IDialogManager from "../modules/contracts/IDialogManager"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"
import type ITabRepository from "../modules/contracts/ITabRepository"
import type TreeSessionModel from "@main/models/TreeSessionModel"
import type { TabSessionData } from "../models/TabSessionModel"
import type { TabEditorDto, TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto } from "@shared/dto/TreeDto"
import { BrowserWindow } from "electron"
import { inject } from "inversify"
import DI_KEYS from "../constants/di_keys"
import path from "path"

export default class FileService {
  constructor(
    @inject(DI_KEYS.FileManager) private readonly fileManager: IFileManager,
    @inject(DI_KEYS.TabRepository) private readonly tabRepository: ITabRepository,
    @inject(DI_KEYS.dialogManager) private readonly dialogManager: IDialogManager,
    @inject(DI_KEYS.TreeRepository) private readonly treeRepository: ITreeRepository,
    @inject(DI_KEYS.TreeUtils) private readonly treeUtils: ITreeUtils,
    @inject(DI_KEYS.FileWatcher) private readonly fileWatcher: IFileWatcher
  ) {}

  async newTab() {
    const model = (await this.tabRepository.readTabSession()) ?? {
      activatedId: -1,
      data: [],
    }

    const data = model.data
    const id = data.length > 0 ? data[data.length - 1].id + 1 : 0
    data.push({ id: id, filePath: "", isModified: false })
    await this.tabRepository.writeTabSession(model)
    return id
  }

  async openFile(filePath?: string): Promise<TabEditorDto | null> {
    if (!filePath) {
      const result = await this.dialogManager.showOpenFileDialog()
      if (result.canceled || result.filePaths.length === 0) {
        return null
      }
      filePath = result.filePaths[0]
    }

    const fileName = this.fileManager.getBasename(filePath)
    const buffer = await this.fileManager.getBuffer(filePath)
    const isBinary = this.fileManager.isBinaryContent(buffer)
    const content = this.fileManager.toStringFromBuffer(buffer)

    const model = (await this.tabRepository.readTabSession()) ?? {
      activatedId: -1,
      data: [],
    }

    const data = model.data
    const id = data.length > 0 ? data[data.length - 1].id + 1 : 0
    data.push({ id: id, filePath: filePath, isModified: false })
    model.activatedId = id
    await this.tabRepository.writeTabSession(model)

    return {
      id: id,
      isModified: false,
      filePath: filePath,
      fileName: fileName,
      content: content,
      isBinary: isBinary,
    }
  }

  async openDirectory(dto?: TreeDto): Promise<TreeDto | null> {
    let path
    let indent

    if (!dto || !dto.path) {
      const result = await this.dialogManager.showOpenDirectoryDialog()

      if (result.canceled || result.filePaths.length === 0) {
        return null
      }

      path = result.filePaths[0]
      indent = 0
    } else {
      path = dto.path
      indent = dto.indent
    }

    const tree = await this.treeUtils.getDirectoryTree(path, indent)
    if (!tree) return null

    if (indent === 0) {
      await this.treeRepository.writeTreeSession(tree)
      this.fileWatcher.watch(path)
    } else {
      const session = await this.treeRepository.readTreeSession()
      const updatedSession = this._mergeTreeSessionWithFsTree(path, indent, tree.children, session)
      if (updatedSession) await this.treeRepository.writeTreeSession(updatedSession)
    }

    return {
      path,
      name: this.fileManager.getBasename(path),
      indent,
      directory: tree.directory,
      expanded: tree.expanded,
      children: tree?.children ?? [],
    }
  }

  /**
   * Creates a new tree session model based on the file system, and merges it with the previous session state.
   * @param dirPath - The directory path of the node to be updated.
   * @param indent - The indentation level of the node.
   * @param tree - The children of the node read from the file system.
   * @param session - The previous tree session state.
   * @returns A new, updated tree session model.
   */
  private _mergeTreeSessionWithFsTree(
    dirPath: string,
    indent: number,
    tree: TreeDto[] | null,
    session: TreeSessionModel | null
  ): TreeSessionModel | null {
    if (!session) {
      return {
        path: dirPath,
        name: this.fileManager.getBasename(dirPath),
        indent,
        directory: true,
        expanded: true,
        children: tree
          ? tree.map((child) => ({
              ...child,
              children: null as null,
            }))
          : null,
      }
    }

    const newNode: TreeSessionModel = {
      path: dirPath,
      name: this.fileManager.getBasename(dirPath),
      indent,
      directory: true,
      expanded: true,
      children: tree,
    }

    return this._replaceNode(session, dirPath, newNode) || session
  }

  private _replaceNode(root: TreeSessionModel, targetPath: string, newNode: TreeSessionModel): TreeSessionModel {
    if (root.path === targetPath) {
      return newNode
    }

    if (root.children) {
      const newChildren = root.children.map((child) => {
        return this._replaceNode(child, targetPath, newNode)
      })

      return { ...root, children: newChildren }
    }

    return root
  }

  private _getTempFilePath(id: number): string {
    const sessionPath = this.tabRepository.getTabSessionPath()
    return path.join(path.dirname(sessionPath), "temp", `${id}.txt`)
  }

  async tempSave(data: TabEditorDto) {
    const tempFilePath = this._getTempFilePath(data.id)

    if (!data.isModified) {
      if (await this.fileManager.exists(tempFilePath)) {
        await this.fileManager.deletePermanently(tempFilePath)
      }

      const model = await this.tabRepository.readTabSession()
      if (model) {
        const tab = model.data.find((t) => t.id === data.id)
        if (tab && tab.isModified) {
          tab.isModified = false
          await this.tabRepository.writeTabSession(model)
        }
      }
      return
    }

    const tempDir = path.dirname(tempFilePath)

    if (!(await this.fileManager.exists(tempDir))) {
      await this.fileManager.create(tempDir, true)
    }

    await this.fileManager.write(tempFilePath, data.content)

    const model = await this.tabRepository.readTabSession()
    if (model) {
      const tab = model.data.find((t) => t.id === data.id)
      if (tab && !tab.isModified) {
        tab.isModified = true
        await this.tabRepository.writeTabSession(model)
      }
    }
  }

  async save(data: TabEditorDto, mainWindow: BrowserWindow, writeSession = true) {
    const tempFilePath = this._getTempFilePath(data.id)
    const cleanTemp = async () => {
      if (await this.fileManager.exists(tempFilePath)) {
        await this.fileManager.deletePermanently(tempFilePath)
      }
    }

    if (!data.filePath) {
      const result = await this.dialogManager.showSaveDialog(mainWindow, data.fileName)

      if (result.canceled || !result.filePath) {
        return data
      } else {
        await this.fileManager.write(result.filePath, data.content)
        await cleanTemp()

        const tabSession = (await this.tabRepository.readTabSession()) ?? {
          activatedId: -1,
          data: [],
        }

        const session = tabSession.data.find((s) => s.id === data.id)
        if (session) {
          session.filePath = result.filePath
          session.isModified = false
        }
        if (writeSession) await this.tabRepository.writeTabSession(tabSession)

        return {
          ...data,
          isModified: false,
          filePath: result.filePath,
          fileName: this.fileManager.getBasename(result.filePath),
        }
      }
    } else {
      await this.fileManager.write(data.filePath, data.content)
      await cleanTemp()

      if (writeSession) {
        const tabSession = await this.tabRepository.readTabSession()
        if (tabSession) {
          const session = tabSession.data.find((s) => s.id === data.id)
          if (session) {
            session.isModified = false
            await this.tabRepository.writeTabSession(tabSession)
          }
        }
      }

      return {
        ...data,
        isModified: false,
        filePath: data.filePath,
        fileName: this.fileManager.getBasename(data.filePath),
      }
    }
  }

  async saveAs(data: TabEditorDto, mainWindow: BrowserWindow): Promise<TabEditorDto | null> {
    const result = await this.dialogManager.showSaveDialog(mainWindow, data.fileName)

    if (result.canceled || !result.filePath) {
      return null
    } else {
      await this.fileManager.write(result.filePath, data.content)

      const model = (await this.tabRepository.readTabSession()) ?? {
        activatedId: -1,
        data: [],
      }
      const arr = model.data
      const id = arr.length > 0 ? arr[arr.length - 1].id + 1 : 0
      arr.push({ id: id, filePath: result.filePath, isModified: false })
      model.data = arr
      this.tabRepository.writeTabSession(model)

      return {
        id: id,
        isModified: false,
        filePath: result.filePath,
        fileName: this.fileManager.getBasename(result.filePath),
        content: data.content,
        isBinary: data.isBinary,
      }
    }
  }

  async saveAll(dto: TabEditorsDto, mainWindow: BrowserWindow) {
    const sessionArr: TabSessionData[] = []
    const responseArr: TabEditorDto[] = []

    for (const tab of dto.data) {
      const { id, isModified, filePath, fileName, content, isBinary } = tab

      if (!isModified) {
        sessionArr.push({ id: id, filePath: filePath, isModified: false })
        responseArr.push({
          id: id,
          isModified: false,
          filePath: filePath,
          fileName: fileName,
          content: content,
          isBinary: isBinary,
        })
        continue
      }

      const result = await this.save(tab, mainWindow, false)
      sessionArr.push({ id: result.id, filePath: result.filePath, isModified: false })
      responseArr.push(result)
    }

    await this.tabRepository.writeTabSession({
      activatedId: dto.activatedId,
      data: sessionArr,
    })

    return {
      activatedId: dto.activatedId,
      data: responseArr,
    }
  }
}
