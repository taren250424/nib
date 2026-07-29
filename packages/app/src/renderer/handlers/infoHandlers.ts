import type { InfoFacade } from "@renderer/modules"

export function handleInfo(infoFacade: InfoFacade) {
  const { close } = infoFacade.elements

  close.addEventListener("click", () => {
    infoFacade.hideInformation()
  })
}
