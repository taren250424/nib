import { inject, injectable } from "inversify"

import type { UndoableEdit } from "../../edits"

import { DI } from "../../constants"
import { ContextKeyService } from "../../core"

/**
 * The tree's undo/redo stacks, and nothing else. The stacks own their
 * invariants — a new edit invalidates the redo branch, a failed replay is
 * dropped rather than left to poison the stack — while running an edit
 * forwards or backwards stays with the caller, because the watcher mute that
 * has to wrap it does too.
 */
@injectable()
export class TreeHistory {
  private undoStack: UndoableEdit[] = []
  private redoStack: UndoableEdit[] = []

  constructor(@inject(DI.ContextKeyService) private readonly contextKeyService: ContextKeyService) {}

  /**
   * Records an edit that can be undone. A new edit invalidates the redo branch,
   * exactly as every other editor does.
   */
  record(edit: UndoableEdit) {
    this.undoStack.push(edit)
    this.redoStack.length = 0
    this._publish()
  }

  /** Takes one step back. `revert` is how the caller runs an edit backwards. */
  async undo(revert: (edit: UndoableEdit) => Promise<void>) {
    const edit = this.undoStack.pop()
    if (!edit) return

    try {
      await revert(edit)
      this.redoStack.push(edit)
    } catch (err) {
      // Undo failed (e.g., parent copied into child, or src/dest no longer exists).
      // OS/File system may have ignored the operation; we just skip it to avoid breaking the stack.
      console.error("[TreeHistory] undo(tree) failed:", err)
    }

    // The pop already happened, so the context has moved whether or not the
    // undo itself succeeded.
    this._publish()
  }

  /** Takes the step forward again. `apply` is how the caller runs an edit. */
  async redo(apply: (edit: UndoableEdit) => Promise<void>) {
    const edit = this.redoStack.pop()
    if (!edit) return

    try {
      await apply(edit)
      this.undoStack.push(edit)
    } catch (err) {
      console.error("[TreeHistory] redo(tree) failed:", err)
    }

    this._publish()
  }

  /**
   * Drops both stacks. For when the tree they describe is gone: the edits hold
   * absolute paths into the outgoing root, so replaying one would mutate a
   * directory the tree no longer shows. Safe inside a queued task — it never
   * enqueues — which is how the watcher's full resync calls it.
   */
  clear() {
    this.undoStack.length = 0
    this.redoStack.length = 0
    this._publish()
  }

  private _publish() {
    this.contextKeyService.update({
      canUndoTree: this.undoStack.length > 0,
      canRedoTree: this.redoStack.length > 0,
    })
  }
}
