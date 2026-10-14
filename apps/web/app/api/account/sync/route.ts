import { and, eq } from "drizzle-orm";
import { accountUser, badRequest, noStore } from "@/lib/account/server";
import { SyncPush, type SyncedRecord } from "@/lib/account/sync";
import { getDb } from "@/lib/db/client";
import { conversations, trips } from "@/lib/db/schema";

type Table = typeof trips | typeof conversations;

const toWire = (row: typeof trips.$inferSelect): SyncedRecord =>
  row.deletedAt
    ? { id: row.id, updatedAt: row.updatedAt.toISOString(), revision: row.revision, deleted: true }
    : {
        id: row.id,
        revision: row.revision,
        updatedAt: row.updatedAt.toISOString(),
        record: row.record as Record<string, unknown>,
      };

async function rows(table: Table, userId: string) {
  return (await getDb().select().from(table).where(eq(table.userId, userId))).map(toWire);
}

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
  const accepted: SyncedRecord[] = [];
  const conflicts: SyncedRecord[] = [];
  for (const item of records) {
    const now = new Date();
    const values = {
      record: item.deleted ? null : item.record,
      updatedAt: new Date(item.updatedAt),
      deletedAt: item.deleted ? now : null,
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

export async function POST(request: Request) {
  const user = await accountUser();
  if ("response" in user) return user.response;
  const parsed = SyncPush.safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) {
    const issue = parsed.error.issues[0]?.message;
    return badRequest(issue ? { raw: issue } : { key: "Invalid sync request." });
  }
  const tripResult = await upsert(trips, user.userId, parsed.data.trips);
  const conversationResult = await upsert(conversations, user.userId, parsed.data.conversations);
  return Response.json(
    {
      accepted: { trips: tripResult.accepted, conversations: conversationResult.accepted },
      conflicts: { trips: tripResult.conflicts, conversations: conversationResult.conflicts },
    },
    { headers: noStore },
  );
}
