import { readFileSync } from "node:fs";

/**
 * Tests talk to the Neon `test` branch and nothing else. `.env.local` points at
 * the branch the app deploys from, so it is never read here: the test env file
 * is parsed by hand and its values overwrite whatever the ambient environment
 * happens to hold.
 */
const TEST_ENV_FILE = ".env.test.local";

function loadTestEnv(): void {
  let contents: string;
  try {
    contents = readFileSync(TEST_ENV_FILE, "utf8");
  } catch {
    throw new Error(
      `${TEST_ENV_FILE} is missing. Integration tests run against the Neon test branch and must never fall back to .env.local.`,
    );
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
    throw new Error(`${TEST_ENV_FILE} does not define DATABASE_URL.`);
  }
}

loadTestEnv();
