import type IDialogManager from "@main/modules/contracts/IDialogManager"
import { dialog, BrowserWindow } from "electron"

const dialogManager: IDialogManager = {
  async showConfirmDialog(message: string): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: "question",
      buttons: ["Yes", "No"],
      defaultId: 0,
      cancelId: 1,
      message: message,
    })
    return result.response === 0
  },

  /** Tells the user why something they asked for did not happen. Nothing to answer. */
  async showWarningDialog(message: string): Promise<void> {
    await dialog.showMessageBox({
      type: "warning",
      buttons: ["OK"],
      message,
    })
  },

  async showOpenFileDialog() {
    return await dialog.showOpenDialog({
      title: "Open",
      // filters: [
      //     { name: 'Markdown', extensions: ['md', 'markdown'] }
      // ],
      properties: ["openFile"],
    })
  },

  async showOpenDirectoryDialog() {
    return await dialog.showOpenDialog({
      title: "Open Directory",
      properties: ["openDirectory"],
    })
  },

  async showSaveDialog(mainWindow: BrowserWindow, fileName = ""): Promise<Electron.SaveDialogReturnValue> {
    return await dialog.showSaveDialog(mainWindow, {
      title: "Save As",
      defaultPath: fileName,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    })
  },
}

export default dialogManager
