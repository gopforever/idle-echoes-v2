import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

// Lazy initialization — don't connect at import time (safe for build/test envs)
function createDb() {
  const url = process.env["DATABASE_URL"];
  if (!url) throw new Error("DATABASE_URL environment variable is required");
  const client = postgres(url, {
    max: process.env["NODE_ENV"] === "production" ? 1 : 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return drizzle(client, { schema });
}

let _db: ReturnType<typeof createDb> | null = null;
export const db = new Proxy({} as ReturnType<typeof createDb>, {
  get(_target, prop) {
    if (!_db) _db = createDb();
    return (_db as Record<string | symbol, unknown>)[prop];
  },
});
export type Db = typeof db;
