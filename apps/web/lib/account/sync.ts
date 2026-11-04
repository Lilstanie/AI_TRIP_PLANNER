import { z } from "zod";

export const SyncedRecord = z
  .object({
    id: z.string().min(1).max(200),
    updatedAt: z.string().datetime(),
    revision: z.number().int().min(0).max(2_147_483_646),
    deleted: z.boolean().optional(),
    record: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => value.deleted || value.record, "A live record needs its contents.")
  .refine(
    (value) => !value.record || JSON.stringify(value.record).length <= MAX_RECORD_CHARS,
    "A record is too large to sync.",
  );
export type SyncedRecord = z.infer<typeof SyncedRecord>;

export const MAX_RECORD_CHARS = 2_000_000;

export const MAX_SYNC_RECORDS = 500;

export const SyncPush = z.object({
  trips: z.array(SyncedRecord).max(MAX_SYNC_RECORDS),
  conversations: z.array(SyncedRecord).max(MAX_SYNC_RECORDS),
});
export type SyncPush = z.infer<typeof SyncPush>;

/** Largest `POST /api/account/sync` body in UTF-8 bytes; it fits one record at the record limit. */
export const MAX_SYNC_BODY_BYTES = 6_200_000;

const encoder = new TextEncoder();
const byteLength = (value: unknown) => encoder.encode(JSON.stringify(value)).length;

/**
 * Splits a push into bodies of at most `MAX_SYNC_BODY_BYTES` and `MAX_SYNC_RECORDS` per kind,
 * keeping each kind's order. Returns no batch for an empty push.
 */
export function syncBatches(push: SyncPush): SyncPush[] {
  const empty = (): SyncPush => ({ trips: [], conversations: [] });
  const envelope = byteLength(empty());
  const batches: SyncPush[] = [];
  let batch = empty();
  let size = envelope;
  for (const kind of ["trips", "conversations"] as const)
    for (const item of push[kind]) {
      const itemSize = byteLength(item) + 1;
      if (
        (batch.trips.length || batch.conversations.length) &&
        (size + itemSize > MAX_SYNC_BODY_BYTES || batch[kind].length >= MAX_SYNC_RECORDS)
      ) {
        batches.push(batch);
        batch = empty();
        size = envelope;
      }
      batch[kind].push(item);
      size += itemSize;
    }
  if (batch.trips.length || batch.conversations.length) batches.push(batch);
  return batches;
}
export type SyncPull = SyncPush;

export const SyncResult = z.object({ accepted: SyncPush, conflicts: SyncPush });
export type SyncResult = z.infer<typeof SyncResult>;
