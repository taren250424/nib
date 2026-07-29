import type SideSessionModel from "@main/models/SideSessionModel"
import type IFileManager from "@main/modules/contracts/IFileManager"
import type ISideRepository from "@main/modules/contracts/ISideRepository"

export default class SideRepository implements ISideRepository {
  private session: SideSessionModel | null = null

  constructor(
    private sideSessionPath: string,
    private fileManager: IFileManager
  ) {}

  async readSideSession(): Promise<SideSessionModel | null> {
    if (this.session) return this.session

    try {
      const json = await this.fileManager.read(this.sideSessionPath)
      this.session = JSON.parse(json)
      return this.session
    } catch (e) {
      if (e instanceof Error && "code" in e && e.code === "ENOENT") {
        return null
      }
      throw e
    }
  }

  async writeSideSession(model: SideSessionModel) {
    this.session = model
    this.fileManager.write(this.sideSessionPath, JSON.stringify(model, null, 2))
  }
}
