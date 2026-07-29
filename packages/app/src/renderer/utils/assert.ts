const __DEV__ = import.meta.env.DEV

export function assert(condition: any, message: string): asserts condition {
  if (__DEV__ && !condition) throw new Error(message)
}
