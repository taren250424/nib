// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest"

import { TransferEdit } from "@renderer/edits/TransferEdit"
import type { TabEditorFacade, TreeFacade } from "@renderer/modules"
import type { TreeViewModel } from "@renderer/viewmodels/TreeViewModel"

function node(path: string, directory = false): TreeViewModel {
  return {
    path,
    name: path.slice(path.lastIndexOf("/") + 1),
    indent: 1,
    directory,
    expanded: directory,
    children: directory ? [] : null,
  } as TreeViewModel
}

/**
 * The tree and tabs as far as a paste can see them, plus the two IPC calls it
 * makes. Enough to run apply() end to end without the DI container.
 */
function harness(pasteResult: { result: boolean; data: string[] }) {
  const pasteTree = vi.fn().mockResolvedValue(pasteResult)

  window.rendererToMain = {
    pasteTree,
    syncTreeSessionFromRenderer: vi.fn().mockResolvedValue(true),
  } as unknown as typeof window.rendererToMain

  window.utils = {
    getDirName: (p: string) => p.slice(0, p.lastIndexOf("/")),
    getBaseName: (p: string) => p.slice(p.lastIndexOf("/") + 1),
  } as unknown as typeof window.utils

  const treeFacade = {
    toTreeDto: (viewModel: TreeViewModel) => ({ ...viewModel }),
    getFlattenIndexByPath: vi.fn().mockReturnValue(1),
    getRootTreeViewModel: () => node("/root", true),
    applyDelete: vi.fn(),
    applyPaste: vi.fn(),
    applyCreate: vi.fn(),
  } as unknown as TreeFacade

  const tabEditorFacade = {
    getTabEditorViewByPath: () => undefined,
    deleteTabEditorViewByPath: vi.fn(),
    setTabEditorViewByPath: vi.fn(),
  } as unknown as TabEditorFacade

  return { treeFacade, tabEditorFacade, pasteTree }
}

describe("TransferEdit", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("reports the transfer it made", async () => {
    const { treeFacade, tabEditorFacade } = harness({ result: true, data: ["/root/dir/a.md"] })

    const edit = new TransferEdit(treeFacade, tabEditorFacade, node("/root/dir", true), [node("/root/a.md")], "cut")
    await edit.apply()

    expect(edit.didTransfer).toBe(true)
  })

  // Main drops the sources that already live in the target directory. Dropping a
  // node onto the directory it is already in is a common gesture, and it must not
  // cost an undo step for work that never happened.
  it("reports nothing transferred when every source was already in the target", async () => {
    const { treeFacade, tabEditorFacade, pasteTree } = harness({ result: true, data: [] })

    const edit = new TransferEdit(treeFacade, tabEditorFacade, node("/root", true), [node("/root/a.md")], "cut")
    await edit.apply()

    expect(pasteTree).toHaveBeenCalledOnce()
    expect(edit.didTransfer).toBe(false)
    expect(treeFacade.applyDelete).not.toHaveBeenCalled()
  })

  it("reports nothing transferred when main refused", async () => {
    const { treeFacade, tabEditorFacade } = harness({ result: false, data: [] })

    const edit = new TransferEdit(treeFacade, tabEditorFacade, node("/root/dir", true), [node("/root/a.md")], "cut")
    await edit.apply()

    expect(edit.didTransfer).toBe(false)
  })

  it("has nothing to report before it runs", () => {
    const { treeFacade, tabEditorFacade } = harness({ result: true, data: ["/root/dir/a.md"] })

    const edit = new TransferEdit(treeFacade, tabEditorFacade, node("/root/dir", true), [node("/root/a.md")], "cut")

    expect(edit.didTransfer).toBe(false)
  })

  // The revert used to write the tooltip onto tabBox — apply and the rest of
  // the app keep it on tabSpan — and left the name showing where the file no
  // longer is.
  it("puts an open tab's path and name back where they were", async () => {
    const { treeFacade, tabEditorFacade } = harness({ result: true, data: ["/root/dir/a (1).md"] })

    const tabSpan = { title: "", textContent: "" }
    const viewModel = { filePath: "", fileName: "" }
    const view = { getId: () => 7, tabSpan }
    Object.assign(tabEditorFacade, {
      getTabEditorViewByPath: () => view,
      getTabEditorViewModelById: () => viewModel,
    })

    const edit = new TransferEdit(treeFacade, tabEditorFacade, node("/root/dir", true), [node("/root/a.md")], "cut")
    await edit.apply()
    expect(tabSpan.title).toBe("/root/dir/a (1).md")

    window.rendererToMain = {
      ...window.rendererToMain,
      copyTree: vi.fn().mockResolvedValue({ result: true }),
      deletePermanently: vi.fn().mockResolvedValue({ result: true }),
    } as unknown as typeof window.rendererToMain

    await edit.revert()

    expect(tabSpan.title).toBe("/root/a.md")
    expect(tabSpan.textContent).toBe("a.md")
    expect(viewModel.filePath).toBe("/root/a.md")
    expect(viewModel.fileName).toBe("a.md")
  })
})
