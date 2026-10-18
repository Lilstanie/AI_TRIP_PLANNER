import { randomUUID } from "node:crypto";
import { eq, and } from "drizzle-orm";
import type { UserPreference } from "@trip/shared";
import { memory as ephemeralMemory } from "@trip/services";
import { getDb, dbEnabled } from "../db/client";
import { accountMemories } from "../db/schema";

export async function getAccountMemories(userId?: string): Promise<UserPreference[]> {
  if (!userId || !dbEnabled()) return [];
  try {
    const rows = await getDb()
      .select()
      .from(accountMemories)
      .where(eq(accountMemories.userId, userId));
    return rows.map(({ key, value }) => ({ key, value, source: "chat_confirmed" as const }));
  } catch (error) {
    console.warn("[account-memory] read failed", error);
    return [];
  }
}

export async function deleteAccountMemory(userId: string, key: string) {
  if (!dbEnabled()) return false;
  const deleted = await getDb()
    .delete(accountMemories)
    .where(and(eq(accountMemories.userId, userId), eq(accountMemories.key, key)))
    .returning({ key: accountMemories.key });
  return deleted.length > 0;
}

export async function rememberDietaryNeed(userId: string | undefined, value: string) {
  if (!userId || !dbEnabled()) return undefined;
  const db = getDb();
  const key = "dietary";
  const [current] = await db
    .select()
    .from(accountMemories)
    .where(and(eq(accountMemories.userId, userId), eq(accountMemories.key, key)));
  const token = randomUUID();
  await db
    .insert(accountMemories)
    .values({
      userId,
      key,
      value,
      previousValue: current?.value ?? null,
      undoToken: token,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [accountMemories.userId, accountMemories.key],
      set: {
        value,
        previousValue: current?.value ?? null,
        undoToken: token,
        updatedAt: new Date(),
      },
    });
  return { token, action: current ? ("updated" as const) : ("remembered" as const), value };
}

export async function undoAccountMemory(userId: string, token: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(accountMemories)
    .where(and(eq(accountMemories.userId, userId), eq(accountMemories.undoToken, token)));
  if (!row) return false;
  if (row.previousValue === null)
    await db
      .delete(accountMemories)
      .where(
        and(
          eq(accountMemories.userId, userId),
          eq(accountMemories.key, row.key),
          eq(accountMemories.undoToken, token),
        ),
      );
  else
    await db
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
      );
  return true;
}

export function accountMemoryStore(userId?: string) {
  return {
    getShortTerm: ephemeralMemory.getShortTerm.bind(ephemeralMemory),
    appendShortTerm: ephemeralMemory.appendShortTerm.bind(ephemeralMemory),
    getLongTerm: () => getAccountMemories(userId),
    setLongTerm: async (_requestedUserId: string, pref: UserPreference) => {
      if (pref.key === "dietary") await rememberDietaryNeed(userId, pref.value);
    },
    promote: async () => {},
  };
}
