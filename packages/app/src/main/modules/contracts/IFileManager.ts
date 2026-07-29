import type TrashMap from "@shared/types/TrashMap"

export default interface IFileManager {
  exists(path: string): Promise<boolean>
  getBasename(filePath: string): string
  getBuffer(path: string): Promise<Buffer>
  toStringFromBuffer(buffer: Buffer, encoding?: BufferEncoding): string
  read(path: string, encoding?: BufferEncoding): Promise<string>
  readDir(dirPath: string): Promise<string[]>
  write(path: string, data: string, encoding?: BufferEncoding): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  copy(src: string, dest: string): Promise<void>
  moveToTrash(paths: string[]): Promise<TrashMap[] | null>
  restoreFromTrash(trashMap: TrashMap[] | null): Promise<boolean>
  cleanTrash(): Promise<void>
  deletePermanently(path: string): Promise<void>
  create(targetPath: string, directory: boolean): Promise<boolean>
  getUniqueFileNames(existingNames: Set<string>, fileNames: string[]): string[]
  isBinaryContent(buffer: Buffer, sampleSize?: number): boolean
}
