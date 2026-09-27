import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/** Accounts sync only when a database is configured; the workspace works locally without one. */
export const dbEnabled = () => Boolean(process.env.DATABASE_URL);

function createDb() {
  return drizzle(neon(process.env.DATABASE_URL!), { schema });
}

let db: ReturnType<typeof createDb> | undefined;

/**
 * The database client, created on first use rather than at import: `next build` evaluates route
 * modules, and a build without `DATABASE_URL` must not fail or connect. Deliberately a plain
 * function, not a Proxy, so libraries that inspect the client see the real object.
 */
export function getDb() {
  if (!dbEnabled()) throw new Error("DATABASE_URL is not configured.");
  db ??= createDb();
  return db;
}
