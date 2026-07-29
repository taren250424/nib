import { DOM } from "../constants"
import { SettingsFacade } from "../modules"
import type { RunCommand } from "./runCommand"

export function handleSettings(run: RunCommand, settingsFacade: SettingsFacade) {
  const { menus, contents, exit, apply, close } = settingsFacade.renderer.elements

  menus.forEach((el, idx) => {
    el.addEventListener("click", () => {
      menus.forEach((m) => m.classList.remove(DOM.CLASS_SELECTED))
      contents.forEach((c) => (c.style.display = "none"))

      el.classList.add(DOM.CLASS_SELECTED)
      contents[idx].style.display = "block"
    })
  })

  exit.addEventListener("click", () => {
    settingsFacade.closeSettings()
  })

  apply.addEventListener("click", async () => {
    await run("settings.applyAndSave", settingsFacade.getChangeSet())
  })

  close.addEventListener("click", () => {
    settingsFacade.closeSettings()
  })
}
