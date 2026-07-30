import { injectable } from "inversify"

import type { MouseBusEvents } from "./types"

type Listener<T> = (payload: T) => void

// Stored form of a listener. Parameters are contravariant, so a listener for
// any concrete payload is assignable to this and the cast lands in emit() only.
type StoredListener = (payload: never) => void

/**
 * A minimal typed publish/subscribe bus.
 *
 * Stands in for Node's EventEmitter, which the renderer reached through a
 * bundler polyfill of a dependency it never declared, and which hands every
 * listener an `any`. Keyed by an event map, so a listener's argument is the
 * payload its own event carries.
 */
export class EventBus<TEvents extends Record<string, unknown>> {
  private readonly listeners = new Map<keyof TEvents, Set<StoredListener>>()

  /** Subscribes to an event. Returns the unsubscribe function. */
  on<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>): () => void {
    let forEvent = this.listeners.get(event)
    if (!forEvent) {
      forEvent = new Set()
      this.listeners.set(event, forEvent)
    }

    forEvent.add(listener)
    return () => this.off(event, listener)
  }

  off<K extends keyof TEvents>(event: K, listener: Listener<TEvents[K]>) {
    this.listeners.get(event)?.delete(listener)
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]) {
    const forEvent = this.listeners.get(event)
    if (!forEvent) return

    // Copied first: a listener may unsubscribe itself, or another, while we run.
    for (const listener of [...forEvent]) (listener as Listener<TEvents[K]>)(payload)
  }
}

/**
 * The document-level mouse bus.
 *
 * Drag, resize and click-away are the only things on it — the input layer that
 * has no contact with the command system, so it stays a bus rather than
 * becoming a table of command ids.
 */
@injectable()
export class MouseEventBus extends EventBus<MouseBusEvents> {}
