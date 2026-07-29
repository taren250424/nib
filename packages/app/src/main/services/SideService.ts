import type ISideRepository from "@main/modules/contracts/ISideRepository"
import type SideSessionModel from "@main/models/SideSessionModel"
import type { SideDto } from "@shared/dto/SideDto"
import { inject } from "inversify"
import DI_KEYS from "../constants/di_keys"

export default class SideService {
  constructor(
    @inject(DI_KEYS.SideRepository)
    private readonly sideRepository: ISideRepository
  ) {}

  async syncSideSession(dto: SideDto): Promise<boolean> {
    try {
      const model = dto as SideSessionModel
      await this.sideRepository.writeSideSession(model)
      return true
    } catch (e) {
      return false
    }
  }
}
