import { mainToRendererEvents } from "./mainToRendererEvents"
import { rendererToMainEvents } from "./rendererToMainEvents"
import { utilsEvents } from "./utilsEvents"

export const electronAPI = {
  events: {
    mainToRenderer: mainToRendererEvents,
    rendererToMain: rendererToMainEvents,
    utils: utilsEvents,
  },
} as const
