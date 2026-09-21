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
    // Anchored patterns miss nested copies: agents work in git worktrees under
    // .claude/worktrees/, each with its own node_modules, so a run from the
    // repo root was collecting our dependencies' own test suites.
    exclude: ["**/node_modules/**", "**/.next/**", ".claude/**"],
    setupFiles: ["./vitest.setup.ts"],
  },
});
