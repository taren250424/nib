import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITabRepository from "@main/modules/contracts/ITabRepository"
import type { TabSessionModel } from "@main/models/TabSessionModel"

export default class FakeTabRepository implements ITabRepository {
  constructor(
    private tabSessionPath: string,
    private fileManager: IFileManager
  ) {}

  async setTabSession(tabSessionArr: TabSessionModel) {
    await this.fileManager.write(this.tabSessionPath, JSON.stringify(tabSessionArr, null, 2))
  }

  async readTabSession(): Promise<TabSessionModel | null> {
    if (!(await this.fileManager.exists(this.tabSessionPath))) {
      return null
    } else {
      const json = await this.fileManager.read(this.tabSessionPath)
      return JSON.parse(json)
    }
  }

  async writeTabSession(tabSessionArr: TabSessionModel) {
    await this.fileManager.write(this.tabSessionPath, JSON.stringify(tabSessionArr, null, 2))
  }

  getTabSessionPath(): string {
    return this.tabSessionPath
  }
}
