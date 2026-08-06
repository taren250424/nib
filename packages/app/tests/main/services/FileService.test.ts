import FileService from "@services/FileService"
import type { TabEditorDto } from "@shared/dto/TabEditorDto"
import { beforeEach, describe, expect, test, vi } from "vitest"
import FakeMainWindow from "../mocks/FakeMainWindow"
import FakeFileManager from "../modules/fs/FakeFileManager"
import fakeDialogManager, {
  setFakeOpenFileDialogResult,
  setFakeOpenDirectoryDialogResult,
  setFakeSaveDialogResult,
} from "../modules/ui/fakeDialogManager"
import FakeTabRepository from "../modules/tab/FakeTabRepository"
import FakeTreeRepository from "../modules/tree/FakeTreeRepository"
import FakeTreeUtils from "../modules/tree/FakeTreeUtils"
import FakeFileWatcher from "../modules/fs/FakeFileWatcher"

import {
  tabSessionPath,
  treeSessionPath,
  newFilePath,
  emptyFilePathTabEditorDto,
  defaultTabEditorDto,
  tabEidtorsDto,
  treeDto,
} from "../data/test_data"

let fakeFileManager: FakeFileManager
let fakeTabRepository: FakeTabRepository
let fakeTreeUtils: FakeTreeUtils
let fakeTreeRepository: FakeTreeRepository
let fakeFileWatcher: FakeFileWatcher
let fileService: FileService
const fakeMainWindow = new FakeMainWindow()

describe("FileService.newTab", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeUtils = new FakeTreeUtils()
    fakeFileWatcher = new FakeFileWatcher()
    fileService = new FileService(
      fakeFileManager,
      fakeTabRepository,
      fakeDialogManager,
      fakeTreeRepository,
      fakeTreeUtils,
      fakeFileWatcher
    )
  })

  test("should create a new tab with an incremented ID based on the existing session", async () => {
    // Given.
    fakeFileManager.setPathExistence(tabSessionPath, true)
    await fakeTabRepository.setTabSession({
      activatedId: -1,
      data: [{ id: 5, filePath: "file.md", isModified: false }],
    })

    // When.
    const id = await fileService.newTab()

    // Then.
    expect(id).toBe(6)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data.length).toBe(2)
    expect(session!.data[1].id).toBe(6)
  })
})

describe("FileService.openFile", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeUtils = new FakeTreeUtils()
    fakeFileWatcher = new FakeFileWatcher()
    fileService = new FileService(
      fakeFileManager,
      fakeTabRepository,
      fakeDialogManager,
      fakeTreeRepository,
      fakeTreeUtils,
      fakeFileWatcher
    )
  })

  test("should return null if the open file dialog is canceled", async () => {
    // Given.
    setFakeOpenFileDialogResult({ canceled: true, filePaths: [] })

    // When.
    const result = await fileService.openFile()

    // Then.
    expect(result).toBe(null)
  })

  test("should open a file, update tab session, and return its content", async () => {
    // Given.
    setFakeOpenFileDialogResult({ canceled: false, filePaths: ["openPath"] })
    fakeFileManager.setFilecontent("openPath", "content")
    fakeTabRepository.setTabSession({
      activatedId: 0,
      data: [
        { id: 0, filePath: "path1", isModified: false },
        { id: 1, filePath: "path2", isModified: false },
      ],
    })

    // When.
    const data = await fileService.openFile()

    // Then.
    expect(data!.filePath).toBe("openPath")
    expect(data!.content).toBe("content")
    const session = await fakeTabRepository.readTabSession()
    expect(session!.activatedId).toBe(2)
    expect(session!.data.length).toBe(3)
    expect(session!.data[2].filePath).toBe("openPath")
  })

  test("should open a file by path, update tab session, and return its content", async () => {
    // Given.
    fakeFileManager.setFilecontent("testPath", "testContent")
    fakeTabRepository.setTabSession({
      activatedId: 0,
      data: [
        { id: 0, filePath: "path1", isModified: false },
        { id: 1, filePath: "path2", isModified: false },
      ],
    })

    // When.
    const response = await fileService.openFile("testPath")

    // Then.
    expect(response!.content).toBe("testContent")
    expect(response!.id).toBe(2)
    const session = await fakeTabRepository.readTabSession()
    expect(session!.activatedId).toBe(2)
    expect(session!.data[2].filePath).toBe("testPath")
  })
})

describe("FileService.openDirectory", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeUtils = new FakeTreeUtils()
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
    fakeFileWatcher = new FakeFileWatcher()
    fileService = new FileService(
      fakeFileManager,
      fakeTabRepository,
      fakeDialogManager,
      fakeTreeRepository,
      fakeTreeUtils,
      fakeFileWatcher
    )
  })

  test("should return the correctly updated root tree when opening a directory via dialog", async () => {
    // Given.
    const copiedDto = { ...treeDto }
    fakeTreeUtils.setTree(copiedDto)
    setFakeOpenDirectoryDialogResult({
      canceled: false,
      filePaths: [copiedDto.path],
    })

    // When.
    const response = await fileService.openDirectory()

    // Then.
    expect(response).toEqual(copiedDto)
    const session = await fakeTreeRepository.readTreeSession()
    expect(response!.path).toEqual(session!.path)
  })

  test("should return the correctly updated child tree when opening a directory via dialog", async () => {
    // Given.
    const copiedDto = { ...treeDto }
    fakeTreeUtils.setTree(copiedDto)
    fakeTreeRepository.setTreeSession(copiedDto)
    setFakeOpenDirectoryDialogResult({
      canceled: false,
      filePaths: [copiedDto.path],
    })

    // When.
    const response = await fileService.openDirectory()

    // Then.
    expect(response!.path).toBe(copiedDto.path)
    const session = await fakeTreeRepository.readTreeSession()
    expect(response!.path).toBe(session!.path)
  })

  test("should return the correctly updated root tree when opening a directory by DTO", async () => {
    // Given.
    const copiedDto = { ...treeDto }
    fakeTreeUtils.setTree(copiedDto)

    // When.
    const response = await fileService.openDirectory(copiedDto)

    // Then.
    expect(response).toEqual(copiedDto)
    const session = await fakeTreeRepository.readTreeSession()
    expect(response!.path).toEqual(session!.path)
  })

  test("should return the correctly updated child tree and mark it as expanded when opening a child directory by DTO", async () => {
    // Given.
    const copiedDto = { ...treeDto }
    fakeTreeUtils.setTree(copiedDto)
    fakeTreeRepository.setTreeSession(copiedDto)

    // When.
    const response = await fileService.openDirectory(copiedDto!.children![0])

    // Then.
    expect(response!.path).toBe(copiedDto!.children![0].path)
    const session = await fakeTreeRepository.readTreeSession()
    expect(response!.path).toBe(session!.children![0].path)
    expect(session!.children![0].expanded).toBe(true)
  })
})

describe("FileService.save", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeUtils = new FakeTreeUtils()
    fakeFileWatcher = new FakeFileWatcher()
    fileService = new FileService(
      fakeFileManager,
      fakeTabRepository,
      fakeDialogManager,
      fakeTreeRepository,
      fakeTreeUtils,
      fakeFileWatcher
    )
  })

  test("should return modified status true if file path is empty and save dialog is canceled", async () => {
    // Given.
    const data: TabEditorDto = { ...emptyFilePathTabEditorDto }
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })

    // When.
    const result: TabEditorDto = await fileService.save(data, fakeMainWindow as any)

    // Then.
    expect(result.isModified).toBe(true)
  })

  test("should save new file and update tab session if file path is empty and save dialog is confirmed", async () => {
    // Given.
    const data: TabEditorDto = { ...emptyFilePathTabEditorDto }
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    fakeFileManager.setPathExistence(tabSessionPath, true)
    await fakeTabRepository.setTabSession({
      activatedId: 1,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await fileService.save(data, fakeMainWindow as any)

    // Then.
    expect(response.isModified).toBe(false)
    expect(await fakeFileManager.read(newFilePath)).toBe(data.content)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data[0].id).toBe(0)
    expect(tabSession!.data[0].filePath).toBe(newFilePath)
  })

  test("should save existing file and update tab session if file path exists", async () => {
    // Given.
    const data = { ...defaultTabEditorDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    await fakeTabRepository.setTabSession({
      activatedId: 1,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await fileService.save(data, fakeMainWindow as any)

    // Then.
    expect(response.isModified).toBe(false)
    expect(await fakeFileManager.read(data.filePath)).toBe(data.content)
    const tabSession = await fakeTabRepository.readTabSession()
    expect(tabSession!.data[0].id).toBe(0)
    expect(tabSession!.data[0].filePath).toBe(data.filePath)
  })
})

describe("FileService.saveAs", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeUtils = new FakeTreeUtils()
    fakeFileWatcher = new FakeFileWatcher()
    fileService = new FileService(
      fakeFileManager,
      fakeTabRepository,
      fakeDialogManager,
      fakeTreeRepository,
      fakeTreeUtils,
      fakeFileWatcher
    )
  })

  test("should return null if save-as dialog is canceled", async () => {
    // Given.
    const data = { ...defaultTabEditorDto }
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })

    // When.
    const response = await fileService.saveAs(data, fakeMainWindow as any)

    // Then.
    expect(response).toBe(null)
  })

  test("should save file and update tab session if save-as dialog returns a path", async () => {
    // Given.
    const data = { ...defaultTabEditorDto }
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    fakeFileManager.setPathExistence(tabSessionPath, true)
    await fakeTabRepository.setTabSession({
      activatedId: 1,
      data: [{ id: data.id, filePath: data.filePath, isModified: false }],
    })

    // When.
    const response = await fileService.saveAs(data, fakeMainWindow as any)

    // Then.
    expect(response!.isModified).toBe(false)
    const savedFile = await fakeFileManager.read(newFilePath)
    expect(savedFile).toBe(data.content)
    const updatedTabSession = await fakeTabRepository.readTabSession()
    expect(updatedTabSession!.data[updatedTabSession!.data.length - 1].id).toBe(data.id + 1)
    expect(updatedTabSession!.data[updatedTabSession!.data.length - 1].filePath).toBe(newFilePath)
  })
})

describe("FileService.saveAll", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTabRepository = new FakeTabRepository(tabSessionPath, fakeFileManager)
    fakeTreeUtils = new FakeTreeUtils()
    fakeFileWatcher = new FakeFileWatcher()
    fileService = new FileService(
      fakeFileManager,
      fakeTabRepository,
      fakeDialogManager,
      fakeTreeRepository,
      fakeTreeUtils,
      fakeFileWatcher
    )
  })

  test("should save all modified files when save dialog is confirmed for new files", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath }) => ({ id, filePath, isModified: false })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    const response = await fileService.saveAll(copiedDto, fakeMainWindow as any)

    // Then.
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data[0].filePath).toBe("")
    expect(session!.data[1].filePath).toBe(copiedDto.data[1].filePath)
    const file_2 = await fakeFileManager.read(copiedDto.data[2].filePath)
    expect(file_2).toBe(copiedDto.data[2].content)
    expect(response.data[2].isModified).toBe(false)
    const file_3 = await fakeFileManager.read(newFilePath)
    expect(file_3).toBe(copiedDto.data[3].content)
    expect(response.data[3].isModified).toBe(false)
    expect(session!.data[3].filePath).toBe(newFilePath)
    expect(spy).toHaveBeenCalledTimes(3)
  })

  test("should not save unsaved files if save dialog is canceled for new files", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeSaveDialogResult({
      canceled: true,
      filePath: "",
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath }) => ({ id, filePath, isModified: false })),
    })
    const spy = vi.spyOn(fakeFileManager, "write")

    // When.
    const response = await fileService.saveAll(copiedDto, fakeMainWindow as any)

    // Then.
    const session = await fakeTabRepository.readTabSession()
    expect(session!.data[0].filePath).toBe("")
    expect(session!.data[1].filePath).toBe(copiedDto.data[1].filePath)
    const file_2 = await fakeFileManager.read(copiedDto.data[2].filePath)
    expect(file_2).toBe(copiedDto.data[2].content)
    expect(response.data[2].isModified).toBe(false)
    expect(response.data[3].isModified).toBe(true)
    expect(session!.data[3].filePath).toBe("")
    expect(spy).toHaveBeenCalledTimes(2)
  })

  // One unwritable file used to end the loop where it stood, taking the save of
  // every tab behind it with no word to anyone.
  test("should save the other tabs when one of them refuses the write", async () => {
    // Given.
    const copiedDto = { ...tabEidtorsDto }
    fakeFileManager.setPathExistence(tabSessionPath, true)
    setFakeSaveDialogResult({
      canceled: false,
      filePath: newFilePath,
    })
    await fakeTabRepository.setTabSession({
      activatedId: copiedDto.activatedId,
      data: copiedDto.data.map(({ id, filePath }) => ({ id, filePath, isModified: false })),
    })
    fakeFileManager.setWriteFailure(copiedDto.data[2].filePath)

    // When.
    const response = await fileService.saveAll(copiedDto, fakeMainWindow as any)

    // Then.
    expect(response.data[2].isModified).toBe(true)
    const session = await fakeTabRepository.readTabSession()
    // Still modified in the session, which is where the next start learns to
    // read the tab back from its temp copy rather than from the stale file.
    expect(session!.data[2].isModified).toBe(true)

    const file_3 = await fakeFileManager.read(newFilePath)
    expect(file_3).toBe(copiedDto.data[3].content)
    expect(response.data[3].isModified).toBe(false)
  })
})
