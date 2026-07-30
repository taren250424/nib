import type { ZoneId } from "./ui_zones"

/** The event name a zone hears when a mousedown lands anywhere but inside it. */
type MouseDownOutside<Z extends ZoneId> = `mousedown-out:${Z}`

/**
 * What each mouse bus event carries.
 *
 * Every payload is the raw DOM event: the bus fans one document-level listener
 * out to the modules that care, it does not reshape what the browser gave us.
 */
export type MouseBusEvents = {
  mousedown: MouseEvent
  mousemove: MouseEvent
  mouseup: MouseEvent
  mouseleave: MouseEvent
} & {
  // One per zone, derived rather than declared — a zone used to carry its own
  // event name alongside its id, and the two had to be kept in step by hand.
  [Z in ZoneId as MouseDownOutside<Z>]: MouseEvent
}

export const MOUSE_EVENTS = {
  DOWN: "mousedown",
  MOVE: "mousemove",
  UP: "mouseup",
  LEAVE: "mouseleave",
} as const

/** What "click away to close" subscribes to. */
export function mouseDownOutside<Z extends ZoneId>(zone: Z): MouseDownOutside<Z> {
  return `mousedown-out:${zone}`
}
