/**
 * A file-system change that can be taken back.
 *
 * This is the layer that lives on the undo stack, and it is deliberately not
 * called a command: `commands/` holds the other sense of the word — the ~53
 * things a user can invoke, each an `{ id, when, run }` in the registry. Only
 * four of those end up editing the file system, and only those four need to be
 * able to run backwards.
 *
 * An edit is created inside the run() that needs it, applied once, and kept only
 * so it can be reverted. Both directions run under the watcher skip, which is
 * `TreeController`'s to hold — see `_applyEdit` / `_revertEdit`.
 *
 * Both directions re-resolve what they act on rather than trusting what they
 * captured: an edit waits its turn in the command queue, and the tree can move
 * underneath it while it waits.
 */
export interface UndoableEdit {
  apply(): Promise<void>
  revert(): Promise<void>
}
