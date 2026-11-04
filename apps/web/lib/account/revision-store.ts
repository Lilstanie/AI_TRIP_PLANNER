import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { conversations, trips, userSettings } from "@/lib/db/schema";
import type { AccountTransaction } from "./deletion";
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

const columns = (item: SyncedRecord) => ({
  record: item.deleted ? null : item.record,
  updatedAt: new Date(item.updatedAt),
  deletedAt: item.deleted ? new Date() : null,
  revision: item.revision + 1,
});

export async function writeRecords(
  tx: AccountTransaction,
  table: RecordTable,
  userId: string,
  records: SyncedRecord[],
) {
  const seen = new Set<string>();
  const created = records.filter(
    (item) => item.revision === 0 && !seen.has(item.id) && seen.add(item.id),
  );
  const inserted = created.length
    ? await tx
        .insert(table)
        .values(created.map((item) => ({ userId, id: item.id, ...columns(item) })))
        .onConflictDoNothing()
        .returning()
    : [];
  const insertedById = new Map(inserted.map((row) => [row.id, row]));
  const accepted: SyncedRecord[] = [];
  const conflicts: SyncedRecord[] = [];
  for (const item of records) {
    let saved: typeof trips.$inferSelect | undefined;
    if (item.revision === 0) {
      saved = created.includes(item) ? insertedById.get(item.id) : undefined;
    } else {
      [saved] = await tx
        .update(table)
        .set(columns(item))
        .where(
          and(eq(table.userId, userId), eq(table.id, item.id), eq(table.revision, item.revision)),
        )
        .returning();
    }
    if (saved) accepted.push(toWire(saved));
    else conflicts.push(item);
  }
  return { accepted, conflicts };
}

export async function writeSettings(
  tx: AccountTransaction,
  userId: string,
  settings: UserSettings,
  revision: number,
) {
  const values = {
    settings,
    updatedAt: new Date(settings.updatedAt),
    revision: revision + 1,
  };
  return revision === 0
    ? tx
        .insert(userSettings)
        .values({ userId, ...values })
        .onConflictDoNothing()
        .returning()
    : tx
        .update(userSettings)
        .set(values)
        .where(and(eq(userSettings.userId, userId), eq(userSettings.revision, revision)))
        .returning();
}
