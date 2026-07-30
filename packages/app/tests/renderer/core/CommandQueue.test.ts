import { describe, expect, it } from "vitest"

import { CommandQueue } from "@renderer/core/CommandQueue"

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("CommandQueue", () => {
  it("does not start a task before the previous one settles", async () => {
    const queue = new CommandQueue()
    const first = deferred<void>()
    const order: string[] = []

    const firstRun = queue.enqueue(async () => {
      order.push("first:start")
      await first.promise
      order.push("first:end")
    })
    const secondRun = queue.enqueue(() => {
      order.push("second")
    })

    // The second task must still be waiting while the first is in flight.
    await Promise.resolve()
    expect(order).toEqual(["first:start"])

    first.resolve()
    await Promise.all([firstRun, secondRun])
    expect(order).toEqual(["first:start", "first:end", "second"])
  })

  it("preserves enqueue order across many tasks", async () => {
    const queue = new CommandQueue()
    const order: number[] = []

    const runs = [0, 1, 2, 3, 4].map((i) =>
      queue.enqueue(async () => {
        // Yield so an unserialized queue would interleave here.
        await Promise.resolve()
        order.push(i)
      })
    )

    await Promise.all(runs)
    expect(order).toEqual([0, 1, 2, 3, 4])
  })

  // Watcher sync shares this queue with user commands: one failure must not
  // wedge every later mutation.
  it("reports a rejection to its own caller without breaking the chain", async () => {
    const queue = new CommandQueue()
    const order: string[] = []

    const failing = queue.enqueue(async () => {
      throw new Error("boom")
    })
    const following = queue.enqueue(() => {
      order.push("ran")
      return "ok"
    })

    await expect(failing).rejects.toThrow("boom")
    await expect(following).resolves.toBe("ok")
    expect(order).toEqual(["ran"])
  })

  it("returns the task's value to the caller", async () => {
    const queue = new CommandQueue()
    await expect(queue.enqueue(() => 42)).resolves.toBe(42)
    await expect(queue.enqueue(async () => "async")).resolves.toBe("async")
  })

  // The convention this pins used to live only in a comment: a task that
  // enqueues waits behind itself, and awaiting that never returns.
  it("refuses a task that enqueues from inside the queue", async () => {
    const queue = new CommandQueue()

    await expect(queue.enqueue(() => queue.enqueue(() => "inner"))).rejects.toThrow(/deadlock/)
  })

  // The other half of the rule: a command awaits IPC for most of its life, and
  // whatever the user does meanwhile enqueues from outside the queue.
  it("still accepts work enqueued while a task is merely in flight", async () => {
    const queue = new CommandQueue()
    const first = deferred<void>()

    const firstRun = queue.enqueue(() => first.promise)
    // Let the first task start and hand back its promise.
    await Promise.resolve()

    const secondRun = queue.enqueue(() => "second")
    first.resolve()

    await expect(firstRun).resolves.toBeUndefined()
    await expect(secondRun).resolves.toBe("second")
  })
})
