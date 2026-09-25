/**
 * Which files a tab shows as a picture rather than as text.
 *
 * Shared because both sides need the same answer: Main decides what to put in
 * the tab's content when it reads the file, and the renderer decides what to
 * build from it.
 */
const MIME_BY_EXTENSION: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  bmp: "image/bmp",
  ico: "image/x-icon",
  svg: "image/svg+xml",
  avif: "image/avif",
}

const DATA_URL_PREFIX = "data:image/"

/** The MIME type an image file's extension names, or null when it is not one we show. */
export function imageMimeOf(filePath: string): string | null {
  const match = /\.([^.\\/]+)$/.exec(filePath)
  if (!match) return null
  return MIME_BY_EXTENSION[match[1].toLowerCase()] ?? null
}

/** A tab's content is a picture when Main packed it as an image data URL. */
export function isImageDataUrl(content: string): boolean {
  return content.startsWith(DATA_URL_PREFIX)
}

export function toImageDataUrl(mime: string, base64: string): string {
  return `data:${mime};base64,${base64}`
}
