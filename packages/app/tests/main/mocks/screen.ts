import { vi } from "vitest"

vi.mock("electron", async () => {
  const actual = await vi.importActual<any>("electron")
  return {
    ...actual,
    app: {
      getVersion: vi.fn(() => "1.0.0"),
    },
    screen: {
      getPrimaryDisplay: vi.fn(() => ({
        workAreaSize: { width: 1920, height: 1080 },
      })),
    },
  }
})
