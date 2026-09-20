import { readFileSync } from "node:fs";

/**
 * Tests talk to the Neon `test` branch and nothing else. `.env.local` points at
 * the branch the app deploys from, so it is never read here.
 *
 * The file is parsed by hand rather than with process.loadEnvFile, which leaves
 * an already-set variable alone: a shell or CI environment that exported
 * DATABASE_URL would then silently win, which is the one outcome this file
 * exists to prevent.
 */
const TEST_ENV_FILE = ".env.test.local";

/**
 * Only the test env file may set these. They are cleared before it is read, so
 * an ambient value can never survive — not even if the file turns out to be
 * missing, unreadable, or incomplete.
 */
const DATABASE_VARIABLES = ["DATABASE_URL", "DATABASE_URL_UNPOOLED"] as const;

function loadTestEnv(): void {
  for (const name of DATABASE_VARIABLES) delete process.env[name];

  let contents: string;
  try {
    contents = readFileSync(TEST_ENV_FILE, "utf8");
  } catch {
    // No test env file at all: unit tests still run, and anything that opens a
    // connection fails on a missing DATABASE_URL rather than finding another
    // branch's.
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

  if (!process.env.DATABASE_URL) {
    // The file exists but does not say which database to use. Stop here rather
    // than let the run continue on whatever else might be lying around.
    throw new Error(
      `${TEST_ENV_FILE} does not set DATABASE_URL. It must point at the Neon test branch; tests never fall back to another environment.`,
    );
  }
}

loadTestEnv();
