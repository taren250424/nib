import type { CommandRegistry } from "@renderer/core"
import type { WindowFacade } from "@renderer/modules"

export function handleWindow(windowFacade: WindowFacade, commandRegistry: CommandRegistry) {
  const { maximizeBtn, minimizeBtn, exitBtn } = windowFacade.renderer.elements

  window.mainToRenderer.onMaximizeWindow(() => {
    windowFacade.renderUnMaximizeButtonSvg()
    windowFacade.setWindowMaximizeState(true)
  })
  window.mainToRenderer.onUnmaximizeWindow(() => {
    windowFacade.renderMaximizeButtonSvg()
    windowFacade.setWindowMaximizeState(false)
  })

  maximizeBtn.addEventListener("click", () => {
    if (windowFacade.isWindowMaximize()) window.rendererToMain.requestUnmaximizeWindow()
    else window.rendererToMain.requestMaximizeWindow()
  })
  minimizeBtn.addEventListener("click", () => {
    window.rendererToMain.requestMinimizeWindow()
  })
  exitBtn.addEventListener("click", () => {
    void commandRegistry.execute("app.exit")
  })
}
