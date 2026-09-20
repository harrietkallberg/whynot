import { readFileSync } from "node:fs";

/**
 * Tests talk to the Neon `test` branch and nothing else. `.env.local` points at
 * the branch the app deploys from, so it is never read here.
 *
 * The file is parsed by hand rather than with process.loadEnvFile, which leaves
 * an already-set variable alone: a shell that exported DATABASE_URL would then
 * silently win, which is the one outcome this file exists to prevent. Here the
 * test branch always overwrites.
 */
const TEST_ENV_FILE = ".env.test.local";

/** Nothing else may supply these, so a missing test env file clears them. */
const DATABASE_VARIABLES = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"];

function loadTestEnv(): void {
  let contents: string;
  try {
    contents = readFileSync(TEST_ENV_FILE, "utf8");
  } catch {
    // Unit tests still run without it; anything that opens a connection fails
    // loudly rather than falling back to another branch.
    for (const name of DATABASE_VARIABLES) delete process.env[name];
    return;
  }

  for (const line of contents.split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(
      line,
    );
    if (!match) continue;

    const [, key, rawValue] = match;
    const value = rawValue.trim().replace(/^(['"])(.*)\1$/s, "$2");
    process.env[key] = value;
  }
}

loadTestEnv();
