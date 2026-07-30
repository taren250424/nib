import { injectable } from "inversify"

import { assert } from "../utils"

/**
 * Serial command queue for all tree/tab mutating work.
 *
 * User commands (create/rename/delete/paste/cut, undo/redo, tab close) and
 * watcher sync (syncFromWatch) share the same mutable state (flattenTree,
 * pathToFlattenTreeIndex, DOM, session files). Running them through a single
 * serial queue guarantees that a command's capture -> await -> apply sequence
 * can never interleave with another mutation.
 *
 * A queued task must not enqueue: the new task waits behind the one asking for
 * it, so awaiting it wedges the chain for good. Work that has to happen outside
 * the queue belongs at the entry of the public perform*, before it enqueues.
 */
@injectable()
export class CommandQueue {
  private tail: Promise<unknown> = Promise.resolve()

  // True only while a task's synchronous part runs. Holding it for the task's
  // whole duration would be wrong: a command awaits IPC, and anything the user
  // does in the meantime enqueues legitimately from outside the queue.
  private entering = false

  /**
   * Runs `task` after all previously enqueued tasks settle.
   * A rejection propagates to the caller of enqueue() but never breaks the chain.
   */
  enqueue<T>(task: () => T | Promise<T>): Promise<T> {
    assert(
      !this.entering,
      "CommandQueue: a queued task called enqueue. It would wait behind the task asking for it, " +
        "so awaiting it deadlocks the queue. Do this before enqueueing, in the public perform*."
    )

    const run = this.tail.then(() => {
      this.entering = true
      try {
        return task()
      } finally {
        // Cleared as soon as the task hands back its promise, which is where the
        // window this can speak for ends.
        this.entering = false
      }
    })

    this.tail = run.then(
      () => undefined,
      () => undefined
    )
    return run
  }
}
