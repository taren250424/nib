import type ISettingsRepository from "@main/modules/contracts/ISettingsRepository"
import type ISettingsUtils from "@main/modules/contracts/ISettingsUtils"
import type { SettingsDto } from "@shared/dto/SettingsDto"
import { inject } from "inversify"
import DI_KEYS from "../constants/di_keys"

export default class SettingsService {
  constructor(
    @inject(DI_KEYS.SettingsUtils)
    private readonly settingsUtils: ISettingsUtils,
    @inject(DI_KEYS.SettingsRepository)
    private readonly settingsRepository: ISettingsRepository
  ) {}

  async syncSettingsSession(dto: SettingsDto): Promise<boolean> {
    try {
      const model = this.settingsUtils.toSettingsSessionModel(dto)
      await this.settingsRepository.writeSettingsSession(model)
      return true
    } catch (e) {
      return false
    }
  }
}
