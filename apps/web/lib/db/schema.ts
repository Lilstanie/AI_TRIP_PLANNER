import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Per-user data for signed-in travellers. `user_id` is the Clerk user id; there is no users table,
 * because Clerk owns identity and every row here belongs to one user.
 *
 * Trips and conversations keep the catalog's own record shape as JSONB: the client already
 * validates it (`lib/workspace/catalog.ts`), and syncing whole records keeps one schema for both
 * stores instead of two that drift. `deleted_at` keeps a tombstone so a deletion syncs too.
 */
export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const recordColumns = {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  record: jsonb("record"),
  /** The client's `updatedAt` for the record: last write wins per record. */
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
};

export const trips = pgTable("trips", recordColumns, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("trips_user_updated").on(table.userId, table.updatedAt),
]);

export const conversations = pgTable("conversations", recordColumns, (table) => [
  primaryKey({ columns: [table.userId, table.id] }),
  index("conversations_user_updated").on(table.userId, table.updatedAt),
]);
