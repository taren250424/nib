import { describe, expect, test } from "vitest"
import { imageMimeOf, isImageDataUrl, toImageDataUrl } from "@shared/utils/image"

describe("imageMimeOf", () => {
  test("names the type from the extension, whatever its case", () => {
    expect(imageMimeOf("C:\\pics\\a.png")).toBe("image/png")
    expect(imageMimeOf("/pics/a.JPG")).toBe("image/jpeg")
    expect(imageMimeOf("a.svg")).toBe("image/svg+xml")
  })

  test("is null for anything that is not a picture", () => {
    expect(imageMimeOf("notes.md")).toBe(null)
    expect(imageMimeOf("README")).toBe(null)
    expect(imageMimeOf("archive.tar.gz")).toBe(null)
    // A dot in a folder name is not an extension.
    expect(imageMimeOf("/v1.0/README")).toBe(null)
  })
})

describe("isImageDataUrl", () => {
  test("recognises what toImageDataUrl packs and nothing else", () => {
    expect(isImageDataUrl(toImageDataUrl("image/png", "AAAA"))).toBe(true)
    expect(isImageDataUrl("# heading")).toBe(false)
    expect(isImageDataUrl("data:text/plain;base64,AAAA")).toBe(false)
  })
})
