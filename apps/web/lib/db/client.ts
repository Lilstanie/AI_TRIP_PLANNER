import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export const dbEnabled = () => Boolean(process.env.DATABASE_URL);

function createDb() {
  return drizzle(neon(process.env.DATABASE_URL!), { schema });
}

let db: ReturnType<typeof createDb> | undefined;

export function getDb() {
  if (!dbEnabled()) throw new Error("DATABASE_URL is not configured.");
  db ??= createDb();
  return db;
}
