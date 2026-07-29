import type { TabEditorDto } from "@shared/dto/TabEditorDto"
import { beforeEach, describe, expect, test, vi } from "vitest"
import FakeMainWindow from "../mocks/FakeMainWindow"
import FakeFileManager from "../modules/fs/FakeFileManager"
import fakeDialogManager, { setFakeConfirmResult, setFakeSaveDialogResult } from "../modules/ui/fakeDialogManager"
import FakeTabRepository from "../modules/tab/FakeTabRepository"
import TabService from "@services/TabService"

import {
  tabSessionPath,
  newFilePath,
  emptyFilePathTabEditorDto,
  defaultTabEditorDto,
  tabEidtorsDto,
} from "../data/test_data"
import FakeTabUtils from "../modules/tab/FakeTabUtils"

let fakeFileManager: FakeFileManager
let fakeTabRepository: FakeTabRepository
let fakeTabUtils: FakeTabUtils
let tabService: TabService
const fakeMainWindow = new FakeMainWindow()

describe("Tab Service - closeTab", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabUtils = new FakeTabUtils(fakeFileManager, fakeTabRepository)
    tabService = new TabService(fakeFileManager, fakeTabRepository, fakeTabUtils, fakeDialogManager)
  })

  test("should save and close tab if data is modified and user confirms save", async () => {
    // Given.
    const data = { ...defaultTabEditorDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    fakeTabRepository.setTabSession({
      activatedId: data.id,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await tabService.closeTab(data, fakeMainWindow as any)

    // Then.
    expect(response).toBe(true)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data.length).toBe(0)
    const file = await fakeFileManager.read(data.filePath)
    expect(file).toBe(data.content)
  })

  test("should close tab without saving if user cancels save confirmation for modified data", async () => {
    // Given.
    const data = { ...defaultTabEditorDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(false)
    await fakeTabRepository.setTabSession({
      activatedId: data.id,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await tabService.closeTab(data, fakeMainWindow as any)

    // Then.
    expect(response).toBe(true)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data.length).toBe(0)
  })

  test("should save to new path, update session, and close tab when closing modified unsaved data", async () => {
    // Given.
    const data = { ...emptyFilePathTabEditorDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    await fakeTabRepository.setTabSession({
      activatedId: data.id,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await tabService.closeTab(data, fakeMainWindow as any)

    // Then.
    expect(response).toBe(true)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data.length).toBe(0)
    const file = await fakeFileManager.read(newFilePath)
    expect(file).toBe(data.content)
  })

  test("should keep tab open if user cancels save dialog when closing modified unsaved data", async () => {
    // Given.
    const data = { ...emptyFilePathTabEditorDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: data.id,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await tabService.closeTab(data, fakeMainWindow as any)

    // Then.
    expect(response).toBe(false)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data.length).toBe(1)
  })

  test("should close tab without saving if data is not modified", async () => {
    // Given.
    const data = { ...defaultTabEditorDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    await fakeTabRepository.setTabSession({
      activatedId: data.id,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await tabService.closeTab(data, fakeMainWindow as any)

    // Then.
    expect(response).toBe(true)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data.length).toBe(0)
  })
})

describe("Tab Service - closeOtherTabs", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabUtils = new FakeTabUtils(fakeFileManager, fakeTabRepository)
    tabService = new TabService(fakeFileManager, fakeTabRepository, fakeTabUtils, fakeDialogManager)
  })

  test("should retain only selected tab and save other modified files if user confirms save", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")
    const exceptData: TabEditorDto = copiedDto.data[1]

    // When.
    await tabService.closeOtherTabs(exceptData, copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(3)
    expect(await fakeFileManager.read(newFilePath)).toBe(copiedDto.data[3].content)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(1)
    expect(tabSession!.data[0].id).toBe(exceptData.id)
    expect(tabSession!.data[0].filePath).toBe(exceptData.filePath)
  })

  test("should retain only selected tab and discard changes in other tabs if user declines save", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(false)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")
    const exceptData: TabEditorDto = copiedDto.data[1]

    // When.
    await tabService.closeOtherTabs(exceptData, copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(1)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(1)
    expect(tabSession!.data[0].id).toBe(exceptData.id)
    expect(tabSession!.data[0].filePath).toBe(exceptData.filePath)
  })

  test("should retain selected tab and tabs with unsaved changes if user cancels save dialog", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    for (const { filePath } of copiedDto.data) {
      fakeFileManager.setFilecontent(filePath, "dummy")
    }
    const spy = vi.spyOn(fakeFileManager, "write")
    const exceptData: TabEditorDto = copiedDto.data[1]

    // When.
    await tabService.closeOtherTabs(exceptData, copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(2)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(2)
    expect(tabSession!.data[0].id).toBe(exceptData.id)
    expect(tabSession!.data[0].filePath).toBe(exceptData.filePath)
    expect(await fakeFileManager.read(copiedDto.data[2].filePath)).toBe(copiedDto.data[2].content)
  })
})

describe("Tab Service - closeTabsToRight", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabUtils = new FakeTabUtils(fakeFileManager, fakeTabRepository)
    tabService = new TabService(fakeFileManager, fakeTabRepository, fakeTabUtils, fakeDialogManager)
  })

  test("should close tabs to the right of the reference tab and save modified ones if user confirms save", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")
    const refData: TabEditorDto = copiedDto.data[1]

    // When.
    await tabService.closeTabsToRight(refData, copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(3)
    expect(await fakeFileManager.read(newFilePath)).toBe(copiedDto.data[3].content)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(2)
    expect(tabSession!.data[tabSession!.data.length - 1].id).toBe(refData.id)
    expect(tabSession!.data[tabSession!.data.length - 1].filePath).toBe(refData.filePath)
  })

  test("should close tabs to the right of the reference tab and discard changes if user declines save", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(false)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")
    const refData: TabEditorDto = copiedDto.data[1]

    // When.
    await tabService.closeTabsToRight(refData, copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(1)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(2)
    expect(tabSession!.data[tabSession!.data.length - 1].id).toBe(refData.id)
    expect(tabSession!.data[tabSession!.data.length - 1].filePath).toBe(refData.filePath)
  })

  test("should retain left tabs and unsaved right tabs if user cancels save dialog", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    for (const { filePath } of copiedDto.data) {
      fakeFileManager.setFilecontent(filePath, "dummy")
    }
    const spy = vi.spyOn(fakeFileManager, "write")
    const refData: TabEditorDto = copiedDto.data[1]

    // When.
    await tabService.closeTabsToRight(refData, copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(2)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(3)
    expect(tabSession!.data[tabSession!.data.length - 1].id).toBe(copiedDto.data[3].id)
    expect(tabSession!.data[tabSession!.data.length - 1].filePath).toBe(copiedDto.data[3].filePath)
    expect(await fakeFileManager.read(copiedDto.data[2].filePath)).toBe(copiedDto.data[2].content)
  })
})

describe("Tab Service - closeAllTabs", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabUtils = new FakeTabUtils(fakeFileManager, fakeTabRepository)
    tabService = new TabService(fakeFileManager, fakeTabRepository, fakeTabUtils, fakeDialogManager)
  })

  test("should close all tabs and save modified ones if user confirms save", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    await tabService.closeAllTabs(copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(3)
    expect(await fakeFileManager.read(newFilePath)).toBe(copiedDto.data[3].content)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(0)
  })

  test("should close all tabs and discard modified ones if user declines save", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(false)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    await tabService.closeAllTabs(copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(1)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(0)
  })

  test("should retain unsaved tabs if user confirms save but cancels save dialog", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath, isModified }) => ({ id, filePath, isModified })),
    })
    for (const { filePath } of copiedDto.data) {
      fakeFileManager.setFilecontent(filePath, "dummy")
    }
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    await tabService.closeAllTabs(copiedDto, fakeMainWindow as any)

    // Then.
    expect(spy).toHaveBeenCalledTimes(2)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data.length).toBe(1)
    expect(await fakeFileManager.read(copiedDto.data[2].filePath)).toBe(copiedDto.data[2].content)
  })
})

describe("Tab Service - syncTabSession", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabUtils = new FakeTabUtils(fakeFileManager, fakeTabRepository)
    tabService = new TabService(fakeFileManager, fakeTabRepository, fakeTabUtils, fakeDialogManager)
  })

  test("should synchronize tab session from renderer and save it", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }

    // When.
    await tabService.syncTabSession(copiedDto)

    // Then.
    const session = await fakeTabRepository.readTabSession()
    const dtoToSessionData = copiedDto.data.map((d) => {
      return {
        id: d.id,
        filePath: d.filePath,
        isModified: d.isModified,
      }
    })
    expect(dtoToSessionData).toEqual(session!.data)
    expect(copiedDto.activatedId).toBe(session!.activatedId)
  })
})
