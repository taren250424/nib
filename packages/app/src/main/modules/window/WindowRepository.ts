import type { WindowSessionModel } from "@main/models/WindowSessionModel"
import type IFileManager from "@main/modules/contracts/IFileManager"
import type IWindowRepository from "@main/modules/contracts/IWindowRepository"

export default class WindowRepository implements IWindowRepository {
  private session: WindowSessionModel | null = null

  constructor(
    private sessionPath: string,
    private fileManager: IFileManager
  ) {}

  async readWindowSession(): Promise<WindowSessionModel | null> {
    if (this.session) return this.session

    try {
      const json = await this.fileManager.read(this.sessionPath)
      this.session = JSON.parse(json)
      return this.session
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        return null
      }
      throw e
    }
  }

  async writeWindowSession(model: WindowSessionModel) {
    this.session = model
    this.fileManager.write(this.sessionPath, JSON.stringify(model, null, 2))
  }
}
