import { injectable } from "inversify"

import { EventBus } from "./EventBus"
import { DEFAULT_CONTEXT_KEYS, type ContextKey, type ContextKeyMap } from "./types"

type ChangeListener = (changed: ReadonlySet<ContextKey>) => void

/**
 * Holds the state that command `when` conditions read, and tells subscribers
 * when it moves.
 *
 * Values are pushed in by whoever owns them rather than pulled on demand: a
 * `when` has to answer both "may this run" at dispatch time and "should this
 * menu item look enabled" while nothing is happening, and only a push model can
 * do the second.
 *
 * A `when` is a gate, not a guarantee. Commands wait in a serial queue, so state
 * can still change between the check and the work; apply-time revalidation
 * inside the command stays necessary.
 */
@injectable()
export class ContextKeyService {
  private readonly values: ContextKeyMap = { ...DEFAULT_CONTEXT_KEYS }

  // Fan-out goes through EventBus rather than a hand-rolled Set, so its tested
  // guarantees (a listener may unsubscribe mid-notify) hold here too.
  private readonly bus = new EventBus<{ didChange: ReadonlySet<ContextKey> }>()

  // One snapshot per state, not per question: a menu repaint asks isEnabled
  // for every row and candidate, and each asked for a fresh copy of a map
  // that had not moved.
  private cachedSnapshot: Readonly<ContextKeyMap> | null = null

  get<K extends ContextKey>(key: K): ContextKeyMap[K] {
    return this.values[key]
  }

  set<K extends ContextKey>(key: K, value: ContextKeyMap[K]) {
    this.update({ [key]: value } as Partial<ContextKeyMap>)
  }

  /** Applies several keys at once so subscribers repaint once rather than per key. */
  update(values: Partial<ContextKeyMap>) {
    const changed = new Set<ContextKey>()

    for (const [key, value] of Object.entries(values) as [ContextKey, ContextKeyMap[ContextKey]][]) {
      if (this.values[key] === value) continue
      this.values[key] = value as never
      changed.add(key)
    }

    if (changed.size === 0) return
    this.cachedSnapshot = null
    this.bus.emit("didChange", changed)
  }

  /** Subscribes to context changes. Returns the unsubscribe function. */
  onDidChange(listener: ChangeListener): () => void {
    return this.bus.on("didChange", listener)
  }

  snapshot(): Readonly<ContextKeyMap> {
    // Frozen so the sharing is safe: every caller reads the same object, and
    // a write to it would otherwise leak into every other reader's answer.
    return (this.cachedSnapshot ??= Object.freeze({ ...this.values }))
  }
}
