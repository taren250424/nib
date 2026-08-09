export default interface IPdfExporter {
  /**
   * Renders markdown into a PDF document.
   * @param markdown - The document's markdown source.
   * @param baseDir - Directory relative image paths resolve against, when the document has one.
   */
  render(markdown: string, baseDir?: string): Promise<Buffer>
}
