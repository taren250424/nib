import { defineConfig } from "vite"
import path from "path"

export default defineConfig({
  base: "/nib/",
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
