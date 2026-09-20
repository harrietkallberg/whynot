import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

// Pooled connection for application traffic. Migrations use the direct URL
// instead — see drizzle.config.ts.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
export { schema };
