import SideService from "@services/SideService"
import type { SideDto } from "@shared/dto/SideDto"
import { beforeEach, describe, expect, test } from "vitest"
import FakeFileManager from "../modules/fs/FakeFileManager"
import FakeSideRepository from "../modules/side/FakeSideRepository"

import { sideSessionPath } from "../data/test_data"

describe("Side Service - Sync Side Session", () => {
  const sideDto: SideDto = {
    open: true,
    width: 150,
  }

  let fakeFileManager: FakeFileManager
  let fakeSideRepository: FakeSideRepository
  let sideService: SideService

  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeSideRepository = new FakeSideRepository(sideSessionPath, fakeFileManager)
    sideService = new SideService(fakeSideRepository)
  })

  test("should synchronize side session from renderer and save it", async () => {
    // Given.
    const copiedSideDto = { ...sideDto }

    // When.
    await sideService.syncSideSession(copiedSideDto)

    // Then.
    const sideSession = await fakeSideRepository.readSideSession()
    expect(sideSession!.open).toBe(copiedSideDto.open)
    expect(sideSession!.width).toBe(copiedSideDto.width)
  })
})
