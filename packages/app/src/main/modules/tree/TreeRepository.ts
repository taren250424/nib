import type TreeSessionModel from "@main/models/TreeSessionModel"
import type IFileManager from "@main/modules/contracts/IFileManager"
import type ITreeRepository from "@main/modules/contracts/ITreeRepository"

export default class TreeRepository implements ITreeRepository {
  private session: TreeSessionModel | null = null

  constructor(
    private treeSessionPath: string,
    private fileManager: IFileManager
  ) {}

  async readTreeSession(): Promise<TreeSessionModel | null> {
    if (this.session) return this.session

    try {
      const json = await this.fileManager.read(this.treeSessionPath)
      this.session = JSON.parse(json)
      return this.session
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        return null
      }
      throw e
    }
  }

  async writeTreeSession(treeSessionModel: TreeSessionModel) {
    this.session = treeSessionModel
    this.fileManager.write(this.treeSessionPath, JSON.stringify(treeSessionModel, null, 2))
  }
}
