import type IFileManager from "@main/modules/contracts/IFileManager"
import path from "path"
import type TrashMap from "@shared/types/TrashMap"

export default class FakeFileManager implements IFileManager {
  pathExists: Record<string, boolean> = {}
  savedFiles: Record<string, string> = {}
  private trashFiles: Record<string, string> = {}
  private osTrashFiles: Record<string, string> = {}
  private unwritablePaths = new Set<string>()
  private trashId = 0

  setPathExistence(path: string, exists: boolean) {
    this.pathExists[path] = exists
  }

  setFilecontent(path: string, data: string) {
    this.savedFiles[path] = data
  }

  /** Makes a path refuse writes, the way a read-only or locked file does. */
  setWriteFailure(path: string, fails = true) {
    if (fails) this.unwritablePaths.add(path)
    else this.unwritablePaths.delete(path)
  }

  async exists(path: string): Promise<boolean> {
    return this.pathExists[path] ?? false
  }

  getBasename(filePath: string): string {
    return path.basename(filePath)
  }

  async getBuffer(path: string): Promise<Buffer> {
    const content = this.savedFiles[path]
    if (content === undefined) {
      throw new Error(`File not found: ${path}`)
    }
    return Buffer.from(content, "utf8")
  }

  toStringFromBuffer(buffer: Buffer, encoding: BufferEncoding = "utf8"): string {
    return buffer.toString(encoding)
  }

  async read(path: string, _encoding: BufferEncoding = "utf8"): Promise<string> {
    const buffer = await this.getBuffer(path)
    const content = this.toStringFromBuffer(buffer)
    return content
  }

  async readDir(dirPath: string): Promise<string[]> {
    const prefix = dirPath.endsWith(path.sep) ? dirPath : dirPath + path.sep
    const fileNames = Object.keys(this.savedFiles)
      .filter((filePath) => filePath.startsWith(prefix))
      .map((filePath) => filePath.substring(prefix.length))

    const immediateEntries = new Set<string>()
    for (const name of fileNames) {
      const firstPart = name.split(path.sep)[0]
      immediateEntries.add(firstPart)
    }

    return Array.from(immediateEntries)
  }

  async write(path: string, data: string, _encoding: BufferEncoding = "utf8"): Promise<void> {
    if (this.unwritablePaths.has(path)) {
      throw new Error(`EACCES: permission denied, open '${path}'`)
    }

    this.savedFiles[path] = data
    this.pathExists[path] = true
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    if (!(oldPath in this.savedFiles)) {
      throw new Error(`Cannot rename: Source file not found: ${oldPath}`)
    }
    if (newPath in this.savedFiles) {
      throw new Error(`Cannot rename: Destination file already exists: ${newPath}`)
    }

    this.savedFiles[newPath] = this.savedFiles[oldPath]
    this.pathExists[newPath] = true

    delete this.savedFiles[oldPath]
    delete this.pathExists[oldPath]
  }

  async copy(src: string, dest: string) {
    if (!(src in this.savedFiles)) {
      throw new Error(`Cannot copy: Source file not found: ${src}`)
    }

    if (dest in this.savedFiles) {
      throw new Error(`Cannot copy: Destination already exists: ${dest}`)
    }

    this.savedFiles[dest] = this.savedFiles[src]
    this.pathExists[dest] = true
  }

  async moveToTrash(paths: string[]): Promise<TrashMap[] | null> {
    const movedFiles: TrashMap[] = []

    try {
      for (const p of paths) {
        if (!(p in this.savedFiles)) {
          throw new Error(`File to delete not found: ${p}`)
        }

        const baseName = path.basename(p)
        const newName = `${this.trashId++}_${baseName}`

        this.trashFiles[newName] = this.savedFiles[p]

        delete this.savedFiles[p]
        delete this.pathExists[p]

        const trashPath = path.join("/trash", newName)
        movedFiles.push({ originalPath: p, trashPath })
      }

      return movedFiles
    } catch (e) {
      return null
    }
  }

  async restoreFromTrash(trashMap: TrashMap[] | null): Promise<boolean> {
    if (!trashMap) return false

    for (const { originalPath, trashPath } of trashMap) {
      const trashName = path.basename(trashPath)
      const data = this.trashFiles[trashName]
      if (!data) throw new Error(`Trash not found: ${trashName}`)

      this.savedFiles[originalPath] = data
      this.pathExists[originalPath] = true
      delete this.trashFiles[trashName]
    }

    return true
  }

  async cleanTrash(): Promise<void> {
    this.trashFiles = {}
  }

  async deletePermanently(filePath: string): Promise<void> {
    this.osTrashFiles[filePath] = this.savedFiles[filePath]

    delete this.savedFiles[filePath]
    delete this.pathExists[filePath]
  }

  async create(targetPath: string, directory: boolean): Promise<boolean> {
    if (directory) {
      this.pathExists[targetPath] = true
    } else {
      const dirName = path.dirname(targetPath)
      if (!this.pathExists[dirName]) {
        this.pathExists[dirName] = true
      }
      this.savedFiles[targetPath] = path.basename(targetPath)
      this.pathExists[targetPath] = true
    }
    return true
  }

  // getOsTrashFiles(): Record<string, string> {
  //     return this.osTrashFiles
  // }

  getUniqueFileNames(existingNames: Set<string>, fileNames: string[]): string[] {
    const results: string[] = []
    const reg = /^(.*?)-(\d+)$/

    for (const fileName of fileNames) {
      const ext = path.extname(fileName)
      const nameWithoutExt = path.basename(fileName, ext)
      const baseName = nameWithoutExt.match(reg)?.[1] ?? nameWithoutExt

      if (!existingNames.has(fileName)) {
        results.push(fileName)
        existingNames.add(fileName)
        continue
      }

      for (let i = 1; ; i++) {
        const newFileName = `${baseName}-${i}${ext}`
        if (!existingNames.has(newFileName)) {
          results.push(newFileName)
          existingNames.add(newFileName)
          break
        }
      }
    }

    return results
  }

  isBinaryContent(buffer: Buffer, sampleSize = 8000): boolean {
    const len = Math.min(buffer.length, sampleSize)

    let suspicious = 0

    for (let i = 0; i < len; i++) {
      const byte = buffer[i]

      if (byte === 0) return true
      if ((byte > 0 && byte < 0x09) || (byte > 0x0d && byte < 0x20)) suspicious++
    }

    return suspicious / len > 0.3
  }
}
