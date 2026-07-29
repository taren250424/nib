import type { CommandQueue } from "@renderer/core"
import type { TabEditorFacade, TreeFacade } from "@renderer/modules"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"
import type { TreeDto, TreePartialUpdate } from "@shared/dto/TreeDto"

export function handleSync(commandQueue: CommandQueue, tabEditorFacade: TabEditorFacade, treeFacade: TreeFacade) {
  window.mainToRenderer.syncFromWatch(
    (tabEditorsDto: TabEditorsDto, treeDto: TreeDto, partialUpdates?: TreePartialUpdate[]) =>
      // Watcher sync mutates the same state as user commands, so it must run
      // on the same serial queue — never in the middle of a command.
      commandQueue
        .enqueue(async () => {
          if (tabEditorsDto) {
            await tabEditorFacade.syncTabs(tabEditorsDto)
          }

          if (partialUpdates) {
            for (const update of partialUpdates) {
              if (update.type === "add") {
                const parentPath = window.utils.getDirName(update.path)
                treeFacade.applyCreate(parentPath, update.path, update.isDirectory)
              } else if (update.type === "remove") {
                const idx = treeFacade.getFlattenIndexByPath(update.path)
                if (idx !== undefined) {
                  treeFacade.applyDelete([idx])
                }
              }
            }

            // After partial updates, sync the updated state back to Main
            // to keep the session file in sync with what the renderer is showing.
            const viewModel = treeFacade.getRootTreeViewModel()
            const currentTreeDto = treeFacade.toTreeDto(viewModel)
            await window.rendererToMain.syncTreeSessionFromRenderer(currentTreeDto)
          } else if (treeDto) {
            const viewModel = treeFacade.toTreeViewModel(treeDto)

            // Cleared before the render, not after: the renderer paints each
            // node's selected/cut marks from this state, and paths from the
            // outgoing tree would mark same-named nodes of the incoming one.
            treeFacade.clearSelection()
            treeFacade.clearClipboard()

            treeFacade.render(viewModel)
            treeFacade.setRootTreeViewModel(viewModel)
          }
        })
        .catch((err) => {
          console.error("[syncHandlers] syncFromWatch failed:", err)
        })
  )
}
