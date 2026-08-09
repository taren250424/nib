import type IPdfExporter from "@main/modules/contracts/IPdfExporter"
import { app, BrowserWindow } from "electron"
import { injectable } from "inversify"
import { marked } from "marked"
import { pathToFileURL } from "url"
import fs from "fs/promises"
import path from "path"

/**
 * The look of the exported page. Print-oriented: black on white regardless of
 * the app theme, system fonts so the export works offline, and page-break
 * rules so headings do not end up orphaned at the bottom of a page.
 */
const PAGE_STYLE = `
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "Segoe UI", -apple-system, "Helvetica Neue", Arial, sans-serif;
    font-size: 10.5pt;
    line-height: 1.7;
    color: #1f2328;
    background-color: #ffffff;
    word-wrap: break-word;
  }
  h1, h2, h3, h4, h5, h6 {
    margin: 1.5em 0 0.6em;
    font-weight: 600;
    line-height: 1.3;
    page-break-after: avoid;
  }
  body > :first-child { margin-top: 0; }
  h1 { font-size: 1.75em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
  h2 { font-size: 1.4em; padding-bottom: 0.3em; border-bottom: 1px solid #d8dee4; }
  h3 { font-size: 1.15em; }
  p, ul, ol, table, blockquote, pre { margin-bottom: 1em; }
  ul, ol { padding-left: 1.6em; }
  li + li { margin-top: 0.2em; }
  a { color: #0969da; }
  blockquote {
    padding: 0.25em 1em;
    color: #59636e;
    border-left: 4px solid #d8dee4;
    page-break-inside: avoid;
  }
  code {
    font-family: Consolas, "Courier New", monospace;
    font-size: 0.88em;
    padding: 0.15em 0.4em;
    border-radius: 5px;
    background-color: #f0f2f5;
  }
  pre {
    padding: 1em;
    border-radius: 8px;
    background-color: #f0f2f5;
    overflow-x: hidden;
    page-break-inside: avoid;
  }
  pre code { padding: 0; background-color: transparent; white-space: pre-wrap; }
  table { border-collapse: collapse; max-width: 100%; page-break-inside: avoid; }
  th, td { padding: 0.45em 0.9em; border: 1px solid #d8dee4; }
  th { background-color: #f6f8fa; font-weight: 600; }
  img { max-width: 100%; page-break-inside: avoid; }
  hr { border: none; border-top: 1px solid #d8dee4; margin: 1.5em 0; }
`

@injectable()
export default class PdfExporter implements IPdfExporter {
  async render(markdown: string, baseDir?: string): Promise<Buffer> {
    const body = marked.parse(markdown, { gfm: true, async: false })

    // Relative image paths mean "next to the markdown file"; the base tag is
    // what carries that meaning into a page loaded from somewhere else.
    const base = baseDir ? `<base href="${pathToFileURL(baseDir).href}/">` : ""
    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
${base}
<style>${PAGE_STYLE}</style>
</head>
<body>${body}</body>
</html>`

    // Loaded from a file rather than a data URL: a data: page is an opaque
    // origin and Chromium refuses it the file:// images the base tag points at.
    const tempPath = path.join(app.getPath("temp"), `nib-pdf-export-${process.pid}-${Date.now()}.html`)
    await fs.writeFile(tempPath, html, "utf-8")

    // Scripts the markdown may carry stay inert, so the page needs no sanitizing.
    const window = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true, javascript: false },
    })

    try {
      await window.loadURL(pathToFileURL(tempPath).href)
      return await window.webContents.printToPDF({
        pageSize: "A4",
        printBackground: true,
        margins: { top: 0.47, bottom: 0.47, left: 0.55, right: 0.55 },
      })
    } finally {
      window.destroy()
      await fs.unlink(tempPath).catch(() => undefined)
    }
  }
}
