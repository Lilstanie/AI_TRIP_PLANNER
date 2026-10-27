import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { UserPreference } from "@trip/shared";
import { memory as ephemeralMemory } from "@trip/services";
import { getDb, dbEnabled } from "../db/client";
import { withMemoryTransaction } from "../db/memory-transaction";
import { accountMemories } from "../db/schema";
import { mergeAccommodationMemory } from "./accommodation-memory.mjs";

const REMEMBERABLE_KEYS = new Set([
  "dietary",
  "pace",
  "interests",
  "accessibility",
  "accommodation",
  "departure_city",
]);

export async function getAccountMemories(userId?: string): Promise<UserPreference[]> {
  if (!userId || !dbEnabled()) return [];
  const rows = await getDb()
    .select()
    .from(accountMemories)
    .where(eq(accountMemories.userId, userId));
  return rows.map(({ key, value }) => ({ key, value, source: "chat_confirmed" as const }));
}

export async function deleteAccountMemory(userId: string, key: string) {
  if (!dbEnabled()) return false;
  const deleted = await getDb()
    .delete(accountMemories)
    .where(and(eq(accountMemories.userId, userId), eq(accountMemories.key, key)))
    .returning({ key: accountMemories.key });
  return deleted.length > 0;
}

export async function rememberAccountPreference(
  userId: string | undefined,
  key: string,
  value: string,
  signal?: AbortSignal,
) {
  if (!userId || !dbEnabled() || !REMEMBERABLE_KEYS.has(key)) return undefined;
  signal?.throwIfAborted();
  return withMemoryTransaction(async (tx) => {
    signal?.throwIfAborted();
    const inserted = await tx
      .insert(accountMemories)
      .values({
        userId,
        key,
        value: "{}",
        previousValue: null,
        undoToken: randomUUID(),
        updatedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning({ key: accountMemories.key });
    const [current] = await tx
      .select()
      .from(accountMemories)
      .where(and(eq(accountMemories.userId, userId), eq(accountMemories.key, key)))
      .for("update");
    const storedValue =
      key === "accommodation" ? mergeAccommodationMemory(current.value, value) : value;
    const token = randomUUID();
    await tx
      .update(accountMemories)
      .set({
        value: storedValue,
        previousValue: inserted.length > 0 ? null : current.value,
        undoToken: token,
        updatedAt: new Date(),
      })
      .where(and(eq(accountMemories.userId, userId), eq(accountMemories.key, key)));
    signal?.throwIfAborted();
    return {
      token,
      action: inserted.length > 0 ? ("remembered" as const) : ("updated" as const),
      value: storedValue,
    };
  });
}

export async function undoAccountMemory(userId: string, token: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(accountMemories)
    .where(and(eq(accountMemories.userId, userId), eq(accountMemories.undoToken, token)));
  if (!row) return false;
  const affected =
    row.previousValue === null
      ? await db
          .delete(accountMemories)
          .where(
            and(
              eq(accountMemories.userId, userId),
              eq(accountMemories.key, row.key),
              eq(accountMemories.undoToken, token),
            ),
          )
          .returning({ key: accountMemories.key })
      : await db
          .update(accountMemories)
          .set({
            value: row.previousValue,
            previousValue: null,
            undoToken: randomUUID(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(accountMemories.userId, userId),
              eq(accountMemories.key, row.key),
              eq(accountMemories.undoToken, token),
            ),
          )
          .returning({ key: accountMemories.key });
  return affected.length > 0;
}

export function accountMemoryStore(userId?: string, enabled = true) {
  return {
    getShortTerm: ephemeralMemory.getShortTerm.bind(ephemeralMemory),
    appendShortTerm: ephemeralMemory.appendShortTerm.bind(ephemeralMemory),
    getLongTerm: async () => {
      if (!enabled) return [];
      try {
        return await getAccountMemories(userId);
      } catch (error) {
        console.warn("[account-memory] planning read failed; continuing without memory", error);
        return [];
      }
    },
    setLongTerm: async (_requestedUserId: string, pref: UserPreference) => {
      if (enabled && REMEMBERABLE_KEYS.has(pref.key))
        await rememberAccountPreference(userId, pref.key, pref.value);
    },
    promote: async () => {},
  };
}
