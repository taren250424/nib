import { defineConfig } from "vite"
import { builtinModules } from "module"
import path from "path"

export default defineConfig({
  build: {
    outDir: "dist/main",
    lib: {
      entry: "src/main/main.ts",
      formats: ["cjs"],
      fileName: () => "main.js",
    },
    // sourcemap: true
    rollupOptions: {
      external: ["electron", ...builtinModules.flatMap((m) => [m, `node:${m}`]), "chokidar"],
    },
    target: "node20",
    minify: false,
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      "@main": path.resolve(__dirname, "src/main"),
      "@shared": path.resolve(__dirname, "src/shared"),
      "@services": path.resolve(__dirname, "src/main/services"),
      "@modules_contracts": path.resolve(__dirname, "src/main/modules/contracts"),
    },
  },
})
