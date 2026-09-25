// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { createCommandHarness, type CommandHarness } from "../modules/commandHarness"
import { buildDto, loadTree, wrapperOf, rowOf } from "../modules/tree/treeHarness"
import type { TreeDto } from "@shared/dto/TreeDto"

/**
 * root
 *  ├ docs/          expanded, loaded
 *  │   └ a.md
 *  ├ empty/         expanded, nothing inside
 *  ├ closed/        collapsed, never read (children null, like a fresh disk read)
 *  ├ loaded/        read earlier, then collapsed (the only way a collapsed folder holds children)
 *  │   └ b.md
 *  └ readme.md
 */
function sample(): TreeDto {
  const dto = buildDto({
    name: "root",
    children: [
      { name: "docs", children: [{ name: "a.md" }] },
      { name: "empty", children: [] },
      { name: "closed", children: [], expanded: false },
      { name: "loaded", children: [{ name: "b.md" }] },
      { name: "readme.md" },
    ],
  })
  const closed = dto.children!.find((c) => c.name === "closed")!
  closed.children = null
  return dto
}

let harness: CommandHarness
let openDirectory: ReturnType<typeof vi.fn>

beforeEach(async () => {
  harness = createCommandHarness()
  loadTree(harness.tree, sample())
  // Main hands a collapsed folder over with children null, so a collapsed folder
  // that still holds children can only come from the user closing it.
  await expand("root/loaded")
  openDirectory = vi.fn(async (dto: TreeDto) => ({
    result: true,
    data: { ...dto, expanded: true, children: diskChildren[dto.path] ?? [] },
  }))
  window.rendererToMain = { ...window.rendererToMain, openDirectory } as unknown as typeof window.rendererToMain
})

const diskChildren: Record<string, TreeDto[]> = {}
const file = (parent: string, name: string, indent: number): TreeDto => ({
  path: `${parent}/${name}`,
  name,
  indent,
  directory: false,
  expanded: false,
  children: null,
})

const indexOf = (p: string) => harness.tree.facade.getFlattenIndexByPath(p)
const add = (p: string, isDirectory = false) =>
  harness.fireWatchSync(null, null, [{ type: "add", path: p, isDirectory }])
const expand = (p: string) => harness.treeController.performOpenDirectoryByTreeNode(rowOf(harness.tree, p)!)

describe("external create scenarios", () => {
  it("A: a file created in the root shows up as a row", async () => {
    await add("root/new.md")
    expect(indexOf("root/new.md")).toBeDefined()
    expect(wrapperOf(harness.tree, "root/new.md")).toBeTruthy()
    expect(harness.tree.content.contains(wrapperOf(harness.tree, "root/new.md")!)).toBe(true)
  })

  it("B: a file created in an expanded empty folder shows up", async () => {
    await add("root/empty/x.md")
    expect(indexOf("root/empty/x.md")).toBeDefined()
    expect(wrapperOf(harness.tree, "root/empty/x.md")).toBeTruthy()
  })

  it("C: a file created in a never-read folder appears once it is expanded", async () => {
    await add("root/closed/x.md")
    expect(indexOf("root/closed/x.md")).toBeUndefined()

    diskChildren["root/closed"] = [file("root/closed", "x.md", 2)]
    await expand("root/closed")

    expect(openDirectory).toHaveBeenCalled()
    expect(indexOf("root/closed/x.md")).toBeDefined()
    expect(wrapperOf(harness.tree, "root/closed/x.md")).toBeTruthy()
  })

  it("D: a file created in a collapsed folder read earlier appears when expanded, without a disk read", async () => {
    await add("root/loaded/x.md")
    await expand("root/loaded")

    expect(openDirectory).not.toHaveBeenCalled()
    expect(indexOf("root/loaded/x.md")).toBeDefined()
    expect(indexOf("root/loaded/b.md")).toBeDefined()
    expect(wrapperOf(harness.tree, "root/loaded/x.md")).toBeTruthy()
  })

  it("E: a folder tree that appears at once shows the top folder, and expanding reads the rest", async () => {
    await harness.fireWatchSync(null, null, [
      { type: "add", path: "root/pack", isDirectory: true },
      { type: "add", path: "root/pack/inner", isDirectory: true },
      { type: "add", path: "root/pack/inner/f.md", isDirectory: false },
    ])
    expect(indexOf("root/pack")).toBeDefined()

    diskChildren["root/pack"] = [{ ...file("root/pack", "inner", 2), directory: true }]
    await expand("root/pack")

    expect(openDirectory).toHaveBeenCalledTimes(1)
    expect(indexOf("root/pack/inner")).toBeDefined()
  })

  it("H: a file that lands in a just-created folder in a later batch is found on expand", async () => {
    await add("root/pack", true)
    await add("root/pack/f.md")
    expect(indexOf("root/pack/f.md")).toBeUndefined()

    diskChildren["root/pack"] = [file("root/pack", "f.md", 2)]
    await expand("root/pack")

    expect(openDirectory).toHaveBeenCalledTimes(1)
    expect(indexOf("root/pack/f.md")).toBeDefined()
  })

  it("F: chokidar's delete order (dir before its files) does not break the batch", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined)
    await harness.fireWatchSync(null, null, [
      { type: "remove", path: "root/docs", isDirectory: true },
      { type: "remove", path: "root/docs/a.md", isDirectory: false },
      { type: "add", path: "root/after.md", isDirectory: false },
    ])
    expect(error).not.toHaveBeenCalled()
    expect(indexOf("root/docs")).toBeUndefined()
    expect(indexOf("root/docs/a.md")).toBeUndefined()
    expect(indexOf("root/after.md")).toBeDefined()
    expect(indexOf("root/readme.md")).toBeDefined()
    error.mockRestore()
  })

  it("G: rows keep their order and indices after several external adds", async () => {
    await add("root/b.md")
    await add("root/a.md")
    await add("root/zzz", true)
    const flat = harness.tree.facade.flattenTree.map((n) => n.path)
    expect(flat).toEqual([
      "root",
      "root/docs",
      "root/docs/a.md",
      "root/empty",
      "root/closed",
      "root/loaded",
      "root/zzz",
      "root/a.md",
      "root/b.md",
      "root/readme.md",
    ])
    // The DOM agrees with the model.
    const domOrder = Array.from(harness.tree.content.querySelectorAll("[data-tree-path]")).map(
      (el) => (el as HTMLElement).dataset.treePath
    )
    expect(domOrder.filter((p) => p && p.split("/").length === 2)).toEqual([
      "root/docs",
      "root/empty",
      "root/closed",
      "root/loaded",
      "root/zzz",
      "root/a.md",
      "root/b.md",
      "root/readme.md",
    ])
  })
})
