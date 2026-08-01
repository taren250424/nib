import { vi } from "vitest"

import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto, TreePartialUpdate } from "@shared/dto/TreeDto"
import type ClipboardMode from "@shared/types/ClipboardMode"

import { CommandQueue, ContextKeyService, FocusManager } from "@renderer/core"
import { handleSync } from "@renderer/handlers/syncHandlers"
import { CommandManager } from "@renderer/modules/CommandManager"
import { SettingsElements } from "@renderer/modules/settings/SettingsElements"
import { SettingsFacade } from "@renderer/modules/settings/SettingsFacade"
import { SettingsRenderer } from "@renderer/modules/settings/SettingsRenderer"
import { SettingsStore } from "@renderer/modules/settings/SettingsStore"

import { SETTINGS_MARKUP } from "./settings/settingsMarkup"
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
  document.body.innerHTML = TREE_MARKUP + TAB_EDITOR_MARKUP + SETTINGS_MARKUP
  installWindowUtils()

  const ipc = installTreeIpcStub()
  const watch = installWatchStub()

  // One service for both facades and the manager, as the container gives them.
  const contextKeyService = new ContextKeyService()
  const tree = buildTreeHarness(contextKeyService)
  const tabEditor = buildFacadeHarness(contextKeyService)

  const focusManager = new FocusManager()
  const commandQueue = new CommandQueue()

  const settingsFacade = new SettingsFacade(new SettingsRenderer(new SettingsElements()), new SettingsStore())

  const commandManager = new CommandManager(
    focusManager,
    contextKeyService,
    settingsFacade,
    tabEditor.facade,
    tree.facade,
    commandQueue
  )

  // The watcher shares the queue with every command, which is the whole point
  // of it, so the real wiring is registered rather than imitated.
  handleSync(commandQueue, tabEditor.facade, tree.facade, commandManager)

  return {
    commandManager,
    tree,
    tabEditor,
    settingsFacade,
    contextKeyService,
    focusManager,
    commandQueue,
    ipc,
    fireWatchSync: watch.fire,
  }
}

/**
 * Stands in for the preload bridge the watcher arrives over.
 *
 * `syncFromWatch` hands Main a callback; this keeps hold of it so a test can be
 * the watcher. The returned promise is the queued work, so it can be awaited.
 */
function installWatchStub() {
  let handler: ((tabs: TabEditorsDto | null, tree: TreeDto | null, partials?: TreePartialUpdate[]) => unknown) | null =
    null

  window.mainToRenderer = {
    ...window.mainToRenderer,
    syncFromWatch: (callback: typeof handler) => {
      handler = callback
    },
  } as unknown as typeof window.mainToRenderer

  return {
    fire: (tabs: TabEditorsDto | null, tree: TreeDto | null, partials?: TreePartialUpdate[]) => {
      if (!handler) throw new Error("handleSync never registered a callback")
      return handler(tabs, tree, partials) as Promise<void>
    },
  }
}

/**
 * The main-process side of the tree commands, answering the way Main does.
 *
 * `pasteTree` drops the sources that already live in the target directory — the
 * same filter TreeService.paste applies, and the reason a paste can succeed
 * having moved nothing. `create` and `rename` echo the path they were asked for,
 * which is Main's answer whenever the name is free.
 */
function installTreeIpcStub() {
  const pasteTree = vi.fn(async (target: TreeDto, selected: TreeDto[], mode: ClipboardMode) => {
    const moved =
      mode === "cut" ? selected.filter((dto) => window.utils.getDirName(dto.path) !== target.path) : selected

    return { result: true, data: moved.map((dto) => `${target.path}/${dto.name}`) }
  })

  // Main hands out the tab ids, so they have to keep climbing across one run.
  let nextTabId = 100
  const openFile = vi.fn(async (filePath: string) => ({
    result: true,
    data: {
      id: nextTabId++,
      isModified: false,
      filePath,
      fileName: window.utils.getBaseName(filePath),
      content: "",
      isBinary: false,
    },
  }))

  const stub = {
    pasteTree,
    openFile,
    create: vi.fn(async (path: string) => ({ result: true, data: path })),
    rename: vi.fn(async (_from: string, to: string) => ({ result: true, data: to })),
    delete: vi.fn(async (paths: string[]) => ({ result: true, data: paths.map((path) => ({ path })) })),
    undo_delete: vi.fn().mockResolvedValue(true),
    setWatchSkipState: vi.fn().mockResolvedValue(undefined),
    showWarning: vi.fn().mockResolvedValue(undefined),
    syncTreeSessionFromRenderer: vi.fn().mockResolvedValue(true),
    copyTree: vi.fn().mockResolvedValue({ result: true }),
    syncSettingsSessionFromRenderer: vi.fn().mockResolvedValue(true),
    deletePermanently: vi.fn().mockResolvedValue({ result: true }),
  }

  window.rendererToMain = { ...window.rendererToMain, ...stub } as unknown as typeof window.rendererToMain

  return stub
}
