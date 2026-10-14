import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, trips, userSettings } from "@/lib/db/schema";
import type { UserSettings } from "./settings";
import type { SyncedRecord } from "./sync";

type RecordTable = typeof trips | typeof conversations;

const toWire = (row: typeof trips.$inferSelect): SyncedRecord =>
  row.deletedAt
    ? { id: row.id, updatedAt: row.updatedAt.toISOString(), revision: row.revision, deleted: true }
    : {
        id: row.id,
        revision: row.revision,
        updatedAt: row.updatedAt.toISOString(),
        record: row.record as Record<string, unknown>,
      };

export async function listRecords(table: RecordTable, userId: string) {
  return (await getDb().select().from(table).where(eq(table.userId, userId))).map(toWire);
}

export async function writeRecords(table: RecordTable, userId: string, records: SyncedRecord[]) {
  const accepted: SyncedRecord[] = [];
  const conflicts: SyncedRecord[] = [];
  for (const item of records) {
    const values = {
      record: item.deleted ? null : item.record,
      updatedAt: new Date(item.updatedAt),
      deletedAt: item.deleted ? new Date() : null,
      revision: item.revision + 1,
    };
    const saved =
      item.revision === 0
        ? await getDb()
            .insert(table)
            .values({ userId, id: item.id, ...values })
            .onConflictDoNothing()
            .returning()
        : await getDb()
            .update(table)
            .set(values)
            .where(
              and(
                eq(table.userId, userId),
                eq(table.id, item.id),
                eq(table.revision, item.revision),
              ),
            )
            .returning();
    if (saved[0]) accepted.push(toWire(saved[0]));
    else conflicts.push(item);
  }
  return { accepted, conflicts };
}

export async function writeSettings(userId: string, settings: UserSettings, revision: number) {
  const values = {
    settings,
    updatedAt: new Date(settings.updatedAt),
    revision: revision + 1,
  };
  return revision === 0
    ? getDb()
        .insert(userSettings)
        .values({ userId, ...values })
        .onConflictDoNothing()
        .returning()
    : getDb()
        .update(userSettings)
        .set(values)
        .where(and(eq(userSettings.userId, userId), eq(userSettings.revision, revision)))
        .returning();
}
