import { inject, injectable } from "inversify"

import { DI } from "../constants"
import { assert } from "../utils"
import { ContextKeyService } from "./ContextKeyService"
import type { ICommandDescriptor } from "./types"

/**
 * The one place a command exists: an id, the context it applies in, and what it
 * does. Keyboard, menus and context menus all reach commands through here, so
 * "is this available" is answered the same way for all of them.
 */
@injectable()
export class CommandRegistry {
  private readonly commands = new Map<string, ICommandDescriptor>()

  constructor(@inject(DI.ContextKeyService) private readonly contextKeyService: ContextKeyService) {}

  register(descriptor: ICommandDescriptor) {
    // Two definitions of one id means one of them silently never runs, which is
    // exactly the failure the old duplicate shortcut registrations had.
    assert(!this.commands.has(descriptor.id), `Duplicate command id: ${descriptor.id}`)
    this.commands.set(descriptor.id, descriptor)
  }

  registerAll(descriptors: readonly ICommandDescriptor[]) {
    for (const descriptor of descriptors) this.register(descriptor)
  }

  get(id: string): ICommandDescriptor | undefined {
    return this.commands.get(id)
  }

  has(id: string): boolean {
    return this.commands.has(id)
  }

  ids(): string[] {
    return [...this.commands.keys()]
  }

  /** Whether the command exists and its `when` holds right now. */
  isEnabled(id: string): boolean {
    const descriptor = this.commands.get(id)
    if (!descriptor) return false
    if (!descriptor.when) return true

    return descriptor.when(this.contextKeyService.snapshot())
  }

  /**
   * The first of these commands that applies right now, or undefined if none do.
   *
   * One trigger often stands for several commands — Ctrl+X and Edit > Cut each
   * mean the tree's cut or the editor's depending on where focus is — and both
   * the keyboard and the menus need the same answer to which one that is.
   */
  firstEnabled(ids: readonly string[]): string | undefined {
    return ids.find((id) => this.isEnabled(id))
  }

  /**
   * Runs the command if it applies. A command whose `when` fails is not an
   * error: a key combination that means nothing in the focused zone has to fall
   * through quietly so the editor's native handling still sees it.
   */
  async execute(id: string, ...args: unknown[]): Promise<void> {
    const descriptor = this.commands.get(id)
    assert(descriptor, `Unknown command: ${id}`)
    if (!descriptor) return

    if (!this.isEnabled(id)) return

    await descriptor.run(...args)
  }
}
