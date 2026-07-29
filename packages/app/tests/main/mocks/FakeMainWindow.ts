import { vi } from "vitest"

export default class FakeMainWindow {
  webContents = {
    send: vi.fn(),
  }

  close = vi.fn()
  setBounds = vi.fn()
  maximize = vi.fn()
}
