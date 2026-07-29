export default interface UtilsAPI {
  setZoomFactor: (factor: number) => void
  getDirName: (fullPath: string) => string
  getBaseName: (fullPath: string) => string
  getJoinedPath: (dir: string, base: string) => string
  getRelativePath: (from: string, to: string) => string
  isAbsolute: (path: string) => boolean
  pathSep: string
}
