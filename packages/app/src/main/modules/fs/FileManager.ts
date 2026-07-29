import type IFileManager from "@main/modules/contracts/IFileManager"
import type TrashMap from "@shared/types/TrashMap"

import fs from "fs"
import fsExtra from "fs-extra"
import path from "path"

import { app } from "electron"
import { injectable } from "inversify"

@injectable()
export default class FileManager implements IFileManager {
  private trashId = 0

  async exists(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path)
      return true
    } catch (e) {
      return false
    }
  }

  getBasename(filePath: string): string {
    return path.basename(filePath)
  }

  async getBuffer(path: string): Promise<Buffer> {
    return await fs.promises.readFile(path)
  }

  toStringFromBuffer(buffer: Buffer, encoding: BufferEncoding = "utf8"): string {
    return buffer.toString(encoding)
  }

  async read(path: string, encoding: BufferEncoding = "utf8"): Promise<string> {
    const buffer = await this.getBuffer(path)
    const content = this.toStringFromBuffer(buffer, encoding)
    return content
  }

  async readDir(dirPath: string) {
    return fs.promises.readdir(dirPath)
  }

  async write(path: string, data: string, encoding: BufferEncoding = "utf8"): Promise<void> {
    return await fs.promises.writeFile(path, data, encoding)
  }

  async rename(oldPath: string, newPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.rename(oldPath, newPath, (err: NodeJS.ErrnoException | null) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  async copy(src: string, dest: string) {
    await fsExtra.copy(src, dest)
  }

  private getTrashDir(): string {
    return path.join(app.getPath("userData"), "trash")
  }

  private async ensureTrashDir() {
    await fs.promises.mkdir(this.getTrashDir(), { recursive: true })
  }

  async moveToTrash(paths: string[]): Promise<TrashMap[] | null> {
    await this.ensureTrashDir()

    const trashDir = this.getTrashDir()
    const movedFiles: TrashMap[] = []

    try {
      for (const p of paths) {
        const baseName = path.basename(p)
        const newName = `${this.trashId++}_${baseName}`
        const trashPath = path.join(trashDir, newName)

        await this.copy(p, trashPath)
        await this.deletePermanently(p)

        movedFiles.push({ originalPath: p, trashPath })
      }

      return movedFiles
    } catch (error) {
      for (const { originalPath, trashPath } of movedFiles) {
        try {
          await this.copy(trashPath, originalPath)
          await this.deletePermanently(trashPath)
        } catch {
          // intentionally ignored
        }
      }

      throw error
    }
  }

  async restoreFromTrash(trashMap: TrashMap[] | null): Promise<boolean> {
    if (!trashMap) return false

    for (const { originalPath, trashPath } of trashMap) {
      await fsExtra.copy(trashPath, originalPath)
      await fsExtra.remove(trashPath)
    }

    return true
  }

  async cleanTrash(): Promise<void> {
    const trashDir = this.getTrashDir()

    const files = await fs.promises.readdir(trashDir)

    for (const file of files) {
      const filePath = path.join(trashDir, file)
      await fs.promises.rm(filePath, { recursive: true, force: true })
    }
  }

  async deletePermanently(path: string) {
    await fs.promises.rm(path, { force: true, recursive: true })
  }

  async create(targetPath: string, directory: boolean): Promise<boolean> {
    try {
      if (directory) {
        await fs.promises.mkdir(targetPath, { recursive: true })
      } else {
        const dirName = path.dirname(targetPath)
        await fs.promises.mkdir(dirName, { recursive: true })
        await fs.promises.writeFile(targetPath, "")
      }
      return true
    } catch (e) {
      return false
    }
  }

  getUniqueFileNames(existingNames: Set<string>, fileNames: string[]): string[] {
    // Create a working copy to avoid mutating the original existingNames
    // Handles duplicate filenames in array: ['file.txt', 'file.txt'] → ['file.txt', 'file-1.txt']
    const nameTracker = new Set(existingNames)
    const results: string[] = []
    const reg = /^(.*?)-(\d+)$/

    for (const fileName of fileNames) {
      const ext = path.extname(fileName)
      const nameWithoutExt = path.basename(fileName, ext)
      const baseName = nameWithoutExt.match(reg)?.[1] ?? nameWithoutExt

      if (!nameTracker.has(fileName)) {
        results.push(fileName)
        nameTracker.add(fileName)
        continue
      }

      for (let i = 1; ; i++) {
        const newFileName = `${baseName}-${i}${ext}`
        if (!nameTracker.has(newFileName)) {
          results.push(newFileName)
          nameTracker.add(newFileName)
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

      // if null exists,
      if (byte === 0) return true

      // if it contains something that is not used often.
      if ((byte > 0 && byte < 0x09) || (byte > 0x0d && byte < 0x20)) {
        suspicious++
      }
    }

    return suspicious / len > 0.3
  }
}
