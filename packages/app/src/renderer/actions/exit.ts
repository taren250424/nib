import { TabEditorFacade } from "@renderer/modules/tab_editor/TabEditorFacade"
import { TreeFacade } from "@renderer/modules/tree/TreeFacade"
import type { TabEditorsDto } from "@shared/dto/TabEditorDto"

export function exit(tabEditorFacade: TabEditorFacade, treeFacade: TreeFacade) {
  const tabEditorsDto: TabEditorsDto = tabEditorFacade.getTabEditorsDto()
  const treeViewModel = treeFacade.getRootTreeViewModel()
  const treeSessionData = treeFacade.toTreeDto(treeViewModel)
  window.rendererToMain.exit(tabEditorsDto, treeSessionData)
}
