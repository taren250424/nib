export default interface IFileWatcher {
  watch(dirPath: string): Promise<void>
  /** Acquire (true) / release (false) a skip hold. Holds are counted, not toggled. */
  setSkipState(state: boolean): void
  close(): Promise<void>
}
