import exit from "@services/exitService"
import { beforeEach, describe, expect, test, vi } from "vitest"
import FakeMainWindow from "../mocks/FakeMainWindow"
import FakeFileManager from "../modules/fs/FakeFileManager"
import fakeDialogManager, { setFakeConfirmResult, setFakeSaveDialogResult } from "../modules/ui/fakeDialogManager"
import FakeTabRepository from "../modules/tab/FakeTabRepository"
import FakeTreeRepository from "../modules/tree/FakeTreeRepository"
import type { TabSessionModel } from "@main/models/TabSessionModel"

import { tabSessionPath, treeSessionPath, newFilePath, tabEidtorsDto, treeDto } from "../data/test_data"

let fakeMainWindow: FakeMainWindow
let fakeFileManager: FakeFileManager
let fakeTabRepository: FakeTabRepository
let fakeTreeRepository: FakeTreeRepository

describe("Exit Service", () => {
  beforeEach(() => {
    fakeMainWindow = new FakeMainWindow()
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
  })

  test("should not close window if user cancels confirm dialog", async () => {
    // Given.
    const copiedTabEditorDto = { ...tabEidtorsDto }
    const copiedTreeDto = { ...treeDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    fakeFileManager.setPathExistence(treeSessionPath, true)
    setFakeConfirmResult(false)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    copiedTabEditorDto.data.forEach((data) => {
      fakeFileManager.setFilecontent(data.filePath, "dummy")
    })
    const model: TabSessionModel = {
      activatedId: 99,
      data: copiedTabEditorDto.data.map(({ id, filePath }) => ({
        id,
        filePath,
        isModified: false,
      })),
    }
    await fakeTabRepository.setTabSession(model)
    await fakeTreeRepository.setTreeSession({
      path: "/old",
      name: "old",
      indent: 0,
      directory: true,
      expanded: false,
      children: [],
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    await exit(
      fakeMainWindow as any,
      fakeFileManager,
      fakeDialogManager,
      fakeTabRepository,
      fakeTreeRepository,
      copiedTabEditorDto,
      copiedTreeDto
    )

    // Then.
    const session = await fakeTabRepository.readTabSession()
    expect(session!.activatedId).toBe(copiedTabEditorDto.activatedId)
    const sessionData = session!.data
    expect(sessionData[0].filePath).toBe("")
    expect(sessionData[1].filePath).toBe(copiedTabEditorDto.data[1].filePath)
    const file_2 = await fakeFileManager.read(copiedTabEditorDto.data[2].filePath)
    expect(file_2).not.toBe(copiedTabEditorDto.data[2].content)
    const file_3 = await fakeFileManager.read(copiedTabEditorDto.data[3].filePath)
    expect(file_3).not.toBe(copiedTabEditorDto.data[3].content)
    expect(spy).toHaveBeenCalledTimes(2)
    expect(fakeMainWindow.close).toHaveBeenCalled()
    const treeSession = await fakeTreeRepository.readTreeSession()
    expect(treeSession).toEqual(copiedTreeDto)
  })

  test("should save sessions and close window if user confirms dialog and cancels save file dialog", async () => {
    // Given.
    const copiedTabEditorDto = { ...tabEidtorsDto }
    const copiedTreeDto = { ...treeDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    fakeFileManager.setPathExistence(treeSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    copiedTabEditorDto.data.forEach((data) => {
      fakeFileManager.setFilecontent(data.filePath, "dummy")
    })
    await fakeTreeRepository.setTreeSession({
      path: "/old",
      name: "old",
      indent: 0,
      directory: true,
      expanded: false,
      children: [],
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    await exit(
      fakeMainWindow as any,
      fakeFileManager,
      fakeDialogManager,
      fakeTabRepository,
      fakeTreeRepository,
      copiedTabEditorDto,
      copiedTreeDto
    )

    // Then.
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data[0].filePath).toBe("")
    expect(session!.data[1].filePath).toBe(copiedTabEditorDto.data[1].filePath)
    const file_2 = await fakeFileManager.read(copiedTabEditorDto.data[2].filePath)
    expect(file_2).toBe(copiedTabEditorDto.data[2].content)
    const file_3 = await fakeFileManager.read(copiedTabEditorDto.data[3].filePath)
    expect(file_3).not.toBe(copiedTabEditorDto.data[3].content)
    expect(spy).toHaveBeenCalledTimes(3)
    expect(fakeMainWindow.close).toHaveBeenCalled()
    const treeSession = await fakeTreeRepository.readTreeSession()
    expect(treeSession).toEqual(copiedTreeDto)
  })

  test("should save sessions and close window if user confirms dialog and selects a file path", async () => {
    // Given.
    const copiedTabEditorDto = { ...tabEidtorsDto }
    const copiedTreeDto = { ...treeDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    fakeFileManager.setPathExistence(treeSessionPath, true)
    setFakeConfirmResult(true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    copiedTabEditorDto.data.forEach((data) => {
      fakeFileManager.setFilecontent(data.filePath, "dummy")
    })
    await fakeTreeRepository.setTreeSession({
      path: "/old",
      name: "old",
      indent: 0,
      directory: true,
      expanded: false,
      children: [],
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    await exit(
      fakeMainWindow as any,
      fakeFileManager,
      fakeDialogManager,
      fakeTabRepository,
      fakeTreeRepository,
      copiedTabEditorDto,
      copiedTreeDto
    )

    // Then.
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data[0].filePath).toBe("")
    expect(session!.data[1].filePath).toBe(copiedTabEditorDto.data[1].filePath)
    const file_2 = await fakeFileManager.read(copiedTabEditorDto.data[2].filePath)
    expect(file_2).toBe(copiedTabEditorDto.data[2].content)
    expect(session!.data[3].filePath).toBe(newFilePath)
    const file_3 = await fakeFileManager.read(newFilePath)
    expect(file_3).toBe(copiedTabEditorDto.data[3].content)
    expect(spy).toHaveBeenCalledTimes(4)
    expect(fakeMainWindow.close).toHaveBeenCalled()
    const treeSession = await fakeTreeRepository.readTreeSession()
    expect(treeSession).toEqual(copiedTreeDto)
  })
})
