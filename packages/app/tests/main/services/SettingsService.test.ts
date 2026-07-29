import { beforeEach, describe, expect, test } from "vitest"
import FakeFileManager from "../modules/fs/FakeFileManager"
import type { SettingsDto } from "@shared/dto/SettingsDto"
import SettingsService from "@main/services/SettingsService"
import FakeSettingsRepository from "../modules/settings/FakeSettingsRepository"
import FakeSettingsUtils from "../modules/settings/FakeSettingsUtils"

import { settingsSessionPath } from "../data/test_data"

describe("Settings Service - Sync Settings Session", () => {
  const settingsDto: SettingsDto = {
    settingEditorDto: {
      width: 600,
      fontSize: 16,
      fontFamily: "sans-serif",
      autoSave: "off",
    },
    settingThemeDto: {
      theme: "light",
    },
  }

  let fakeFileManager: FakeFileManager
  let fakeSettingsRepository: FakeSettingsRepository
  let fakeSettingsUtils: FakeSettingsUtils
  let settingsService: SettingsService

  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeSettingsRepository = new FakeSettingsRepository(settingsSessionPath, fakeFileManager)
    fakeSettingsUtils = new FakeSettingsUtils()
    settingsService = new SettingsService(fakeSettingsUtils, fakeSettingsRepository)
  })

  test("should synchronize settings session from renderer and save it", async () => {
    // Given.
    const copiedSettingsDto = { ...settingsDto }

    // When.
    await settingsService.syncSettingsSession(copiedSettingsDto)

    // Then.
    const session = await fakeSettingsRepository.readSettingsSession()
    expect(session!.settingEditorSessionModel.fontSize).toBe(copiedSettingsDto.settingEditorDto.fontSize)
    expect(session!.settingEditorSessionModel.width).toBe(copiedSettingsDto.settingEditorDto.width)
  })
})
