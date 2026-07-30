import type IDialogManager from "@main/modules/contracts/IDialogManager"
import { BrowserWindow } from "electron"

let fakeConfirmResult = false
export function setFakeConfirmResult(result: boolean) {
  fakeConfirmResult = result
}

/** Warnings shown so far, so a test can say what the user was told. */
export const fakeWarnings: string[] = []

let fakeSaveDialogResult: Electron.SaveDialogReturnValue = {
  canceled: false,
  filePath: undefined as any,
}
export function setFakeSaveDialogResult(result: Electron.SaveDialogReturnValue) {
  fakeSaveDialogResult = result
}

let fakeOpenFileDialogResult: Electron.OpenDialogReturnValue = {
  canceled: false,
  filePaths: [],
}
export function setFakeOpenFileDialogResult(result: Electron.OpenDialogReturnValue) {
  fakeOpenFileDialogResult = result
}

let fakeOpenDirectoryDialogResult: Electron.OpenDialogReturnValue = {
  canceled: false,
  filePaths: [],
}
export function setFakeOpenDirectoryDialogResult(result: Electron.OpenDialogReturnValue) {
  fakeOpenDirectoryDialogResult = result
}

const fakeDialogManager: IDialogManager = {
  async showConfirmDialog(_message: string): Promise<boolean> {
    return fakeConfirmResult
  },

  async showWarningDialog(message: string): Promise<void> {
    fakeWarnings.push(message)
  },

  async showOpenFileDialog(): Promise<Electron.OpenDialogReturnValue> {
    return fakeOpenFileDialogResult
  },

  async showOpenDirectoryDialog() {
    return fakeOpenDirectoryDialogResult
  },

  async showSaveDialog(_mainWindow: BrowserWindow, _fileName = ""): Promise<Electron.SaveDialogReturnValue> {
    return fakeSaveDialogResult
  },
}

export default fakeDialogManager
