import { index, jsonb, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

export const userSettings = pgTable("user_settings", {
  userId: text("user_id").primaryKey(),
  settings: jsonb("settings").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
});

const recordColumns = {
  userId: text("user_id").notNull(),
  id: text("id").notNull(),
  record: jsonb("record"),

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
