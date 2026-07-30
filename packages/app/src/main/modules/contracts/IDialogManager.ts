import { BrowserWindow } from "electron"

export default interface IDialogManager {
  showConfirmDialog(message: string): Promise<boolean>
  showWarningDialog(message: string): Promise<void>
  showOpenFileDialog(): Promise<Electron.OpenDialogReturnValue>
  showOpenDirectoryDialog(): Promise<Electron.OpenDialogReturnValue>
  showSaveDialog(mainWindow: BrowserWindow, fileName?: string): Promise<Electron.SaveDialogReturnValue>
}
