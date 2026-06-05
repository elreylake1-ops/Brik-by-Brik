import { defineConfig } from "vitest/config"
import path from "path"

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      vitest: path.resolve(__dirname, "tests/vitest-shim.ts"),
    },
  },
})
