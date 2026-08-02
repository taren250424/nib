/* eslint-disable @typescript-eslint/no-var-requires */
const { execSync } = require("child_process")

const isWin = process.platform === "win32"

try {
  if (isWin) {
    execSync("taskkill /F /IM electron.exe", { stdio: "ignore" })
  } else {
    execSync("pkill -9 electron", { stdio: "ignore" })
  }
} catch (e) {
  // ignore
}

try {
  if (isWin) {
    execSync("taskkill /F /IM Nib.exe", { stdio: "ignore" })
  } else {
    execSync("pkill -9 Nib", { stdio: "ignore" })
  }
} catch (e) {
  // ignore
}
