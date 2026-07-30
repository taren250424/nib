import { vi } from "vitest"

import type { TreeDto } from "@shared/dto/TreeDto"
import type ClipboardMode from "@shared/types/ClipboardMode"

import { CommandQueue, ContextKeyService, FocusManager } from "@renderer/core"
import { CommandManager } from "@renderer/modules/CommandManager"
import type { SettingsFacade } from "@renderer/modules/settings/SettingsFacade"

import { buildFacadeHarness, TAB_EDITOR_MARKUP } from "./tab_editor/facadeHarness"
import { buildTreeHarness, installWindowUtils, TREE_MARKUP } from "./tree/treeHarness"

export type CommandHarness = ReturnType<typeof createCommandHarness>

/**
 * The real CommandManager over a real tree and real tabs, minus the DI container.
 *
 * Its rules about what a transfer may do — a folder not going inside itself, a
 * paste that moved nothing not taking an undo step, a drop leaving the clipboard
 * where it was — could only be checked by hand until now, because they live
 * between two facades and the queue rather than inside any one of them.
 */
export function createCommandHarness() {
  document.body.innerHTML = TREE_MARKUP + TAB_EDITOR_MARKUP
  installWindowUtils()

  const ipc = installTreeIpcStub()

  // One service for both facades and the manager, as the container gives them.
  const contextKeyService = new ContextKeyService()
  const tree = buildTreeHarness(contextKeyService)
  const tabEditor = buildFacadeHarness(contextKeyService)

  const focusManager = new FocusManager()
  const commandQueue = new CommandQueue()

  // Only the settings dialog and the settings session go through this, and
  // nothing here opens either.
  const settingsFacade = {} as SettingsFacade

  const commandManager = new CommandManager(
    focusManager,
    contextKeyService,
    settingsFacade,
    tabEditor.facade,
    tree.facade,
    commandQueue
  )

  return { commandManager, tree, tabEditor, contextKeyService, focusManager, commandQueue, ipc }
}

/**
 * The main-process side of a tree transfer.
 *
 * `pasteTree` answers with the paths it created, and drops the sources that
 * already live in the target directory — the same filter TreeService.paste
 * applies, and the reason a paste can succeed having moved nothing.
 */
function installTreeIpcStub() {
  const pasteTree = vi.fn(async (target: TreeDto, selected: TreeDto[], mode: ClipboardMode) => {
    const moved =
      mode === "cut" ? selected.filter((dto) => window.utils.getDirName(dto.path) !== target.path) : selected

    return { result: true, data: moved.map((dto) => `${target.path}/${dto.name}`) }
  })

  const stub = {
    pasteTree,
    setWatchSkipState: vi.fn().mockResolvedValue(undefined),
    showWarning: vi.fn().mockResolvedValue(undefined),
    syncTreeSessionFromRenderer: vi.fn().mockResolvedValue(true),
    copyTree: vi.fn().mockResolvedValue({ result: true }),
    deletePermanently: vi.fn().mockResolvedValue({ result: true }),
  }

  window.rendererToMain = { ...window.rendererToMain, ...stub } as unknown as typeof window.rendererToMain

  return stub
}
