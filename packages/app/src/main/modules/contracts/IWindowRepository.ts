import type { WindowSessionModel } from "../../models/WindowSessionModel"

export default interface IWindowRepository {
  readWindowSession(): Promise<WindowSessionModel | null>
  writeWindowSession(model: WindowSessionModel): Promise<void>
}
