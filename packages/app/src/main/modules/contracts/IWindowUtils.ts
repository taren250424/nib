import type { WindowSessionModel } from "@main/models/WindowSessionModel"
import type { WindowDto } from "@shared/dto/WindowDto"

export default interface IWindowUtils {
  toWindowDto(session: WindowSessionModel): WindowDto
}
