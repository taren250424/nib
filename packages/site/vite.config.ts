import { defineConfig, type Plugin } from "vite"
import path from "path"
import fs from "fs"

// public/ is copied verbatim into the build output and Vite offers no way to
// filter it, so the .bak logo backups have to be swept out afterwards.
function stripBakFiles(): Plugin {
  return {
    name: "strip-bak-files",
    apply: "build",
    closeBundle() {
      const outDir = path.resolve(__dirname, "docs")
      for (const file of fs.readdirSync(outDir, { recursive: true, encoding: "utf8" })) {
        if (file.endsWith(".bak")) fs.rmSync(path.join(outDir, file))
      }
    },
  }
}

export default defineConfig({
  base: "/nib/",
  plugins: [stripBakFiles()],
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@styles": path.resolve(__dirname, "src/styles"),
    },
  },
})
