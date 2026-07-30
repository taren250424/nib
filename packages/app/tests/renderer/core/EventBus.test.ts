import { describe, expect, it, vi } from "vitest"

import { EventBus } from "@renderer/core/EventBus"

type TestEvents = {
  moved: { x: number; y: number }
  closed: string
}

describe("EventBus", () => {
  it("hands the payload to the listeners of that event only", () => {
    const bus = new EventBus<TestEvents>()
    const onMoved = vi.fn()
    const onClosed = vi.fn()

    bus.on("moved", onMoved)
    bus.on("closed", onClosed)
    bus.emit("moved", { x: 1, y: 2 })

    expect(onMoved).toHaveBeenCalledExactlyOnceWith({ x: 1, y: 2 })
    expect(onClosed).not.toHaveBeenCalled()
  })

  it("calls every listener of an event", () => {
    const bus = new EventBus<TestEvents>()
    const first = vi.fn()
    const second = vi.fn()

    bus.on("closed", first)
    bus.on("closed", second)
    bus.emit("closed", "why")

    expect(first).toHaveBeenCalledExactlyOnceWith("why")
    expect(second).toHaveBeenCalledExactlyOnceWith("why")
  })

  it("does nothing for an event nobody subscribed to", () => {
    const bus = new EventBus<TestEvents>()

    expect(() => bus.emit("moved", { x: 0, y: 0 })).not.toThrow()
  })

  it("stops notifying once unsubscribed", () => {
    const bus = new EventBus<TestEvents>()
    const listener = vi.fn()

    const unsubscribe = bus.on("closed", listener)
    unsubscribe()
    bus.emit("closed", "why")

    expect(listener).not.toHaveBeenCalled()
  })

  it("registers a listener once, so unsubscribing it removes it", () => {
    const bus = new EventBus<TestEvents>()
    const listener = vi.fn()

    bus.on("closed", listener)
    const unsubscribe = bus.on("closed", listener)
    unsubscribe()
    bus.emit("closed", "why")

    expect(listener).not.toHaveBeenCalled()
  })

  // A drag listener clears itself on mouseup while its siblings are still to be
  // called; iterating the live set would skip one of them.
  it("finishes the round a listener started even if it unsubscribes mid-emit", () => {
    const bus = new EventBus<TestEvents>()
    const second = vi.fn()

    const unsubscribe = bus.on("closed", () => unsubscribe())
    bus.on("closed", second)
    bus.emit("closed", "why")

    expect(second).toHaveBeenCalledOnce()
  })

  it("does not deliver to a listener added during the emit that is running", () => {
    const bus = new EventBus<TestEvents>()
    const late = vi.fn()

    bus.on("closed", () => bus.on("closed", late))
    bus.emit("closed", "why")

    expect(late).not.toHaveBeenCalled()
  })
})
