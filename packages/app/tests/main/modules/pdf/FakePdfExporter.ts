import type IPdfExporter from "@main/modules/contracts/IPdfExporter"

export default class FakePdfExporter implements IPdfExporter {
  /** Every render asked for, so a test can say what was laid out and from where. */
  renderCalls: { markdown: string; baseDir?: string }[] = []
  private failure: Error | null = null

  /** Makes rendering fail, the way a crashed print process does. */
  setRenderFailure(error: Error | null) {
    this.failure = error
  }

  async render(markdown: string, baseDir?: string): Promise<Buffer> {
    if (this.failure) throw this.failure
    this.renderCalls.push({ markdown, baseDir })
    return Buffer.from(`PDF:${markdown}`)
  }
}
