import type { MainToRendererAPI, RendererToMainAPI, UtilsAPI } from "@shared/preload"

export {}

declare global {
  interface Window {
    mainToRenderer: MainToRendererAPI
    rendererToMain: RendererToMainAPI
    utils: UtilsAPI
  }
}
