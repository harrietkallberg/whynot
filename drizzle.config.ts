import { defineConfig } from "drizzle-kit";

// Next loads .env.local itself; drizzle-kit does not. The file is gitignored,
// so it is absent in CI and on a fresh checkout — where the variable comes
// from the real environment instead. loadEnvFile throws ENOENT rather than
// no-opping, so a missing file must not abort the config.
try {
  process.loadEnvFile(".env.local");
} catch {
  // No local env file; fall through to the ambient environment.
}

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED is not set (no .env.local and none in the environment)",
  );
}

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migrations must use the direct connection. The pooled one runs through
  // PgBouncer in transaction mode and fails on session-level operations, in
  // ways whose error messages never mention pooling.
  dbCredentials: { url },
});
