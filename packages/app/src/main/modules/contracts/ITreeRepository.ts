import type TreeSessionModel from "@main/models/TreeSessionModel"

export default interface ITreeRepository {
  readTreeSession(): Promise<TreeSessionModel | null>
  writeTreeSession(model: TreeSessionModel): Promise<void>
}
