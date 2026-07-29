import type { WindowSessionModel } from "@main/models/WindowSessionModel"
import type IWindowUtils from "@main/modules/contracts/IWindowUtils"
import type { WindowDto } from "@shared/dto/WindowDto"

export default class FakeWindowUtils implements IWindowUtils {
  toWindowDto(session: WindowSessionModel): WindowDto {
    return {
      maximize: session.maximize,
    }
  }
}
