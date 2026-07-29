import { contextBridge } from "electron"
import mainToRenderer from "./impl/mainToRenderer"
import rendererToMain from "./impl/rendererToMain"
import utils from "./impl/utils"

contextBridge.exposeInMainWorld("mainToRenderer", mainToRenderer)
contextBridge.exposeInMainWorld("rendererToMain", rendererToMain)
contextBridge.exposeInMainWorld("utils", utils)
