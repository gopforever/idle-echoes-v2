import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index.js";

if (!process.env["DATABASE_URL"]) {
  throw new Error("DATABASE_URL environment variable is required");
}

// Connection pool — reused across requests in a long-running server.
// In Vercel serverless, each cold start gets a fresh pool (max 1 connection).
const client = postgres(process.env["DATABASE_URL"], {
  max: process.env["NODE_ENV"] === "production" ? 1 : 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
