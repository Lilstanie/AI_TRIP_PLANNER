import { eq, sql } from "drizzle-orm";
import { withMemoryTransaction, type Transaction } from "../db/memory-transaction";
import {
  accountDeletions,
  accountMemories,
  conversations,
  trips,
  userSettings,
} from "../db/schema";

export class AccountDeletedError extends Error {
  constructor() {
    super("This account is being deleted.");
    this.name = "AccountDeletedError";
  }
}

declare const accountWrite: unique symbol;
export type AccountTransaction = Transaction & { readonly [accountWrite]: true };

const accountLock = (userId: string) => sql`hashtextextended(${userId}, 0)`;

export function withAccountWrite<T>(
  userId: string,
  operation: (tx: AccountTransaction) => Promise<T>,
) {
  return withMemoryTransaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock_shared(${accountLock(userId)})`);
    const [tombstone] = await tx
      .select({ userId: accountDeletions.userId })
      .from(accountDeletions)
      .where(eq(accountDeletions.userId, userId));
    if (tombstone) throw new AccountDeletedError();
    return operation(tx as AccountTransaction);
  });
}

export function deleteAccountData(userId: string) {
  return withMemoryTransaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${accountLock(userId)})`);
    await tx
      .insert(accountDeletions)
      .values({ userId, requestedAt: new Date() })
      .onConflictDoNothing();
    for (const table of [trips, conversations, userSettings, accountMemories])
      await tx.delete(table).where(eq(table.userId, userId));
  });
}
