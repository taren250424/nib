import type IFileManager from "../contracts/IFileManager"
import { imageMimeOf, toImageDataUrl } from "@shared/utils/image"

/**
 * What a tab is handed for a file's bytes.
 *
 * An image goes over as a data URL the renderer can hand straight to an <img>,
 * and counts as binary so nothing tries to edit, search or save it. Anything
 * else is decoded as text, with the binary sniff deciding whether the editor
 * gets it or the "can't read" notice does.
 */
export function tabContentOf(
  filePath: string,
  buffer: Buffer,
  fileManager: IFileManager
): { content: string; isBinary: boolean } {
  const mime = imageMimeOf(filePath)
  if (mime) {
    return { content: toImageDataUrl(mime, buffer.toString("base64")), isBinary: true }
  }

  return {
    content: fileManager.toStringFromBuffer(buffer),
    isBinary: fileManager.isBinaryContent(buffer),
  }
}
