import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabRepository from "@main/modules/contracts/ITabRepository"
import type { TabSessionModel } from "../../models/TabSessionModel"
import { injectable } from "inversify"

@injectable()
export default class TabRepository implements ITabRepository {
  private session: TabSessionModel | null = null

  constructor(
    private tabSessionPath: string,
    private fileManager: IFileManager
  ) {}

  async readTabSession(): Promise<TabSessionModel | null> {
    if (this.session) return this.session

    try {
      const json = await this.fileManager.read(this.tabSessionPath)
      this.session = JSON.parse(json)
      return this.session
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        return null
      }
      throw e
    }
  }

  async writeTabSession(tabSessionModel: TabSessionModel) {
    this.session = tabSessionModel
    this.fileManager.write(this.tabSessionPath, JSON.stringify(tabSessionModel, null, 2))
  }

  getTabSessionPath(): string {
    return this.tabSessionPath
  }
}
