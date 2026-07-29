import { injectable } from "inversify"
import { type Zone, type Task, UI_ZONES_VALUES } from "./types"

@injectable()
export class FocusManager {
	private focusedZone: Zone = "none"
	private focusedTask: Task = "none"

	// getFocusedTask() derives from the DOM on every call, so nothing can tell when
	// the answer changes. Anything that renders from focus — menu enablement, the
	// tree's active/inactive selection — needs to be told instead of polling.
	private readonly listeners = new Set<(task: Task) => void>()
	private notifiedTask: Task = "none"

	setFocusedZone(zone: Zone) {
		this.focusedZone = zone
	}

	getFocusedZone() {
		return this.focusedZone
	}

	setFocusedTask(task: Task) {
		this.focusedTask = task
	}

	getFocusedTask() {
		const el = document.activeElement
		if (!el) return this.focusedTask

		const activeItem = UI_ZONES_VALUES.find((item) => el.closest(item.dom))
		if (activeItem && activeItem.task !== "") return activeItem.task as Task

		return this.focusedTask
	}

	/** Subscribes to focus changes. Returns the unsubscribe function. */
	onDidChangeFocus(listener: (task: Task) => void): () => void {
		this.listeners.add(listener)
		return () => this.listeners.delete(listener)
	}

	/**
	 * Re-reads the focused task and notifies subscribers when it differs from the
	 * one they last saw. Safe to call on every focus event: focus moving within a
	 * zone, or out to the body, resolves to the same task and stays quiet.
	 */
	syncFocus() {
		const task = this.getFocusedTask()
		if (task === this.notifiedTask) return

		this.notifiedTask = task
		for (const listener of this.listeners) listener(task)
	}
}
