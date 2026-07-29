import { defineConfig } from "vite"
import { builtinModules } from "module"
import path from "path"

export default defineConfig({
  build: {
    outDir: "dist/main",
    lib: {
      entry: "src/main/preload/preload.ts",
      formats: ["cjs"],
      fileName: () => "preload.js",
    },
    rollupOptions: {
      external: ["electron", ...builtinModules.flatMap((m) => [m, `node:${m}`])],
      output: {
        format: "cjs",
      },
    },
    target: "node20",
    emptyOutDir: false,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "src/shared"),
      "@services": path.resolve(__dirname, "src/main/services"),
      "@modules_contracts": path.resolve(__dirname, "src/main/modules/contracts"),
    },
  },
})
