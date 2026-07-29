import { injectable } from "inversify"

/**
 * Serial command queue for all tree/tab mutating work.
 *
 * User commands (create/rename/delete/paste/cut, undo/redo, tab close) and
 * watcher sync (syncFromWatch) share the same mutable state (flattenTree,
 * pathToFlattenTreeIndex, DOM, session files). Running them through a single
 * serial queue guarantees that a command's capture -> await -> apply sequence
 * can never interleave with another mutation.
 */
@injectable()
export class CommandQueue {
  private tail: Promise<unknown> = Promise.resolve()

  /**
   * Runs `task` after all previously enqueued tasks settle.
   * A rejection propagates to the caller of enqueue() but never breaks the chain.
   */
  enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    const run = this.tail.then(task)
    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}
