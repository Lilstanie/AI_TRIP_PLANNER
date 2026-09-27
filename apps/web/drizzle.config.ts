import { defineConfig } from "drizzle-kit";

// Generate with `pnpm --filter @trip/web db:generate`; apply with `db:migrate`, which loads
// `.env.local` for DATABASE_URL (drizzle-kit does not read it on its own).
export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
