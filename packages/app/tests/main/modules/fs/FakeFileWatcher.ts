import type IFileWatcher from "@main/modules/contracts/IFileWatcher"

export default class FakeFileWatcher implements IFileWatcher {
  setSkipState(_: boolean): void {
    // no-op
  }

  async watch(_: string): Promise<void> {
    // no-op
  }

  async close(): Promise<void> {
    // no-op
  }
}
