import type { MenuElements, InfoFacade } from "@renderer/modules"

export function handleHelpMenu(menuElements: MenuElements, infoFacade: InfoFacade) {
	bindMenuEvents(menuElements, infoFacade)
}

function bindMenuEvents(menuElements: MenuElements, infoFacade: InfoFacade) {
	const { information } = menuElements

	information.addEventListener("click", async () => {
		infoFacade.showInformation()
	})
}
