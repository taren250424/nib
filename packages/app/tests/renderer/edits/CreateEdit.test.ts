// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"

import { CreateEdit } from "@renderer/edits/CreateEdit"
import type { TabEditorFacade, TreeFacade } from "@renderer/modules"
import type { TreeViewModel } from "@renderer/viewmodels/TreeViewModel"

/** The tree and tabs as far as a create can see them, plus the IPC it makes. */
function harness(options: { createdPath: string | null; openTabId?: number }) {
  const create = vi
    .fn()
    .mockResolvedValue(
      options.createdPath === null ? { result: false, data: "" } : { result: true, data: options.createdPath }
    )
  const deleteFiles = vi.fn().mockResolvedValue({ result: true, data: null })
  const syncTreeSessionFromRenderer = vi.fn().mockResolvedValue(true)

  window.rendererToMain = {
    create,
    delete: deleteFiles,
    syncTreeSessionFromRenderer,
  } as unknown as typeof window.rendererToMain

  window.utils = {
    getJoinedPath: (dir: string, name: string) => `${dir}/${name}`,
  } as unknown as typeof window.utils

  const treeFacade = {
    applyCreate: vi.fn(),
    applyDelete: vi.fn(),
    getFlattenIndexByPath: vi.fn().mockReturnValue(2),
    getRootTreeViewModel: () => ({ path: "/root" }) as TreeViewModel,
    toTreeDto: (viewModel: TreeViewModel) => ({ ...viewModel }),
  } as unknown as TreeFacade

  const removeTab = vi.fn()
  const tabEditorFacade = {
    getTabEditorViewByPath: () => (options.openTabId === undefined ? undefined : { getId: () => options.openTabId }),
    removeTab,
  } as unknown as TabEditorFacade

  const edit = new CreateEdit(treeFacade, tabEditorFacade, "/root", "a.md", false)
  return { edit, treeFacade, deleteFiles, removeTab, syncTreeSessionFromRenderer }
}

describe("CreateEdit", () => {
  it("takes back the file and the tab it opened in", async () => {
    const { edit, deleteFiles, removeTab, treeFacade } = harness({ createdPath: "/root/a.md", openTabId: 7 })

    await edit.apply()
    await edit.revert()

    expect(deleteFiles).toHaveBeenCalledExactlyOnceWith(["/root/a.md"])
    expect(treeFacade.applyDelete).toHaveBeenCalledExactlyOnceWith([2])
    expect(removeTab).toHaveBeenCalledExactlyOnceWith(7)
  })

  // The tab used to be found by an id handed back after the open. Closing it by
  // hand first left that id pointing at nothing, and undo threw on the way to
  // saving the session — so the file was gone but the session still listed it.
  it("finishes the undo when that tab was already closed by hand", async () => {
    const { edit, removeTab, syncTreeSessionFromRenderer } = harness({ createdPath: "/root/a.md" })

    await edit.apply()
    await expect(edit.revert()).resolves.toBeUndefined()

    expect(removeTab).not.toHaveBeenCalled()
    // Twice: once for the create, once for the undo.
    expect(syncTreeSessionFromRenderer).toHaveBeenCalledTimes(2)
  })

  it("has nothing to take back when the create did not land", async () => {
    const { edit, deleteFiles } = harness({ createdPath: null })

    await edit.apply()
    await edit.revert()

    expect(deleteFiles).not.toHaveBeenCalled()
  })
})
