// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest"

import { handleSettings } from "@renderer/handlers/settingsHandlers"
import type { SettingsViewModel } from "@renderer/viewmodels/SettingsViewModel"

import { createCommandHarness, type CommandHarness } from "../commandHarness"

let harness: CommandHarness

beforeEach(() => {
  harness = createCommandHarness()
})

const elements = () => harness.settingsFacade.renderer.elements

const editorOf = (settings: SettingsViewModel) => settings.settingEditorViewModel

/** Types into a settings field and lets go of it, which is when it reports. */
function change(input: HTMLInputElement, value: string) {
  input.value = value
  input.dispatchEvent(new Event("change"))
}

/** What a `nib-select` tells the renderer when the user picks something. */
function pick(select: Element, value: string) {
  select.dispatchEvent(new CustomEvent("nib-select-changed", { detail: { value } }))
}

/**
 * The settings dialog, which had no test at all — it was the one thing the
 * command harness still faked.
 *
 * The whole design is a draft next to what is current: editing a field must not
 * change the app, and Apply is the only thing that does.
 */
describe("SettingsFacade draft and current", () => {
  it("puts an edited field in the draft and leaves the current settings alone", () => {
    change(elements().fontSizeInput, "20")

    expect(editorOf(harness.settingsFacade.getDraftSettings()).fontSize).toBe(20)
    expect(editorOf(harness.settingsFacade.getCurrentSettings()).fontSize).toBe(16)
  })

  it("reports the edited fields and the untouched ones alike", () => {
    change(elements().editorWidthInput, "800")

    const changes = harness.settingsFacade.getChangeSet()
    expect(editorOf(changes).width).toBe(800)
    // Not a diff: an untouched field comes back as what it already is, so the
    // change set can be applied whole. Empty means the app's own font stack.
    expect(editorOf(changes).fontFamily).toBe("")
  })

  it("takes what a select reports", () => {
    pick(elements().autoSaveSelect, "afterDelay")
    pick(elements().themeSelect, "slate")

    const draft = harness.settingsFacade.getDraftSettings()
    expect(editorOf(draft).autoSave).toBe("afterDelay")
    expect(draft.settingThemeViewModel.theme).toBe("slate")
  })

  it("forgets the draft when settings are loaded over it", () => {
    change(elements().fontSizeInput, "20")

    harness.settingsFacade.setSettingsValue({
      settingEditorViewModel: { width: 700, fontSize: 14, fontFamily: "serif", autoSave: "off" },
      settingThemeViewModel: { theme: "light" },
    })

    // Otherwise the next Apply carries the previous session's numbers, or the
    // constructor defaults, as if the user had just typed them.
    expect(editorOf(harness.settingsFacade.getDraftSettings())).toEqual(
      editorOf(harness.settingsFacade.getCurrentSettings())
    )
    expect(editorOf(harness.settingsFacade.getDraftSettings()).fontSize).toBe(14)
  })
})

/**
 * Apply is where the draft reaches the app: the editor, the theme on the root
 * element, and the settings session on disk.
 */
describe("settings apply", () => {
  it("carries every editor setting through to the editor", () => {
    change(elements().editorWidthInput, "800")
    change(elements().fontSizeInput, "20")
    change(elements().fontFamilyInput, "serif")
    pick(elements().autoSaveSelect, "afterDelay")

    harness.settingsController.performApplySettings(harness.settingsFacade.getChangeSet())

    const container = harness.tabEditor.elements.editorContainer
    expect(container.style.getPropertyValue("--editor-width")).toBe("800px")
    expect(container.style.getPropertyValue("--text-base")).toBe("20px")
    // The family lands as the --font-content override, not as an inline
    // font-family — see TabEditorRenderer.changeFontFamily.
    expect(container.style.getPropertyValue("--font-content")).toBe("serif")
    expect(harness.tabEditor.store.autoSaveMode).toBe("afterDelay")
  })

  it("leaves exactly one theme class on the root element", () => {
    pick(elements().themeSelect, "slate")
    harness.settingsController.performApplySettings(harness.settingsFacade.getChangeSet())
    expect(document.documentElement.className).toBe("slate")

    pick(elements().themeSelect, "solarized")
    harness.settingsController.performApplySettings(harness.settingsFacade.getChangeSet())
    expect(document.documentElement.className).toBe("solarized")
  })

  it("makes the draft current, so applying twice does not undo anything", () => {
    change(elements().fontSizeInput, "20")

    harness.settingsController.performApplySettings(harness.settingsFacade.getChangeSet())

    expect(editorOf(harness.settingsFacade.getCurrentSettings()).fontSize).toBe(20)
  })

  it("writes the settings session when Apply is the button that was pressed", async () => {
    handleSettings(
      (_id, changes) => harness.settingsController.performApplyAndSaveSettings(changes as SettingsViewModel),
      harness.settingsFacade
    )
    change(elements().fontSizeInput, "20")

    elements().apply.click()
    await Promise.resolve()

    const saved = harness.ipc.syncSettingsSessionFromRenderer.mock.calls[0][0]
    expect(saved.settingEditorDto.fontSize).toBe(20)
  })
})

describe("settings dialog", () => {
  it("opens and closes the overlay", () => {
    handleSettings(async () => undefined, harness.settingsFacade)

    harness.settingsFacade.openSettings()
    expect(elements().overlay.style.display).toBe("flex")

    elements().close.click()
    expect(elements().overlay.style.display).toBe("none")
  })

  it("shows the panel of the menu item that was clicked", () => {
    handleSettings(async () => undefined, harness.settingsFacade)

    elements().menus[1].click()

    expect(elements().contents[1].style.display).toBe("block")
    expect(elements().contents[0].style.display).toBe("none")
  })

  it("gives up an edit that was never applied", () => {
    handleSettings(async () => undefined, harness.settingsFacade)
    change(elements().fontSizeInput, "20")

    elements().close.click()

    expect(editorOf(harness.settingsFacade.getDraftSettings()).fontSize).toBe(16)
  })

  // The field has to go back with the draft. Showing 20 over a draft that says
  // 16 would be worse than not reverting at all.
  it("puts the field back to what is in force", () => {
    handleSettings(async () => undefined, harness.settingsFacade)
    change(elements().fontSizeInput, "20")

    elements().close.click()

    expect(elements().fontSizeInput.value).toBe("16")
  })

  it("gives it up through the X as well as the Close button", () => {
    handleSettings(async () => undefined, harness.settingsFacade)
    change(elements().fontSizeInput, "20")

    elements().exit.click()

    expect(editorOf(harness.settingsFacade.getDraftSettings()).fontSize).toBe(16)
  })

  // What the abandoned draft actually cost: the change set is not a diff, so
  // whatever was left in it rode along with the next thing the user applied.
  it("applies only what was changed after coming back", () => {
    handleSettings(async () => undefined, harness.settingsFacade)
    change(elements().fontSizeInput, "20")
    elements().close.click()

    pick(elements().themeSelect, "slate")
    const changes = harness.settingsFacade.getChangeSet()

    expect(changes.settingThemeViewModel.theme).toBe("slate")
    expect(editorOf(changes).fontSize).toBe(16)
  })
})
