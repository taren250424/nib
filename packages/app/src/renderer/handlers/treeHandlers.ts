import "@milkdown/theme-nord/style.css"
import { TreeFacade } from "../modules"
import { DOM, CUSTOM_EVENTS } from "../constants"
import { Dispatcher } from "@renderer/dispatch"
import type { AppEvents } from "@renderer/dispatch"
import { EventEmitter } from "events"

export function handleTree(dispatcher: Dispatcher, emitter: EventEmitter, treeFacade: TreeFacade) {
	bindMousedownEvents(emitter, treeFacade)

	bindTreeTopMenuEvents(dispatcher, treeFacade)

	bindContainerClickEvent(dispatcher, treeFacade)

	bindContextmenuToggleEvents(emitter, treeFacade)
	bindContextmenuClickEvents(dispatcher, treeFacade)

	bindMousedownEventsForDrag(emitter, treeFacade)
	bindMousemoveEventsForDrag(emitter, treeFacade)
	bindMouseupEventsForDrag(dispatcher, emitter, treeFacade)
	bindMouseleaveEventsForDrag(emitter, treeFacade)
}

function bindMousedownEvents(emitter: EventEmitter, treeFacade: TreeFacade) {
	const {
		treeNodeContainer,
		treeTop,
	} = treeFacade.renderer.elements

	treeNodeContainer.addEventListener("mousedown", () => {
		treeFacade.blur(treeFacade.lastSelectedIndex)
		treeFacade.blur(treeFacade.contextTreeIndex)
	})

	treeTop.addEventListener("mousedown", () => {
		treeFacade.blur(treeFacade.lastSelectedIndex)
		treeFacade.blur(treeFacade.contextTreeIndex)
	})

	emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.OUT.SIDE, (e) => {
		const target = e.target as HTMLElement
		const isInTreeContextMenu = !!target.closest(DOM.SELECTOR_TREE_CONTEXT_MENU)
		if (!isInTreeContextMenu) {
			// out of tree system.
			treeFacade.blur(treeFacade.contextTreeIndex)
			treeFacade.blur(treeFacade.lastSelectedIndex)
		}
	})
}

//

function bindTreeTopMenuEvents(dispatcher: Dispatcher, treeFacade: TreeFacade) {
	const { treeTopAddFile, treeTopAddDirectory } = treeFacade.renderer.elements

	treeTopAddFile.addEventListener("click", async () => {
		await dispatcher.dispatch("create", "element", false)
	})

	treeTopAddDirectory.addEventListener("click", async () => {
		await dispatcher.dispatch("create", "element", true)
	})
}

//

function bindContainerClickEvent(dispatcher: Dispatcher, treeFacade: TreeFacade) {
	const { treeNodeContainer } = treeFacade.renderer.elements

	treeNodeContainer.addEventListener("click", async (e) => {
		const target = e.target as HTMLElement
		const el = target.closest(`${DOM.SELECTOR_TREE_NODE}, ${DOM.SELECTOR_TREE_NODE_CONTAINER}`)! as HTMLElement

		if (el.matches(DOM.SELECTOR_TREE_NODE_CONTAINER)) _processContainer()
		else await _processNode(e, el)
	})

	function _processContainer() {
		treeNodeContainer.classList.add(DOM.CLASS_FOCUSED)
		treeFacade.clearTreeSelected()
		treeFacade.lastSelectedIndex = 0
	}

	async function _processNode(e: MouseEvent, treeNode: HTMLElement, ) {
		treeNode.classList.add(DOM.CLASS_FOCUSED)
		const path = treeNode.dataset[DOM.DATASET_ATTR_TREE_PATH]!

		if (e.shiftKey && treeFacade.lastSelectedIndex > 0) {
			const startIndex = treeFacade.lastSelectedIndex
			const endIndex = treeFacade.getFlattenIndexByPath(path)
			treeFacade.setLastSelectedIndexByPath(path)

			const [start, end] = [startIndex, endIndex].sort((a, b) => a - b)
			for (let i = start; i <= end; i++) {
				treeFacade.addSelectedIndices(i)
				treeFacade.getTreeNodeByIndex(i).classList.add(DOM.CLASS_SELECTED)
			}

		} else if (e.ctrlKey) {
			treeNode.classList.add(DOM.CLASS_SELECTED)

			treeFacade.setLastSelectedIndexByPath(path)

			const index = treeFacade.getFlattenIndexByPath(path)
			treeFacade.addSelectedIndices(index)

		} else {
			treeFacade.clearTreeSelected()
			treeNode.classList.add(DOM.CLASS_SELECTED)

			const viewModel = treeFacade.getTreeViewModelByPath(path)
			if (!viewModel) return
			if (viewModel.directory) await dispatcher.dispatch("openDirectoryByTreeNode", "element", treeNode)
			else await dispatcher.dispatch("openFile", "element", path)

			// The node may have been deleted while the open waited in the command queue.
			const index = treeFacade.getFlattenIndexByPath(path)
			if (index === undefined) return

			treeFacade.setLastSelectedIndexByPath(path)
			treeFacade.addSelectedIndices(index)
		}
	}
}

//

function bindContextmenuToggleEvents(emitter: EventEmitter, treeFacade: TreeFacade) {
	const { treeNodeContainer } = treeFacade.renderer.elements

	treeNodeContainer.addEventListener("contextmenu", (e) => {
		treeFacade.handleShowContextmenu(e)
	})

	emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.OUT.TREE_CONTEXTMENU, () => {
		treeFacade.handleHideContextmenu()
	})
}

function bindContextmenuClickEvents(dispatcher: Dispatcher, treeFacade: TreeFacade) {
	const { treeContextCut, treeContextCopy, treeContextPaste, treeContextRename, treeContextDelete } =
		treeFacade.renderer.elements

	// Closing happens after the command, not before, because paste reads the
	// right-clicked index and closing clears it. A failed command still closes.
	const bindItem = (element: HTMLElement, event: AppEvents) => {
		element.addEventListener("click", async () => {
			try {
				await dispatcher.dispatch(event, "context-menu")
			} catch (err) {
				console.error(`[treeHandlers] ${event} from the context menu failed:`, err)
			} finally {
				treeFacade.handleHideContextmenu()
			}
		})
	}

	bindItem(treeContextCut, "cut")
	bindItem(treeContextCopy, "copy")
	bindItem(treeContextPaste, "paste")
	bindItem(treeContextRename, "rename")
	bindItem(treeContextDelete, "delete")
}

//

//

function bindMousedownEventsForDrag(emitter: EventEmitter, treeFacade: TreeFacade) {
	emitter.on(CUSTOM_EVENTS.MOUSE_DOWN.DEFAULT, (e) => {
		const target = e.target as HTMLElement
		const node = target.closest(DOM.SELECTOR_TREE_NODE) as HTMLElement
		if (!node) return

		let count = treeFacade.getSelectedIndices().length
		if (count === 0) {
			const path = node.dataset[DOM.DATASET_ATTR_TREE_PATH]!
			const idx = treeFacade.getFlattenIndexByPath(path)!
			treeFacade.lastSelectedIndex = idx
			treeFacade.addSelectedIndices(idx)
			count = 1
		}

		treeFacade.initDrag(count, e.clientX, e.clientY)
	})
}

function bindMousemoveEventsForDrag(emitter: EventEmitter, treeFacade: TreeFacade) {
	emitter.on(CUSTOM_EVENTS.MOUSE_MOVE.DEFAULT, (e) => {
		if (!treeFacade.isMouseDown()) return

		if (!treeFacade.isDrag()) {
			const { x, y } = treeFacade.getStartPosition()
			if (Math.abs(e.clientX - x) > 5 || Math.abs(e.clientY - y) > 5) {
				treeFacade.startDrag()
			} else {
				return
			}
		}

		treeFacade.moveGhost(e.clientX, e.clientY)
		treeFacade.updateDragOverStatus(e.target)
	})
}

function bindMouseupEventsForDrag(dispatcher: Dispatcher, emitter: EventEmitter, treeFacade: TreeFacade) {
	// EventEmitter neither awaits nor catches async listeners, so the drop has to
	// terminate its own promise or a failing move becomes an unhandled rejection.
	emitter.on(CUSTOM_EVENTS.MOUSE_UP.DEFAULT, () => {
		dropDraggedTreeNodes(dispatcher, treeFacade).catch((err) => {
			console.error("[treeHandlers] drag drop failed:", err)
		})
	})
}

async function dropDraggedTreeNodes(dispatcher: Dispatcher, treeFacade: TreeFacade) {
	if (!treeFacade.isDrag()) {
		treeFacade.setMouseDown(false)
		return
	}

	const dropPath = treeFacade.getInsertPath()
	const canDrop = dropPath !== ""

	treeFacade.clearDrag()

	if (canDrop) {
		treeFacade.setSelectedDragIndexByPath(dropPath)
		await dispatcher.dispatch("cut", "drag")
		await dispatcher.dispatch("paste", "drag")
	}
}

function bindMouseleaveEventsForDrag(emitter: EventEmitter, treeFacade: TreeFacade) {
	emitter.on(CUSTOM_EVENTS.MOUSE_LEAVE.DEFAULT, () => {
		if (treeFacade.isDrag()) {
			treeFacade.clearDrag()
		}
	})
}
