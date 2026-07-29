import type { TabSessionModel } from "@main/models/TabSessionModel"

export default interface ITabRepository {
  readTabSession(): Promise<TabSessionModel | null>
  writeTabSession(tabSessionArr: TabSessionModel): Promise<void>
  getTabSessionPath(): string
}
