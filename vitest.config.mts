import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**"],
    setupFiles: ["./vitest.setup.ts"],
    // One Neon `test` branch serves every test file, so two files running at
    // once share a database. Tests that assert on rows they did not create —
    // "no Owner is left behind when the Goal cannot be written" counts every
    // Owner there is — then fail on another file's rows rather than on a bug.
    fileParallelism: false,
  },
});
