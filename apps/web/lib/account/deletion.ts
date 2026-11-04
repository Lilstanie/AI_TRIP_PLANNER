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
/** A transaction that holds the account's shared deletion lock and has passed the tombstone check. */
export type AccountTransaction = Transaction & { readonly [accountWrite]: true };

const accountLock = (userId: string) => sql`hashtextextended(${userId}, 0)`;

/**
 * Runs an account write in one transaction that holds the account's shared deletion lock.
 * Waits while a deletion of the same account is open; other accounts are unaffected.
 * @throws AccountDeletedError when the account has a deletion tombstone; nothing is written.
 */
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

/**
 * Records a deletion tombstone and deletes every account row in one transaction. Waits for account
 * writes already in flight and blocks new ones until commit; afterwards the tombstone refuses them.
 * The tombstone is kept so a retried deletion or a lagging tab cannot write rows again.
 * @throws when any statement fails; the transaction then rolls back and nothing is deleted.
 */
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
