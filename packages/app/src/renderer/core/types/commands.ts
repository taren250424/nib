import type { ContextKeyMap } from "./context_keys"

/** What a `when` condition is evaluated against. */
export type CommandContext = Readonly<ContextKeyMap>

export type ICommandDescriptor = {
  id: string

  /**
   * Gate on the current context. Absent means the command always applies.
   *
   * This answers two questions with one expression: may the command run, and
   * should the UI offering it look enabled. It is not a guarantee — commands
   * queue, so state can still move between the check and the work, and
   * apply-time revalidation inside the command stays necessary.
   */
  when?: (context: CommandContext) => boolean

  run: (...args: any[]) => void | Promise<void>
}
