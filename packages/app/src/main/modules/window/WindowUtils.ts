import { injectable } from "inversify"
import type IWindowUtils from "../contracts/IWindowUtils"
import type { WindowSessionModel } from "@main/models/WindowSessionModel"
import type { WindowDto } from "@shared/dto/WindowDto"

@injectable()
export default class WindowUtils implements IWindowUtils {
  toWindowDto(session: WindowSessionModel): WindowDto {
    return {
      maximize: session.maximize,
    }
  }
}
