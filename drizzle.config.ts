import { defineConfig } from "drizzle-kit";

// Next loads .env.local itself; drizzle-kit does not.
process.loadEnvFile(".env.local");

const url = process.env.DATABASE_URL_UNPOOLED;
if (!url) throw new Error("DATABASE_URL_UNPOOLED is not set");

export default defineConfig({
  schema: "./db/schema.ts",
  out: "./db/migrations",
  dialect: "postgresql",
  // Migrations must use the direct connection. The pooled one runs through
  // PgBouncer in transaction mode and fails on session-level operations, in
  // ways whose error messages never mention pooling.
  dbCredentials: { url },
});
