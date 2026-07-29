import type TreeSessionModel from "@main/models/TreeSessionModel"
import TreeService from "@services/TreeService"
import type { TreeDto } from "@shared/dto/TreeDto"
import path from "path"
import { beforeEach, describe, expect, test } from "vitest"
import FakeFileManager from "../modules/fs/FakeFileManager"
import FakeTreeUtils from "../modules/tree/FakeTreeUtils"
import FakeTreeRepository from "../modules/tree/FakeTreeRepository"
import FakeFileWatcher from "../modules/fs/FakeFileWatcher"

import { treeSessionPath, treeDto, treeSessionModel } from "../data/test_data"

let fakeFileManager: FakeFileManager
let fakeTreeUtils: FakeTreeUtils
let fakeTreeRepository: FakeTreeRepository
let fakeFileWatcher: FakeFileWatcher
let treeService: TreeService

function traverse(node: TreeSessionModel | TreeDto, cb: (node: TreeSessionModel | TreeDto) => void) {
  cb(node)
  for (const child of node.children ?? []) {
    traverse(child, cb)
  }
}

function deepCopyTreeSessionModel(model: TreeSessionModel): TreeSessionModel {
  return {
    ...model,
    children: model.children ? model.children.map((child) => deepCopyTreeDto(child)) : [],
  }
}

function deepCopyTreeDto(dto: TreeDto): TreeDto {
  return {
    ...dto,
    children: dto.children ? dto.children.map((child) => deepCopyTreeDto(child)) : [],
  }
}

describe("Tree Service - rename", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTreeUtils = new FakeTreeUtils()
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
    fakeFileWatcher = new FakeFileWatcher()
    treeService = new TreeService(fakeFileManager, fakeTreeUtils, fakeTreeRepository, fakeFileWatcher)
  })

  test("should rename a node and update its path along with all child nodes in the session", async () => {
    // Given.
    const copiedTreeSessionModel = deepCopyTreeSessionModel(treeSessionModel)
    traverse(copiedTreeSessionModel, (model) => {
      fakeFileManager.setPathExistence(model.path, true)
      fakeFileManager.setFilecontent(model.path, model.name)
    })
    await fakeTreeRepository.setTreeSession(copiedTreeSessionModel)
    const oldPath = copiedTreeSessionModel!.children![0].path
    const newPath = path.join(path.dirname(oldPath), "renamed")

    // When.
    await treeService.rename(oldPath, newPath)

    // Then.
    const session = await fakeTreeRepository.readTreeSession()
    expect(path.normalize(session!.children![0].path)).toBe(path.normalize(newPath))
    const checkPaths = (model: TreeSessionModel) => {
      expect(path.normalize(model.path).startsWith(path.normalize(newPath))).toBe(true)
      for (const child of model.children ?? []) {
        checkPaths(child)
      }
    }
    checkPaths(session!.children![0])
  })

  test("should append a numeric suffix to avoid duplicate file names during rename", async () => {
    // Given.
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    await fakeTreeRepository.setTreeSession(copiedTreeDto)
    const prePath = copiedTreeDto!.children![0].children![2].path

    // When.
    const response = await treeService.rename(prePath, prePath)

    // Then.
    expect(response.result).toBe(true)
    const dirName = path.dirname(prePath)
    const expectedBaseName = `dir_test-1.md`
    const expectedPath = path.join(dirName, expectedBaseName)
    expect(response.data).toBe(expectedPath)
  })
})

describe("Tree Service - paste", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTreeUtils = new FakeTreeUtils()
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
    fakeFileWatcher = new FakeFileWatcher()
    treeService = new TreeService(fakeFileManager, fakeTreeUtils, fakeTreeRepository, fakeFileWatcher)
  })

  test("should delete original files and copy to new path when clipboard mode is 'cut'", async () => {
    // Given.
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const target = copiedTreeDto
    const childrenToPaste = copiedTreeDto!.children![0].children![0].children // Directory deep.
    const originalPaths = childrenToPaste!.map((c) => c.path) // For checking delete with cut mode.

    // When.
    const response = await treeService.paste(target, childrenToPaste!, "cut")

    // Then.
    expect(response.result).toBe(true)
    for (const oldPath of originalPaths) {
      const exists = await fakeFileManager.exists(oldPath)
      expect(exists).toBe(false)
    }
    for (const pasted of childrenToPaste!) {
      const exists = await fakeFileManager.exists(pasted.path)
      expect(exists).toBe(true)
      const content = await fakeFileManager.read(pasted.path)
      expect(content).toBe(pasted.name)
      expect(pasted.indent).toBe(target.indent + 1)
    }
  })

  test("should rollback all changes if any file operation fails during 'cut' paste", async () => {
    // Given
    const copiedTreeDto = { ...treeDto }
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })

    const originalCopy = fakeFileManager.copy.bind(fakeFileManager)
    const failPath = path.join(copiedTreeDto.path, copiedTreeDto!.children![0].children![0].children![0].name)
    fakeFileManager.copy = async (src: string, dest: string) => {
      if (dest === failPath) {
        throw new Error("Copy failed")
      }
      return originalCopy(src, dest)
    }

    const target = copiedTreeDto
    const childrenToPaste = copiedTreeDto!.children![0].children![0].children // Directory deep.
    const originalPaths = childrenToPaste!.map((c) => c.path) // For checking delete with cut mode.

    // When
    const response = await treeService.paste(target, childrenToPaste!, "cut")

    // Then
    expect(response.result).toBe(false)
    for (const oldPath of originalPaths) {
      const exists = await fakeFileManager.exists(oldPath)
      expect(exists).toBe(true)
    }
    for (const pasted of childrenToPaste!) {
      const pastedPath = path.join(target.path, pasted.name)
      const exists = await fakeFileManager.exists(pastedPath)
      expect(exists).toBe(false)
    }
  })

  test("should copy files to new path without deleting originals when clipboard mode is 'copy'", async () => {
    // Given.
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const target = copiedTreeDto
    const childrenToPaste = copiedTreeDto!.children![0].children![0].children // Directory deep.
    const originalPaths = childrenToPaste!.map((c) => c.path) // For checking original still exists.

    // When.
    const response = await treeService.paste(target, childrenToPaste!, "copy")

    // Then.
    expect(response.result).toBe(true)
    for (const oldPath of originalPaths) {
      const exists = await fakeFileManager.exists(oldPath)
      expect(exists).toBe(true)
    }
    for (const pasted of childrenToPaste!) {
      const exists = await fakeFileManager.exists(pasted.path)
      expect(exists).toBe(true)
      const content = await fakeFileManager.read(pasted.path)
      expect(content).toBe(pasted.name)
      expect(pasted.indent).toBe(target.indent + 1)
    }
  })

  test("should rollback all changes if any file operation fails during 'copy' paste", async () => {
    // Given
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const originalCopy = fakeFileManager.copy.bind(fakeFileManager)
    const failPath = path.join(copiedTreeDto.path, copiedTreeDto!.children![0].children![0].children![0].name)
    fakeFileManager.copy = async (src: string, dest: string) => {
      if (dest === failPath) {
        throw new Error("Copy failed")
      }
      return originalCopy(src, dest)
    }
    const target = copiedTreeDto
    const childrenToPaste = copiedTreeDto!.children![0].children![0].children
    const originalPaths = childrenToPaste!.map((c) => c.path)

    // When
    const response = await treeService.paste(target, childrenToPaste!, "copy")

    // Then
    expect(response.result).toBe(false)
    for (const oldPath of originalPaths) {
      const exists = await fakeFileManager.exists(oldPath)
      expect(exists).toBe(true)
    }
    for (const pasted of childrenToPaste!) {
      const pastedPath = path.join(target.path, pasted.name)
      const exists = await fakeFileManager.exists(pastedPath)
      expect(exists).toBe(false)
    }
  })

  test("should correctly handle name conflicts by appending numeric suffixes during copy", async () => {
    // Given
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const selectedDtos = []
    selectedDtos.push(copiedTreeDto!.children![0].children![2])

    // When.
    const response = await treeService.paste(copiedTreeDto, selectedDtos, "copy")

    // Then.
    expect(response.result).toBe(true)
    expect(response.data[0]).toBe(selectedDtos[0].path)
  })

  test("should correctly handle name conflicts by appending numeric suffixes during cut", async () => {
    // Given
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const selectedDtos = []
    selectedDtos.push(copiedTreeDto!.children![0].children![3])

    // When.
    const response = await treeService.paste(copiedTreeDto, selectedDtos, "cut")

    // Then.
    expect(response.result).toBe(true)
    expect(response.data[0]).toBe(selectedDtos[0].path)
  })

  test("should return correct new file paths when moving multiple files via 'cut' and paste", async () => {
    // Given
    const copiedTreeDto = deepCopyTreeDto(treeDto)
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const selectedDtos = []
    selectedDtos.push(copiedTreeDto!.children![0].children![2])
    selectedDtos.push(copiedTreeDto!.children![0].children![3])

    // When.
    const response = await treeService.paste(copiedTreeDto, selectedDtos, "cut")

    // Then.
    expect(response.result).toBe(true)
    expect(path.basename(response.data[0])).toBe(path.basename(copiedTreeDto!.children![0].children![2].path))
    expect(path.basename(response.data[1])).toBe(path.basename(copiedTreeDto!.children![0].children![3].path))
  })
})

describe("Tree Service - create", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTreeUtils = new FakeTreeUtils()
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
    fakeFileWatcher = new FakeFileWatcher()
    treeService = new TreeService(fakeFileManager, fakeTreeUtils, fakeTreeRepository, fakeFileWatcher)
  })

  test("should create a new file at the specified path", async () => {
    // Given
    const copiedTreeDto = { ...treeDto }
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const dir = copiedTreeDto.path
    const base = path.basename(copiedTreeDto.path)
    const targetPath = path.join(dir, base)

    // When.
    await treeService.create(targetPath, false)

    // Then.
    const ret = await fakeFileManager.exists(targetPath)
    expect(ret).toBe(true)
  })

  test("should create a new file named after the target directory if no base name is provided", async () => {
    // Given
    const copiedTreeDto = { ...treeDto }
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const dir = copiedTreeDto.path
    const base = path.basename(copiedTreeDto.path)
    const targetPath = path.join(dir, base)

    // When.
    await treeService.create(targetPath, false)

    // Then.
    const ret = await fakeFileManager.exists(path.join(dir, base))
    expect(ret).toBe(true)
  })

  test("should create a new directory at the specified path", async () => {
    // Given
    const copiedTreeDto = { ...treeDto }
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const dir = copiedTreeDto.path
    const base = path.basename(copiedTreeDto.path)
    const targetPath = path.join(dir, base)

    // When.
    await treeService.create(targetPath, true)

    // Then.
    const ret = await fakeFileManager.exists(targetPath)
    expect(ret).toBe(true)
  })

  test("should create a new directory named after the target directory if no base name is provided", async () => {
    // Given
    const copiedTreeDto = { ...treeDto }
    traverse(copiedTreeDto, (dto) => {
      fakeFileManager.setPathExistence(dto.path, true)
      fakeFileManager.setFilecontent(dto.path, dto.name)
    })
    const dir = copiedTreeDto.path
    const base = path.basename(copiedTreeDto.path)
    const targetPath = path.join(dir, base)

    // When.
    await treeService.create(targetPath, true)

    // Then.
    const ret = await fakeFileManager.exists(path.join(dir, base))
    expect(ret).toBe(true)
  })
})

describe("Tree Service - syncTreeSessionFromRenderer", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTreeUtils = new FakeTreeUtils()
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
    fakeFileWatcher = new FakeFileWatcher()
    treeService = new TreeService(fakeFileManager, fakeTreeUtils, fakeTreeRepository, fakeFileWatcher)
  })

  test("should synchronize tree session from renderer and save it", async () => {
    // Given.
    const copiedDto = deepCopyTreeDto(treeDto)

    // When.
    await treeService.syncTreeSessionFromRenderer(copiedDto)

    // Then.
    const session = await fakeTreeRepository.readTreeSession()
    const dtoPaths: string[] = []
    traverse(copiedDto, (node) => dtoPaths.push(path.normalize(node.path)))
    const sessionPaths: string[] = []
    traverse(session!, (node) => sessionPaths.push(path.normalize(node.path)))
    expect(sessionPaths).toEqual(dtoPaths)
  })
})

describe("Tree Service - getSyncedTreeSession", () => {
  beforeEach(() => {
    fakeFileManager = new FakeFileManager()
    fakeTreeUtils = new FakeTreeUtils()
    fakeTreeRepository = new FakeTreeRepository(treeSessionPath, fakeFileManager)
    fakeFileWatcher = new FakeFileWatcher()
    treeService = new TreeService(fakeFileManager, fakeTreeUtils, fakeTreeRepository, fakeFileWatcher)
  })

  test("should synchronize tree session with file system changes and add new files", async () => {
    // Given.
    const copiedModel = deepCopyTreeDto(treeSessionModel)
    await fakeTreeRepository.setTreeSession(copiedModel)
    traverse(copiedModel, (model) => {
      fakeFileManager.setPathExistence(model.path, true)
      fakeFileManager.setFilecontent(model.path, model.name)
    })
    const newFilePath = path.join(copiedModel.path, "newFilePath")
    const newFileData = "newFileData"
    fakeFileManager.setPathExistence(newFilePath, true)
    fakeFileManager.setFilecontent(newFilePath, newFileData)
    copiedModel!.children!.push({
      path: newFilePath,
      name: "newFilePath",
      indent: 1,
      directory: false,
      expanded: false,
      children: null,
    })
    fakeTreeUtils.setTree(copiedModel)

    // When.
    await treeService.getSyncedTreeSession()

    // Then.
    const session = await fakeTreeRepository.readTreeSession()
    const hasNewFile = session!.children?.some((child) => child.path === newFilePath)
    expect(hasNewFile).toBe(true)
  })

  test("should synchronize tree session with file system changes and remove deleted files", async () => {
    // Given.
    const copiedModel = deepCopyTreeDto(treeSessionModel)
    const removedFilePath = copiedModel.children?.[0]?.path
    if (copiedModel.children && removedFilePath) {
      copiedModel.children = copiedModel.children.filter((child) => child.path !== removedFilePath)
    }
    await fakeTreeRepository.setTreeSession(copiedModel)
    traverse(copiedModel, (model) => {
      fakeFileManager.setPathExistence(model.path, true)
      fakeFileManager.setFilecontent(model.path, model.name)
    })
    if (removedFilePath) {
      fakeFileManager.setPathExistence(removedFilePath, false)
    }
    fakeTreeUtils.setTree(copiedModel)

    // When.
    await treeService.getSyncedTreeSession()

    // Then.
    const session = await fakeTreeRepository.readTreeSession()
    const hasRemovedFile = session!.children?.some((child) => child.path === removedFilePath)
    expect(hasRemovedFile).toBe(false)
  })
})
