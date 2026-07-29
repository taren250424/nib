import { CommandRegistry } from "../../core"
import { MenuElements } from "@renderer/modules"

export function handleViewMenu(commandRegistry: CommandRegistry, menuElements: MenuElements) {
	const { fileTree, zoomIn, zoomOut, zoomReset } = menuElements

	fileTree.addEventListener("click", () => commandRegistry.execute("view.toggleSide"))
	zoomIn.addEventListener("click", () => commandRegistry.execute("view.zoomIn"))
	zoomOut.addEventListener("click", () => commandRegistry.execute("view.zoomOut"))
	zoomReset.addEventListener("click", () => commandRegistry.execute("view.zoomReset"))
}
