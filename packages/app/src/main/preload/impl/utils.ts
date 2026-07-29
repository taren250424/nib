import type { UtilsAPI } from "@shared/preload"
import { webFrame } from "electron"
import path from "path"

const utils: UtilsAPI = {
  setZoomFactor: (factor: number) => webFrame.setZoomFactor(factor),
  getDirName: (fullPath: string): string => path.dirname(fullPath),
  getBaseName: (fullPath: string): string => path.basename(fullPath),
  getJoinedPath: (dir: string, base: string): string => path.join(dir, base),
  getRelativePath: (from: string, to: string): string => path.relative(from, to),
  isAbsolute: (p: string): boolean => path.isAbsolute(p),
  pathSep: path.sep,
}

export default utils
