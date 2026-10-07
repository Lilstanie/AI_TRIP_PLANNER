import { eq, sql } from "drizzle-orm";
import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { SyncPush, type SyncedRecord } from "@/lib/account/sync";
import { getDb } from "@/lib/db/client";
import { conversations, trips } from "@/lib/db/schema";

type Table = typeof trips | typeof conversations;

const toWire = (row: typeof trips.$inferSelect): SyncedRecord =>
  row.deletedAt
    ? { id: row.id, updatedAt: row.updatedAt.toISOString(), deleted: true }
    : {
        id: row.id,
        updatedAt: row.updatedAt.toISOString(),
        record: row.record as Record<string, unknown>,
      };

async function rows(table: Table, userId: string) {
  return (await getDb().select().from(table).where(eq(table.userId, userId))).map(toWire);
}

/** Every trip and conversation the account holds, tombstones included, for the client to merge. */
export async function GET() {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const [tripRows, conversationRows] = await Promise.all([
    rows(trips, user.userId),
    rows(conversations, user.userId),
  ]);
  return Response.json({ trips: tripRows, conversations: conversationRows }, { headers: noStore });
}

async function upsert(table: Table, userId: string, records: SyncedRecord[]) {
  if (!records.length) return;
  await getDb()
    .insert(table)
    .values(
      records.map((item) => ({
        userId,
        id: item.id,
        record: item.deleted ? null : item.record,
        updatedAt: new Date(item.updatedAt),
        deletedAt: item.deleted ? new Date(item.updatedAt) : null,
      })),
    )
    .onConflictDoUpdate({
      target: [table.userId, table.id],
      set: {
        record: sql`excluded.record`,
        updatedAt: sql`excluded.updated_at`,
        deletedAt: sql`excluded.deleted_at`,
      },
      // Last write wins per record: an older copy never replaces a newer one.
      setWhere: sql`excluded.updated_at > ${table.updatedAt}`,
    });
}

/** Stores the records a browser changed; each is written only if it is newer than the stored one. */
export async function POST(request: Request) {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const parsed = SyncPush.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return badRequest(issue ? { raw: issue } : { key: "Invalid sync request." });
  }
  await upsert(trips, user.userId, parsed.data.trips);
  await upsert(conversations, user.userId, parsed.data.conversations);
  return Response.json({ ok: true }, { headers: noStore });
}
